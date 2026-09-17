/**
 * Stämmer siffrorna med det de värnpliktiga faktiskt rapporterat?
 *
 * Testerna lägger in kända svar — olika värden per kategori, dagar som hoppas
 * över, en inaktiverad person, personer direkt på plutonen — och räknar sedan
 * fram varje siffra på egen hand, ur de råa svaren, med vanlig aritmetik. Inget
 * av appens beräkningskod används för facit. Därefter jämförs facit med det
 * appen levererar, för 7, 14 och 21 dagar.
 *
 * Jämförelsen görs på det som VISAS: talet med en decimal och färgen. Det är
 * det ett befäl läser av, och det är där avrundningsfel märks.
 *
 * Facit räknas i heltal (summa och antal), inte med flyttal. Då kan facit inte
 * självt drabbas av samma avrundningsfel som det ska upptäcka.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { buildOrg, database } from './setup.mjs';

const CATS = ['fysisk', 'psykisk', 'social', 'somn', 'kost', 'energi'];
const K = 4;
const iso = () => new Date().toISOString();

// ─── Datum, räknade oberoende av appens datummodul ──────────────────────────

const TODAY = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Stockholm' });
function daysAgo(n) {
  const [y, m, d] = TODAY.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d) - n * 86_400_000).toISOString().slice(0, 10);
}
/** Datumen i en period, äldst först. Dag 1 är idag; dag P+1 ligger utanför. */
const windowDates = (p) => Array.from({ length: p }, (_, i) => daysAgo(p - 1 - i));

// ─── Facit: exakt avrundning och status ur heltal ───────────────────────────

/** summa/antal avrundat till tiondelar, halvor uppåt — i heltal. */
const tenths = (sum, count) => Math.floor((20 * sum + count) / (2 * count));
const shown = (sum, count) => {
  const t = tenths(sum, count);
  return `${Math.floor(t / 10)},${t % 10}`;
};
const statusOf = (sum, count) => {
  const t = tenths(sum, count);
  return t >= 70 ? 'green' : t >= 40 ? 'yellow' : 'red';
};
const rowSum = (r) => CATS.reduce((a, c) => a + r[c], 0);

// ─── Deterministiskt "slumpade" svar ────────────────────────────────────────

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

async function insertUnit(client, name, kind, parent) {
  const r = await client.execute({
    sql: 'INSERT INTO units (name, kind, parent_id, created_at) VALUES (?,?,?,?)',
    args: [name, kind, parent, iso()],
  });
  return Number(r.lastInsertRowid);
}

async function insertSoldier(client, unitId, active = 1) {
  const r = await client.execute({
    sql: 'INSERT INTO users (code_hash, label, role, unit_id, active, created_at) VALUES (?,?,?,?,?,?)',
    args: [`hash-${unitId}-${Math.random()}`, 'Värnpliktig', 'soldat', unitId, active, iso()],
  });
  return Number(r.lastInsertRowid);
}

/** Sparar ett svar både i databasen och i testets egen lista. */
async function answer(client, raw, person, date, values) {
  await client.execute({
    sql: `INSERT INTO check_ins (user_id, service_date, fysisk, psykisk, social, somn, kost, energi, created_at)
          VALUES (?,?,?,?,?,?,?,?,?)`,
    args: [person.id, date, ...CATS.map((c) => values[c]), iso()],
  });
  raw.push({ ...person, date, ...values });
}

/**
 * Pluton 1: Grupp A (8), Grupp B (8), fem personer direkt på plutonen och en
 * inaktiverad person i Grupp A som ändå har svar kvar.
 * Pluton 2 under samma kompani: sex personer i en grupp.
 * Svar för 25 dagar bakåt, så att även 21-dagarsfönstret har något utanför sig.
 */
