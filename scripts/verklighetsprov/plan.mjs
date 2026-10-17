/**
 * Verklighetsprovets organisation, svarsplan och händelser.
 *
 * Allt bestäms i förväg och är detsamma vid varje körning (fast frö), så att
 * ett fel går att köra om och se igen. Facit (facit.mjs) räknas ur det här,
 * aldrig ur appen.
 *
 * Nycklar: en värnpliktig heter "1-2-3-04" — 1. kompani, 2. pluton,
 * 3. grupp, fjärde personen. Den som står direkt i en pluton har "D" i
 * stället för grupp. En enhet heter på samma sätt: "1-2-3" är gruppen,
 * "1-2" plutonen, "1" kompaniet och "" bataljonen.
 */

export const DAGAR = 14;
/** Dag 1. Efter den verkliga dagen, se klocka.mjs. Måndag. */
export const FORSTA_DAGEN = '2026-11-02';

/** Samma ordning och namn som CATEGORIES i src/lib/data.ts. */
export const KATEGORIER = [
  { key: 'fysisk', label: 'Fysisk form' },
  { key: 'halsa', label: 'Friskhet' },
  { key: 'psykisk', label: 'Psykiskt mående' },
  { key: 'social', label: 'Social trivsel' },
  { key: 'somn', label: 'Sömn' },
  { key: 'kost', label: 'Kost och näring' },
  { key: 'energi', label: 'Energinivå' },
];

/** ÅÅÅÅ-MM-DD för dag 1–14. */
export function datum(dag) {
  const [y, m, d] = FORSTA_DAGEN.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + dag - 1)).toISOString().slice(0, 10);
}

/*
 * Bataljonen finns från början ("1. bataljon"). Administratören bygger
 * resten i gränssnittet. Specialfallen:
 *  - 1. kompani, 1. pluton, 3. grupp har tre personer: alltid dold.
 *  - 1. kompani, 1. pluton har en sjukvårdare direkt i plutonen.
 *  - 1. kompani, 3. pluton, 3. grupp är tom.
 */
export const ORGANISATION = [
  {
    namn: '1. kompani',
    plutoner: [
      { namn: '1. pluton', historia: 'somn', grupper: [8, 8, 3], direkt: ['Sjukvårdare'] },
      { namn: '2. pluton', historia: 'stabil', grupper: [7, 7, 7], direkt: [] },
      { namn: '3. pluton', historia: 'bra', grupper: [8, 8, 0], direkt: [] },
    ],
  },
  {
    namn: '2. kompani',
    plutoner: [
      { namn: '1. pluton', historia: 'forkylning', grupper: [6, 6], direkt: [] },
      { namn: '2. pluton', historia: 'gransfall', grupper: [6, 5], direkt: [] },
    ],
  },
];

/** Enheterna, i den ordning administratören skapar dem. */
export function enheter() {
  const ut = [{ nyckel: '', namn: '1. bataljon', sort: 'bataljon', foralder: null }];
  ORGANISATION.forEach((k, ki) => {
    const kn = `${ki + 1}`;
    ut.push({ nyckel: kn, namn: k.namn, sort: 'kompani', foralder: '' });
    k.plutoner.forEach((p, pi) => {
      const pn = `${kn}-${pi + 1}`;
      ut.push({ nyckel: pn, namn: p.namn, sort: 'pluton', foralder: kn, historia: p.historia, direkt: p.direkt });
      p.grupper.forEach((antal, gi) => {
        ut.push({ nyckel: `${pn}-${gi + 1}`, namn: `${gi + 1}. grupp`, sort: 'grupp', foralder: pn, antal });
      });
    });
  });
  return ut;
}

/** De värnpliktiga som finns från dag 1, med enhet. */
export function ursprungligaPersoner() {
  const ut = [];
  for (const e of enheter()) {
    if (e.sort === 'grupp') {
      for (let i = 1; i <= e.antal; i++) ut.push({ nyckel: `${e.nyckel}-${String(i).padStart(2, '0')}`, enhet: e.nyckel, skapad: 1 });
    }
    if (e.sort === 'pluton') {
      e.direkt.forEach((_, i) => ut.push({ nyckel: `${e.nyckel}-D-${String(i + 1).padStart(2, '0')}`, enhet: e.nyckel, skapad: 1 }));
    }
  }
  return ut;
}

/** Befälen: ett per kompani och pluton, och bataljonschefen. */
export function befal() {
  return enheter()
    .filter((e) => e.sort !== 'grupp')
    .map((e) => ({
      nyckel: `BEF:${e.nyckel || 'B'}`,
      enhet: e.nyckel,
      sort: e.sort,
      roll: { bataljon: 'Bataljonschef', kompani: 'Kompanichef', pluton: 'Plutonchef' }[e.sort],
    }));
}

/*
 * Händelser, som de sker en vanlig vecka. Administratörens åtgärder görs
 * före dagens incheckningar.
 */
export const HANDELSER = [
  { dag: 3, typ: 'rattelse', person: '1-2-2-03' },
  { dag: 5, typ: 'nyKod', person: '1-2-1-04' },
  { dag: 6, typ: 'flytt', person: '1-3-2-08', till: '1-3-1' },
  { dag: 8, typ: 'ny', nyckel: '1-1-1-NY', enhet: '1-1-1' },
  { dag: 9, typ: 'sparr', person: '2-2-2-05' },
  { dag: 11, typ: 'fa', grupp: '2-1-1', antal: 3 },
];

