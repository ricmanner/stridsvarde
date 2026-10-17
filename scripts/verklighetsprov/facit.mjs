/**
 * Facit för verklighetsprovet: varje tal befälen och de värnpliktiga borde
 * se, räknat direkt ur svarsplanen (plan.mjs). Ingenting här läser appens
 * kod eller databas — det är hela poängen. Reglerna är de appen säger att
 * den följer:
 *
 *  - Organisationen som den ser ut idag: en flyttad persons alla svar räknas
 *    i den nya gruppen, och en spärrad person räknas inte alls.
 *  - Ett snitt visas bara när minst fyra personer svarat och enheten har
 *    minst fyra (K). En dag i kurvan visas när minst fyra svarat den dagen.
 *  - Talen räknas med full precision och avrundas en gång till en decimal;
 *    färgen bedöms på det avrundade talet (grön från 7, gul från 4).
 *  - Antal i rött per underenhet visas inte när någon underenhet är dold
 *    (1–3 svarande).
 */
import { DAGAR, HANDELSER, KATEGORIER, datum, enheter } from './plan.mjs';

export const K = 4;

// ── Format, som appen skriver talen ─────────────────────────────────────────

export const roundScore = (n) => Math.round(n * 10 + 1e-9) / 10;
export const formatScore = (n) =>
  roundScore(n).toLocaleString('sv-SE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
export const procent = (n) => `${n} %`;
export const status = (n) => (roundScore(n) >= 7 ? 'GRÖN' : roundScore(n) >= 4 ? 'GUL' : 'RÖD');
const medel = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const kortDatum = (iso) => {
  const [, m, d] = iso.split('-');
  return `${Number(d)}/${Number(m)}`;
};

export function forandring(nu, forra) {
  const steg = Math.round((roundScore(nu) - roundScore(forra)) * 10) / 10;
  if (steg <= -0.5) return `↓ ${formatScore(-steg)}`;
  if (steg >= 0.5) return `↑ ${formatScore(steg)}`;
  return `${steg === 0 ? '±' : steg > 0 ? '+' : '−'}${formatScore(Math.abs(steg))}`;
}

export function uppräkningSamt(namn) {
  if (namn.length <= 1) return namn[0] ?? '';
  const binde = namn.some((n) => n.includes(' och ')) ? ' samt ' : ' och ';
  return `${namn.slice(0, -1).join(', ')}${binde}${namn.at(-1)}`;
}

// ── Läget en viss dag ───────────────────────────────────────────────────────

/** Vilka som finns och var, efter dagens händelser. */
export function lage(plan, dag) {
  const enhet = Object.fromEntries(plan.personer.map((p) => [p.nyckel, p.enhet]));
  const aktiv = Object.fromEntries(plan.personer.map((p) => [p.nyckel, p.skapad <= dag]));
  for (const h of HANDELSER) {
    if (h.dag > dag) continue;
    if (h.typ === 'flytt') enhet[h.person] = h.till;
    if (h.typ === 'sparr') aktiv[h.person] = false;
  }
  return { enhet, aktiv };
}

const inom = (enhetsNyckel, under) =>
  under === '' || enhetsNyckel === under || enhetsNyckel.startsWith(`${under}-`);

function medlemmar(plan, l, under, bara = null) {
  return plan.personer
    .map((p) => p.nyckel)
    .filter((n) => l.aktiv[n] && (bara ? bara(l.enhet[n]) : inom(l.enhet[n], under)));
}

/** Fullständiga rapporter från personerna, dag från–till. */
function rapporter(plan, personer, fran, till) {
  const ut = [];
  for (let d = Math.max(1, fran); d <= till; d++) {
    for (const n of personer) {
      const s = plan.svar[d]?.[n];
      if (s) ut.push({ person: n, dag: d, s, samlat: medel(KATEGORIER.map((k) => s[k.key])) });
    }
  }
  return ut;
}

function sammanstall(rader) {
  const personer = [...new Set(rader.map((r) => r.person))];
  return {
    svarande: personer.length,
    kat: Object.fromEntries(KATEGORIER.map((k) => [k.key, rader.length ? medel(rader.map((r) => r.s[k.key])) : null])),
    samlat: rader.length ? medel(rader.map((r) => r.samlat)) : null,
    perPerson: personer.map((p) => {
      const egna = rader.filter((r) => r.person === p);
      return {
        samlat: medel(egna.map((r) => r.samlat)),
        kat: Object.fromEntries(KATEGORIER.map((k) => [k.key, medel(egna.map((r) => r.s[k.key]))])),
      };
    }),
  };
}

// ── En enhet, en period ─────────────────────────────────────────────────────

/**
 * Allt en befälsvy och dess rapport borde visa för enheten `under`, perioden
 * `period` dagar som slutar `dag`.
 */
export function befalsvy(plan, under, period, dag = DAGAR) {
  const l = lage(plan, dag);
  const fran = dag - period + 1;
  const med = medlemmar(plan, l, under);
  const antal = med.length;
  const period_ = sammanstall(rapporter(plan, med, fran, dag));
  const ok = antal >= K && period_.svarande >= K;

  const idag = new Set(rapporter(plan, med, dag, dag).map((r) => r.person)).size;
  const roda = ok ? KATEGORIER.filter((k) => status(period_.kat[k.key]) === 'RÖD') : [];

  const personer = { GRÖN: 0, GUL: 0, RÖD: 0 };
  for (const p of period_.perPerson) personer[status(p.samlat)] += 1;
  const total = Math.max(antal, period_.svarande);
  const utan = total - period_.svarande;

  const forraRader = sammanstall(rapporter(plan, med, fran - period, fran - 1));
  const forraOk = forraRader.svarande >= K && antal >= K;

  // ── Nyckeltal ──
  const nyckeltal = {
    'Samlat mående': ok
      ? { varde: `${formatScore(period_.samlat)} ${status(period_.samlat)}`, under: `snitt ${period} dagar` }
      : { varde: '–', under: 'underlag saknas' },
    'Svarat idag': { varde: procent(antal ? Math.round((idag / antal) * 100) : 0), under: `${idag} av ${antal}` },
    'Personer i rött': ok
      ? { varde: String(personer.RÖD), under: `av ${total}, på samlat snitt${utan > 0 ? ` · ${utan} utan svar` : ''}` }
      : { varde: '–', under: 'underlag saknas' },
    'Kategorier i rött': ok
      ? { varde: String(roda.length), under: roda.length ? uppräkningSamt(roda.map((k) => k.label.toLowerCase())) : `av ${KATEGORIER.length}` }
      : { varde: '–', under: 'underlag saknas' },
  };

  // ── Kategoritabellen, sämst först ──
  const kategorier = ok
    ? [...KATEGORIER]
        .sort((a, b) => roundScore(period_.kat[a.key]) - roundScore(period_.kat[b.key]))
        .map((k) => {
          const v = period_.kat[k.key];
          const forra = forraOk ? forraRader.kat[k.key] : null;
          const iRott = period_.perPerson.filter((p) => roundScore(p.kat[k.key]) < 4).length;
          return {
            kategori: k.label,
            snitt: formatScore(v),
            status: status(v),
            forandring: forra === null ? '–' : forandring(v, forra),
            forandringRapport: forra === null ? '—' : `${forandring(v, forra)} från ${formatScore(forra)}`,
            iRott: `${iRott} av ${period_.svarande}`,
          };
        })
    : null;
  const harForra = ok && forraOk;

  // ── Dag för dag ──
  const dagar = [];
  for (let d = fran; d <= dag; d++) {
    const rad = sammanstall(rapporter(plan, med, d, d));
    const syns = rad.svarande >= K;
    dagar.push({
      datum: datum(d),
      svarande: rad.svarande,
      antal,
      kat: syns ? rad.kat : null,
      samlat: syns ? rad.samlat : null,
    });
  }
  const trender = [...dagar].reverse().map((d) => [
    kortDatum(d.datum),
    `${d.svarande}/${d.antal}`,
    procent(d.antal ? Math.round((d.svarande / d.antal) * 100) : 0),
    d.samlat === null ? '—' : formatScore(d.samlat),
  ]);

  // ── Jämförelse mellan underenheterna ──
  const barn = enheter()
    .filter((e) => e.foralder === under)
    .sort((a, b) => (a.namn < b.namn ? -1 : a.namn > b.namn ? 1 : 0));
  const direkta = medlemmar(plan, l, under, (e) => e === under);
  const rader = barn.map((b) => ({ namn: b.namn, ...underenhet(plan, medlemmar(plan, l, b.nyckel), fran, dag) }));
  // Personer direkt i enheten får en egen rad, sist — bara när de finns.
  if (direkta.length > 0) rader.push({ namn: 'Direkt i enheten', direkt: true, ...underenhet(plan, direkta, fran, dag) });
  const dolda = rader.filter((r) => r.svarande >= 1 && r.svarande < K).length;
  for (const r of rader) {
    if (r.syns && dolda === 0) r.roda = r.personerRoda;
    else r.roda = null;
  }
  const visaIRott = rader.some((r) => r.syns && r.roda !== null);
  const ental = { '': 'kompani', 1: 'pluton', 2: 'pluton' }[under] ?? 'grupp';

  const jamforelse = rader.map((r) => {
    const namn = r.direkt ? `${r.namn} utan ${ental}` : r.namn;
    if (!r.syns) {
      return [namn, `${r.svarande}/${r.antal}`, r.antal === 0 ? 'Inga värnpliktiga placerade här ännu' : 'Underlag saknas — för få svar för att visa något'];
    }
    return [
      namn,
      `${r.svarande}/${r.antal}`,
      ...(visaIRott ? [`${r.roda} av ${r.svarande}`] : []),
      formatScore(r.samlat),
      ...KATEGORIER.map((k) => formatScore(r.kat[k.key])),
    ];
  });

  // ── Rapporten ──
  const svarIPerioden = dagar.reduce((s, d) => s + d.svarande, 0);
  const rapport = {
    rutor: {
      'Samlat mående': ok ? { varde: formatScore(period_.samlat), under: `${status(period_.samlat)} · snitt ${period} dagar` } : null,
      'Svarade i snitt': {
        varde: procent(antal > 0 ? Math.round((svarIPerioden / (antal * period)) * 100) : 0),
        under: `av ${antal} varje dag`,
      },
      'Personer i rött': ok
        ? { varde: String(personer.RÖD), under: `av ${total}, på samlat snitt${utan > 0 ? ` · ${utan} utan svar` : ''}` }
        : { varde: '—', under: 'underlag saknas' },
      'Kategorier i rött': {
        varde: String(roda.length),
        under: roda.length ? uppräkningSamt(roda.map((k) => k.label.toLowerCase())) : `av ${KATEGORIER.length}`,
      },
    },
    kategorier: kategorier?.map((k) => [k.kategori, k.snitt, k.status, k.forandringRapport, k.iRott]) ?? null,
    underenheter: rader.map((r) => {
      if (!r.syns) return [r.namn, `${r.svarande}/${r.antal}`, r.antal === 0 ? 'Inga värnpliktiga placerade här ännu' : 'Underlag saknas'];
      return [
        r.namn,
        `${r.svarande}/${r.antal}`,
        ...(visaIRott ? [r.roda === null ? '—' : `${r.roda} av ${r.svarande}`] : []),
        formatScore(r.samlat),
        ...KATEGORIER.map((k) => formatScore(r.kat[k.key])),
      ];
    }),
    dagForDag: [...dagar].reverse().map((d) => [d.datum, `${d.svarande}/${d.antal}`, d.samlat === null ? '—' : formatScore(d.samlat)]),
  };

  // ── Exporten ──
  const csvTal = (v) => (v === null || v === undefined ? '' : formatScore(v));
  const csvDagar = [
    ['Datum', 'Svarande', 'Av totalt', ...KATEGORIER.map((k) => k.label), 'Snitt'],
    ...dagar.map((d) => [d.datum, String(d.svarande), String(d.antal), ...KATEGORIER.map((k) => csvTal(d.kat?.[k.key])), csvTal(d.samlat)]),
  ];
  const csvEnheter = [
    ['Enhet', 'Värnpliktiga', 'Svarande', ...KATEGORIER.map((k) => k.label), 'Snitt', 'Gröna', 'Gula', 'Röda'],
    ...rader.map((r) => [
      r.namn,
      String(r.antal),
      String(r.svarande),
      ...KATEGORIER.map((k) => (r.syns ? formatScore(r.kat[k.key]) : '')),
      r.syns ? formatScore(r.samlat) : '',
      ...(r.syns && dolda === 0 ? [String(r.farger.GRÖN), String(r.farger.GUL), String(r.farger.RÖD)] : ['', '', '']),
    ]),
  ];

  return { antal, ok, nyckeltal, kategorier, harForra, trender, jamforelse, visaIRott, rapport, csvDagar, csvEnheter };
}

function underenhet(plan, personer, fran, dag) {
  const s = sammanstall(rapporter(plan, personer, fran, dag));
  const farger = { GRÖN: 0, GUL: 0, RÖD: 0 };
  for (const p of s.perPerson) farger[status(p.samlat)] += 1;
  return {
    antal: personer.length,
    svarande: s.svarande,
    syns: s.svarande >= K,
    kat: s.kat,
    samlat: s.samlat,
    personerRoda: farger.RÖD,
    farger,
  };
}

// ── Den värnpliktiges egen vy ───────────────────────────────────────────────

/** Det en värnpliktig ser på sin översikt efter dagens incheckning. */
export function egenVy(plan, person, dag = DAGAR) {
  const s = plan.svar[dag][person];
  const p = plan.personer.find((x) => x.nyckel === person);
  const fran = dag - 13;
  let incheckade = 0;
  let forsta = null;
  for (let d = 1; d <= dag; d++) {
    if (plan.svar[d]?.[person]) {
      forsta ??= d;
      if (d >= fran) incheckade += 1;
    }
  }
  const borjade = Math.min(p.skapad, forsta ?? p.skapad);
  const total = Math.min(14, Math.max(1, dag - Math.max(borjade, fran) + 1));
  return {
    samlat: formatScore(medel(KATEGORIER.map((k) => s[k.key]))),
    frekvens: procent(Math.round((incheckade / total) * 100)),
    frekvensUnder: `${incheckade} av ${total} ${total === 1 ? 'dag' : 'dagar'}`,
  };
}