async function buildScenario(client) {
  const org = await buildOrg(client);
  const people = [];
  for (const [namn, ids] of Object.entries(org.soldater)) {
    for (const id of ids) people.push({ id, active: true, pluton: org.pluton, child: org.grupper[namn], childName: namn });
  }
  for (let i = 0; i < 5; i++) {
    people.push({ id: await insertSoldier(client, org.pluton), active: true, pluton: org.pluton, child: 'direct', childName: 'Direkt i enheten' });
  }
  people.push({ id: await insertSoldier(client, org.grupper['Grupp A'], 0), active: false, pluton: org.pluton, child: org.grupper['Grupp A'], childName: 'Grupp A' });

  const pluton2 = await insertUnit(client, 'Pluton 2', 'pluton', org.kompani);
  const grupp21 = await insertUnit(client, 'Grupp 1', 'grupp', pluton2);
  for (let i = 0; i < 6; i++) {
    people.push({ id: await insertSoldier(client, grupp21), active: true, pluton: pluton2, child: grupp21, childName: 'Grupp 1' });
  }

  const rand = rng(20260917);
  const raw = [];
  for (const [idx, person] of people.entries()) {
    // Några personer mår sämre än andra, så att alla tre färgerna förekommer.
    const bias = idx % 5 === 0 ? -3 : idx % 3 === 0 ? 2 : 0;
    for (let d = 0; d <= 24; d++) {
      if (rand() < 0.3) continue;
      // Två dagar bakåt svarar bara tre i Grupp B — under tröskeln den dagen.
      if (d === 2 && person.childName === 'Grupp B' && org.soldater['Grupp B'].indexOf(person.id) >= 3) continue;
      const values = Object.fromEntries(
        CATS.map((c) => [c, Math.min(10, Math.max(1, Math.floor(rand() * 10) + 1 + bias))]),
      );
      await answer(client, raw, person, daysAgo(d), values);
    }
  }

  return { org, pluton2, people, raw };
}

// ─── Facit för en mängd svar ────────────────────────────────────────────────

function expectedAggregate(rows) {
  const n = rows.length;
  const sums = Object.fromEntries(CATS.map((c) => [c, rows.reduce((a, r) => a + r[c], 0)]));
  const total = rows.reduce((a, r) => a + rowSum(r), 0);
  const responders = new Set(rows.map((r) => r.id)).size;

  const perPerson = new Map();
  for (const r of rows) {
    const p = perPerson.get(r.id) ?? { sum: 0, count: 0 };
    p.sum += rowSum(r);
    p.count += 6;
    perPerson.set(r.id, p);
  }
  const personStatus = { green: 0, yellow: 0, red: 0 };
  for (const p of perPerson.values()) personStatus[statusOf(p.sum, p.count)]++;

  return { n, sums, total, responders, personStatus };
}

function assertShown(actual, sum, count, what) {
  assert.equal(actual.formatScore(actual.value), shown(sum, count), `${what}: visat värde`);
  assert.equal(actual.getStatus(actual.value), statusOf(sum, count), `${what}: färg`);
}

// ─── Testerna ───────────────────────────────────────────────────────────────