/** Svarar aldrig. */
const ALDRIG = new Set(['1-2-3-07']);
/** Svarar sällan. */
const SALLAN = new Set(['1-3-1-02', '2-1-2-06']);

/* Fast frö: samma svar varje körning. */
function slump(fro) {
  let a = fro >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const klampa = (v) => Math.min(10, Math.max(1, Math.round(v)));

/** Plutonens historia: förskjutning per kategori en viss dag. */
function historia(namn, dag) {
  const efter = (fran) => (dag >= fran ? 1 : 0);
  switch (namn) {
    case 'somn':
      // Sömnen och orken sjunker under två veckor.
      return { somn: -0.3 * (dag - 1), energi: -0.18 * (dag - 1), kost: -1 };
    case 'stabil':
      return { psykisk: -0.08 * (dag - 1) };
    case 'bra':
      return { fysisk: 1.4, halsa: 1.4, psykisk: 1.4, social: 1.6, somn: 0.9, kost: 1.2, energi: 1.2 };
    case 'forkylning':
      // En förkylning från dag 9.
      return { halsa: -3.2 * efter(9), energi: -1.6 * efter(9) };
    case 'gransfall':
      return { somn: -2 };
    default:
      return {};
  }
}

/**
 * Hela svarsplanen: svar[dag][person] = poäng per kategori, eller null.
 * Svaren är de slutliga (efter en rättelse). `forstaSvar` är det som skickades
 * före rättelsen.
 */
export function svarsplan() {
  const r = slump(20261102);
  const personer = [...ursprungligaPersoner(), { nyckel: '1-1-1-NY', enhet: '1-1-1', skapad: 8 }];
  const grund = Object.fromEntries(
    personer.map((p) => [p.nyckel, Object.fromEntries(KATEGORIER.map((k) => [k.key, 6 + (r() - 0.5) * 2.6]))]),
  );
  const pluton = (nyckel) => nyckel.split('-').slice(0, 2).join('-');
  const plutonHistoria = Object.fromEntries(enheter().filter((e) => e.sort === 'pluton').map((e) => [e.nyckel, e.historia]));

  const svar = {};
  for (let dag = 1; dag <= DAGAR; dag++) {
    svar[dag] = {};
    for (const p of personer) {
      let svarar = r() < (SALLAN.has(p.nyckel) ? 0.4 : 0.86);
      if (ALDRIG.has(p.nyckel)) svarar = false;
      if (dag < p.skapad) svarar = false;
      if (p.nyckel === '2-2-2-05' && dag >= 9) svarar = false; // spärrad dag 9
      const h = historia(plutonHistoria[pluton(p.nyckel)], dag);
      const poang = Object.fromEntries(
        KATEGORIER.map((k) => [k.key, klampa(grund[p.nyckel][k.key] + (h[k.key] ?? 0) + (r() - 0.5) * 2.2)]),
      );
      svar[dag][p.nyckel] = svarar ? poang : null;
    }
  }

  // Dag 11 svarar bara tre i 2. kompani, 1. pluton, 1. grupp.
  const faDag = HANDELSER.find((h) => h.typ === 'fa');
  const iGruppen = personer.filter((p) => p.enhet === faDag.grupp).map((p) => p.nyckel);
  iGruppen.forEach((n, i) => {
    if (i < faDag.antal) svar[faDag.dag][n] ??= Object.fromEntries(KATEGORIER.map((k) => [k.key, 6]));
    else svar[faDag.dag][n] = null;
  });

  /*
   * Gränsfallet: 2. kompani, 2. pluton, 1. grupp svarar dag 8–14 alla
   * utom två gånger, 40 svar, och sömnen summeras till 158. Snittet blir
   * exakt 3,95, som ska visas som 4,0 och gult — aldrig 3,9 eller rött.
   */
  const gransGrupp = personer.filter((p) => p.enhet === '2-2-1').map((p) => p.nyckel);
  const saknas = new Set(['2-2-1-01:9', '2-2-1-02:12']);
  const gransSvar = [];
  for (let dag = 8; dag <= 14; dag++) {
    for (const n of gransGrupp) {
      if (saknas.has(`${n}:${dag}`)) {
        svar[dag][n] = null;
        continue;
      }
      svar[dag][n] ??= Object.fromEntries(KATEGORIER.map((k) => [k.key, 5]));
      gransSvar.push(svar[dag][n]);
    }
  }
  let summa = gransSvar.reduce((s, x) => s + x.somn, 0);
  for (let i = 0; summa !== 158; i = (i + 1) % gransSvar.length) {
    const x = gransSvar[i];
    if (summa < 158 && x.somn < 10) { x.somn += 1; summa += 1; }
    else if (summa > 158 && x.somn > 1) { x.somn -= 1; summa -= 1; }
  }

  // Rättelsen dag 3: först skickas andra svar, sedan de slutliga.
  const ratt = HANDELSER.find((h) => h.typ === 'rattelse');
  svar[ratt.dag][ratt.person] ??= Object.fromEntries(KATEGORIER.map((k) => [k.key, 6]));
  const slutligt = svar[ratt.dag][ratt.person];
  const forstaSvar = Object.fromEntries(KATEGORIER.map((k) => [k.key, slutligt[k.key] >= 6 ? slutligt[k.key] - 4 : slutligt[k.key] + 4]));

  return { svar, forstaSvar: { [`${ratt.dag}:${ratt.person}`]: forstaSvar }, personer };
}