test('befälens siffror stämmer med de råa svaren — 7, 14 och 21 dagar', async () => {
  const { client } = await database();
  const { org, pluton2, raw } = await buildScenario(client);
  const agg = await import('../src/lib/db/queries/aggregates.ts');
  const { formatScore } = await import('../src/lib/format.ts');
  const { getStatus, CATEGORIES } = await import('../src/lib/data.ts');
  const check = (value, sum, count, what) => assertShown({ value, formatScore, getStatus }, sum, count, what);

  const activeRows = raw.filter((r) => r.active);

  for (const period of [7, 14, 21]) {
    const dates = windowDates(period);
    const inWindow = activeRows.filter((r) => dates.includes(r.date));

    // Fönstret ska vara exakt P dagar: sista dagen med, dagen före utanför.
    assert.ok(raw.some((r) => r.date === daysAgo(period)), 'scenariot har svar precis utanför fönstret');

    for (const [unitName, unitId, filter] of [
      ['Pluton 1', org.pluton, (r) => r.pluton === org.pluton],
      ['Kompaniet', org.kompani, () => true],
      // Har en dag med bara tre svar — kurvan ska vara tom just den dagen.
      ['Grupp B', org.grupper['Grupp B'], (r) => r.childName === 'Grupp B'],
    ]) {
      const rows = inWindow.filter(filter);
      const e = expectedAggregate(rows);
      const label = `${unitName}, ${period} d`;
      const ov = await agg.getUnitOverview(unitId, period);

      // Antal och dagens svar. Aktiva personer i enheten, oavsett om de svarat.
      const all = { 'Pluton 1': 8 + 8 + 5, Kompaniet: 8 + 8 + 5 + 6, 'Grupp B': 8 }[unitName];
      assert.equal(ov.eligible, all, `${label}: antal värnpliktiga (inaktiverad räknas inte)`);
      const todayRows = activeRows.filter(filter).filter((r) => r.date === TODAY);
      assert.equal(ov.today.responders, todayRows.length, `${label}: svarat idag`);
      assert.equal(ov.today.pct, Math.round((todayRows.length / all) * 100), `${label}: andel idag`);

      // Kategorisnitt och samlat snitt i sidhuvudet
      assert.equal(ov.categories.ok, true, `${label}: ska visas`);
      for (const c of CATS) check(ov.categories.data[c], e.sums[c], e.n, `${label}, ${c}`);
      const header = Object.values(ov.categories.data).reduce((a, b) => a + b, 0) / CATEGORIES.length;
      check(header, e.total, e.n * 6, `${label}, samlat snitt i sidhuvudet`);

      // Gröna/gula/röda personer, efter var och ens eget snitt
      assert.deepEqual(ov.soldierStatus.data, e.personStatus, `${label}: gröna/gula/röda personer`);

      // Fördelningen av enskilda svar per kategori
      for (const c of CATS) {
        const want = { green: 0, yellow: 0, red: 0 };
        for (const r of rows) want[statusOf(r[c], 1)]++;
        assert.deepEqual(ov.distribution.data[c], want, `${label}, ${c}: fördelning`);
      }

      // Dagskurvan
      const series = await agg.getUnitCategorySeries(unitId, period);
      assert.deepEqual(series.map((p) => p.date), dates, `${label}: kurvans dagar`);
      for (const p of series) {
        const day = rows.filter((r) => r.date === p.date);
        const d = expectedAggregate(day);
        assert.equal(p.responders, d.responders, `${label}, ${p.date}: svar`);
        assert.equal(p.eligible, all, `${label}, ${p.date}: underlag`);
        if (d.responders < K) {
          assert.equal(p.scores, null, `${label}, ${p.date}: under tröskeln ska döljas`);
          assert.equal(p.overall, null);
        } else {
          for (const c of CATS) check(p.scores[c], d.sums[c], d.n, `${label}, ${p.date}, ${c}`);
          check(p.overall, d.total, d.n * 6, `${label}, ${p.date}, snitt`);
        }
      }
    }

    // Jämförelsen mellan Pluton 1:s grupper, plus raden för dem utan grupp
    const cmp = await agg.getChildComparison(org.pluton, period);
    const children = [
      ['Grupp A', org.grupper['Grupp A'], 8],
      ['Grupp B', org.grupper['Grupp B'], 8],
      ['Direkt i enheten', agg.DIRECT_MEMBERS_ID, 5],
    ];
    assert.equal(cmp.children.length, children.length, 'en rad per grupp och en för dem utan grupp');
    for (const [name, id, eligible] of children) {
      const label = `${name}, ${period} d`;
      const rows = inWindow.filter((r) => r.pluton === org.pluton && r.childName === name);
      const e = expectedAggregate(rows);
      const got = cmp.children.find((c) => c.id === id);
      assert.ok(got, `${label}: raden finns`);
      assert.equal(got.eligible, eligible, `${label}: antal`);
      assert.equal(got.responders, e.responders, `${label}: svarande`);
      if (e.responders < K) {
        assert.equal(got.overall, null, `${label}: ska döljas`);
      } else {
        check(got.overall, e.total, e.n * 6, `${label}, snitt`);
        assert.equal(got.status, statusOf(e.total, e.n * 6), `${label}: märke`);
        for (const c of CATS) check(got.scores[c], e.sums[c], e.n, `${label}, ${c}`);
        assert.deepEqual(
          { green: got.green, yellow: got.yellow, red: got.red },
          e.personStatus,
          `${label}: gröna/gula/röda`,
        );
      }

      // Gruppens dagskurva
      for (const row of cmp.series) {
        const day = expectedAggregate(rows.filter((r) => r.date === row.date));
        if (day.responders < K) {
          assert.equal(row[name], null, `${label}, ${row.date}: under tröskeln ska döljas`);
        } else {
          check(row[name], day.total, day.n * 6, `${label}, ${row.date}`);
        }
      }
    }
    assert.deepEqual(cmp.series.map((r) => r.date), dates, `jämförelsekurvans dagar, ${period} d`);

    // Kompaniets jämförelse: plutonerna ska vara sina egna helheter.
    const kcmp = await agg.getChildComparison(org.kompani, period);
    for (const [plutonId, name] of [[org.pluton, 'Pluton 1'], [pluton2, 'Pluton 2']]) {
      const e = expectedAggregate(inWindow.filter((r) => r.pluton === plutonId));
      const got = kcmp.children.find((c) => c.id === plutonId);
      check(got.overall, e.total, e.n * 6, `${name} i kompaniets jämförelse, ${period} d`);
    }
  }
});

test('avrundningen ger samma tal och färg som räknat för hand', async () => {
  /*
   * Fällor som slumpdata sällan träffar. Värdena är valda så att en avrundning
   * i två steg — först till två decimaler, sedan till en — ger fel siffra:
   *   6,2451 → 6,25 → "6,3"   (rätt: 6,2)
   *   6,9461 → 6,95 → "7,0" med gult märke   (rätt: 6,9, gult)
   * och så att en person med snittet exakt 6,95 visas som 7,0 och räknas grön.
   */
  const { client } = await database();
  const agg = await import('../src/lib/db/queries/aggregates.ts');
  const { formatScore } = await import('../src/lib/format.ts');
  const { getStatus } = await import('../src/lib/data.ts');
  const check = (value, sum, count, what) => assertShown({ value, formatScore, getStatus }, sum, count, what);

  const kompani = await insertUnit(client, 'Avrundning', 'kompani', null);
  const pluton = await insertUnit(client, 'Avrundningspluton', 'pluton', kompani);

  /** En grupp där alla svarar `base`, utom att person p får `adjust(p)` celler ±1. */
  async function group(name, persons, days, base, adjust) {
    const unit = await insertUnit(client, name, 'grupp', pluton);
    const raw = [];
    for (let p = 0; p < persons; p++) {
      const person = { id: await insertSoldier(client, unit), active: true };
      let left = Math.abs(adjust(p));
      const step = Math.sign(adjust(p));
      for (let d = 0; d < days; d++) {
        const values = Object.fromEntries(CATS.map((c) => {
          if (left > 0) { left--; return [c, base + step]; }
          return [c, base];
        }));
        await answer(client, raw, person, daysAgo(d), values);
      }
    }
    return { unit, raw };
  }

  // 17 svar, summa 612 + 25 = 637 av 102 celler → 6,2451
  const a = await group('Fälla 6,2451', 17, 1, 6, (p) => (p < 8 ? 2 : 1));
  // 34 svar, summa 1428 − 11 = 1417 av 204 celler → 6,9461
  const b = await group('Fälla 6,9461', 17, 2, 7, (p) => (p < 11 ? -1 : 0));
  // Fyra personer med 10 svar vardera, summa 420 − 3 = 417 av 60 celler → exakt 6,95
  const c = await group('Fälla 6,95', 4, 10, 7, () => -3);

  for (const { unit, raw, name } of [
    { ...a, name: '6,2451' },
    { ...b, name: '6,9461' },
  ]) {
    const e = expectedAggregate(raw);
    const ov = await agg.getUnitOverview(unit, 7);
    const header = Object.values(ov.categories.data).reduce((x, y) => x + y, 0) / 6;
    check(header, e.total, e.n * 6, `fälla ${name}: samlat snitt`);
    const today = (await agg.getUnitCategorySeries(unit, 7)).at(-1);
    const t = expectedAggregate(raw.filter((r) => r.date === TODAY));
    check(today.overall, t.total, t.n * 6, `fälla ${name}: dagens snitt`);
  }

  // 14 dagar: fällan med exakt 6,95 bygger på tio dagars svar.
  const cmp = await agg.getChildComparison(pluton, 14);
  for (const g of [a, b, c]) {
    const e = expectedAggregate(g.raw);
    const got = cmp.children.find((x) => x.id === g.unit);
    check(got.overall, e.total, e.n * 6, `jämförelse, enhet ${g.unit}`);
    assert.deepEqual({ green: got.green, yellow: got.yellow, red: got.red }, e.personStatus, `jämförelse, enhet ${g.unit}: personer`);
  }
});

test('den värnpliktiges egen sida stämmer med hens egna svar', async () => {
  const { client } = await database();
  const { org, raw } = await buildScenario(client);
  const { getOwnHistory, getOwnResponseFrequency } = await import('../src/lib/db/queries/checkins.ts');
  const { avgScore, getStatus } = await import('../src/lib/data.ts');
  const { formatScore } = await import('../src/lib/format.ts');
  const { ownTrend } = await import('../src/lib/own-trend.ts');

  const dates14 = windowDates(14);
  for (const id of [...org.soldater['Grupp A'], ...org.soldater['Grupp B']]) {
    const mine = raw.filter((r) => r.id === id && dates14.includes(r.date)).sort((x, y) => x.date.localeCompare(y.date));

    const history = await getOwnHistory(id, 14);
    assert.deepEqual(history.map((h) => h.serviceDate), mine.map((m) => m.date), 'historikens dagar');
    for (const [i, h] of history.entries()) {
      for (const c of CATS) assert.equal(h[c], mine[i][c], `${h.serviceDate}, ${c}`);
      const scores = Object.fromEntries(CATS.map((c) => [c, h[c]]));
      assertShown({ value: avgScore(scores), formatScore, getStatus }, rowSum(mine[i]), 6, `${h.serviceDate}: dagens snitt`);
    }

    const freq = await getOwnResponseFrequency(id, 14);
    assert.equal(freq.checkedIn, mine.length, 'antal incheckningar på 14 dagar');
    assert.equal(freq.pct, Math.round((mine.length / 14) * 100), 'svarsfrekvens');

    // Riktningen: de tre senaste svaren mot de tre dessförinnan.
    const s = mine.map(rowSum);
    const recent = s.slice(-3);
    const prev = s.slice(-6, -3);
    let want = 'neutral';
    if (recent.length >= 2 && prev.length >= 2) {
      // (medel(recent) - medel(prev)) / 6 jämfört med 0,3 — i heltal.
      const diff = recent.reduce((x, y) => x + y, 0) * prev.length - prev.reduce((x, y) => x + y, 0) * recent.length;
      const scale = 6 * recent.length * prev.length;
      if (diff * 10 > 3 * scale) want = 'up';
      else if (diff * 10 < -3 * scale) want = 'down';
    }
    assert.equal(ownTrend(history.map((h) => Object.fromEntries(CATS.map((c) => [c, h[c]])))), want, `riktning för ${id}`);
  }

  // "Hälsostatus idag" färgas efter visat snitt, inte efter ett heltal.
  // 6,5 är gult: gränsen för grönt är 7.
  const halv = { fysisk: 7, psykisk: 6, social: 7, somn: 6, kost: 7, energi: 6 };
  assert.equal(formatScore(avgScore(halv)), '6,5');
  assert.equal(getStatus(avgScore(halv)), 'yellow', '6,5 får inte avrundas upp till grönt');
  const lag = { fysisk: 4, psykisk: 3, social: 4, somn: 3, kost: 4, energi: 3 };
  assert.equal(getStatus(avgScore(lag)), 'red', '3,5 får inte avrundas upp till gult');
});

test('riktningen på egen sida vänder vid 0,3 — räknat för hand', async () => {
  const { ownTrend } = await import('../src/lib/own-trend.ts');
  const dag = (v, sista = v) => ({ fysisk: v, psykisk: v, social: v, somn: v, kost: v, energi: sista });

  const sex = [dag(6), dag(6), dag(6)];
  // Snitt 6,0 → 6,3 (summa 38 per dag): skillnad 0,33 — stigande.
  assert.equal(ownTrend([...sex, dag(6, 8), dag(6, 8), dag(6, 8)]), 'up');
  // 6,0 → 6,2 (summa 37): skillnad 0,17 — stabil.
  assert.equal(ownTrend([...sex, dag(6, 7), dag(6, 7), dag(6, 7)]), 'neutral');
  // 6,0 → 5,7 (summa 34): skillnad −0,33 — sjunkande.
  assert.equal(ownTrend([...sex, dag(6, 4), dag(6, 4), dag(6, 4)]), 'down');
  // För få svar att jämföra: alltid stabil, hur stor skillnaden än är.
  assert.equal(ownTrend([dag(2), dag(9), dag(9)]), 'neutral');
});
