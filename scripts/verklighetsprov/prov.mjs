/**
 * Verklighetsprovet: ett kompani som använder appen på riktigt, i fjorton
 * dagar, mot en tom lokal installation.
 *
 *   npm run verklighetsprov
 *
 * Administratören bygger organisationen i gränssnittet och delar ut koder.
 * De värnpliktiga loggar in och checkar in dag för dag enligt svarsplanen
 * (plan.mjs), med de händelser som hör till en vanlig vecka. Sist loggar
 * varje befäl in, och varje tal på skärmen, i rapporten och i exporten
 * jämförs mot facit (facit.mjs), som räknats utan appens kod.
 *
 * Ingenting görs via databasen. Det enda som inte är som på riktigt är
 * datumet: servern startas om varje dag med en framflyttad klocka
 * (klocka.mjs), eftersom appen bara tar emot dagens incheckning.
 *
 * Resultatet hamnar i .playwright-mcp/verklighetsprov/ (lokalt, utanför
 * förrådet): resultat.json, index.html och bilder vid varje fel.
 */
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { chromium } from 'playwright';

import { befalsvy, egenVy } from './facit.mjs';
import { DAGAR, HANDELSER, KATEGORIER, befal, datum, enheter, svarsplan } from './plan.mjs';

const ROT = path.resolve(import.meta.dirname, '../..');
const UT = path.join(ROT, '.playwright-mcp/verklighetsprov');
const DB = path.join(tmpdir(), 'psvi-verklighetsprov.db');
const PORT = 3200;
const BAS = `http://localhost:${PORT}`;
const SAMTIDIGA = Number(process.env.PROV_SAMTIDIGA) || 4;
/** För felsökning: stanna efter den här dagen, utan befälens kontroll. */
const TILL_DAG = Number(process.env.PROV_TILL_DAG) || DAGAR;

/*
 * Miljön. DATABASE_URL sätts uttryckligen till något som inte är en
 * fjärrdatabas, så att provet aldrig kan hamna i den delade demons databas
 * även om någon lägger adressen i .env.
 */
const MILJO = {
  ...process.env,
  DATABASE_URL: 'lokal-verklighetsprov',
  DATABASE_AUTH_TOKEN: 'ingen',
  DATABASE_PATH: DB,
  PSVI_ENVIRONMENT: 'pilot',
  SEED_DEMO_DATA: 'false',
  MIN_RESPONDERS: '4',
  RETENTION_DAYS: '',
  AUTH_PEPPER: 'verklighetsprov-peppar-som-ar-tillrackligt-lang-0123456789',
  NODE_OPTIONS: `--import ${pathToFileURL(path.join(import.meta.dirname, 'klocka.mjs')).href}`,
};

const plan = svarsplan();
const resultat = [];
const fel = [];
let felbild = 0;

function logg(...delar) {
  console.log(`[${new Date().toLocaleTimeString('sv-SE')}]`, ...delar);
}

/** En kontroll: facit mot det som visades. */
function kontroll(omrade, vad, facit, visat) {
  const a = JSON.stringify(facit);
  const b = JSON.stringify(visat);
  const ok = a === b;
  resultat.push({ omrade, vad, facit, visat, ok });
  if (!ok) fel.push({ omrade, vad, facit, visat });
  return ok;
}

// ── Servern ─────────────────────────────────────────────────────────────────

let server = null;

async function startaServer(dag) {
  await stoppaServer();
  server = spawn('npx', ['next', 'start', '-p', String(PORT)], {
    cwd: ROT,
    env: { ...MILJO, PROV_IDAG: datum(dag) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let utskrift = '';
  server.stdout.on('data', (d) => (utskrift += d));
  server.stderr.on('data', (d) => (utskrift += d));
  for (let i = 0; i < 120; i++) {
    try {
      const svar = await fetch(`${BAS}/api/halsa`);
      if (svar.ok) return;
    } catch {
      /* inte uppe än */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Servern startade inte:\n${utskrift.slice(-2000)}`);
}

async function stoppaServer() {
  if (!server) return;
  const s = server;
  server = null;
  s.kill('SIGTERM');
  await new Promise((r) => s.once('exit', r));
  // next start lämnar ibland en barnprocess kvar på porten.
  try {
    execFileSync('sh', ['-c', `lsof -ti:${PORT} | xargs kill 2>/dev/null || true`]);
  } catch {
    /* ingen kvar */
  }
}

// ── Webbläsaren ─────────────────────────────────────────────────────────────

let browser = null;
/** Dagen som spelas just nu — webbläsarens klocka följer serverns. */
let aktuellDag = 1;

async function nySida(bredd = 1280) {
  const ctx = await browser.newContext({ viewport: { width: bredd, height: 900 }, locale: 'sv-SE', timezoneId: 'Europe/Stockholm' });
  await ctx.addInitScript(installeraSynligText);
  /*
   * Samma datum i webbläsaren som i servern (08.00 svensk tid, sedan går
   * klockan). Med webbläsarens riktiga datum föll incheckningen med React-fel
   * 441 — sidan ritades med ett datum i servern och ett annat i webbläsaren.
   */
  await ctx.clock.install({ time: new Date(`${datum(aktuellDag)}T06:00:00Z`) });
  const page = await ctx.newPage();
  page.setDefaultTimeout(30_000);
  // Webbläsarens egna felmeddelanden, så att ett misslyckande går att förklara.
  page.felLogg = [];
  page.on('pageerror', (e) => page.felLogg.push(`sidfel: ${e.message}`.slice(0, 400)));
  page.on('console', (m) => m.type() === 'error' && page.felLogg.push(`konsol: ${m.text()}`.slice(0, 400)));
  page.on('response', (r) => r.status() >= 400 && page.felLogg.push(`svar ${r.status()}: ${r.url()}`.slice(0, 300)));
  return { ctx, page };
}

async function loggaIn(page, kod) {
  await page.goto(`${BAS}/`);
  await page.locator('input[name="code"]').fill(kod);
  await page.getByRole('button', { name: 'Logga in' }).click();
  await page.waitForURL((u) => u.pathname !== '/', { timeout: 30_000 });
  await page.waitForLoadState('networkidle');
}

/** Ett försök som ska misslyckas: sidan står kvar på inloggningen. */
async function inloggningNekas(page, kod) {
  await page.goto(`${BAS}/`);
  await page.locator('input[name="code"]').fill(kod);
  await page.getByRole('button', { name: 'Logga in' }).click();
  await page.waitForTimeout(2500);
  return new URL(page.url()).pathname === '/';
}

async function bild(page, namn) {
  felbild += 1;
  const fil = `fel-${String(felbild).padStart(3, '0')}-${namn.replace(/[^\wåäöÅÄÖ-]+/g, '-')}.png`;
  await page.screenshot({ path: path.join(UT, fil), fullPage: true }).catch(() => {});
  return fil;
}

/**
 * Synlig text i ett element: textnoder som syns, utan det som bara finns för
 * skärmläsare (sr-only). innerText räknar med sr-only, och då skulle
 * uppräkningens två exemplar av samma tal läsas som "4,74,7".
 *
 * Läggs in i varje sida som window.__synlig, så att den går att använda
 * inifrån evaluate och evaluateAll.
 */
function installeraSynligText() {
  window.__synlig = (el) => {
    if (!el) return '';
    /*
     * Textbitar i samma element sätts ihop som de står: "{svarande}/{antal}"
     * är tre textnoder, "71", "/" och "80", och ska läsas "71/80". Mellan
     * olika element läggs ett mellanslag: talet och märket bredvid.
     */
    let ut = '';
    let forra = null;
    const ga = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = ga.nextNode(); n; n = ga.nextNode()) {
      const p = n.parentElement;
      if (!p || p.closest('.sr-only') || !p.checkVisibility()) continue;
      if (forra && forra !== p) ut += ' ';
      ut += n.textContent;
      forra = p;
    }
    return ut.replace(/\s+/g, ' ').trim();
  };
}

async function synlig(locator) {
  return locator.evaluate((el) => window.__synlig(el));
}

/** Raderna i en tabell, cell för cell, som synlig text. */
async function tabellrader(locator) {
  return locator.evaluate((tabell) =>
    [...tabell.querySelectorAll('tbody tr')].map((tr) => [...tr.children].map((c) => window.__synlig(c))),
  );
}

// ── Administratören ─────────────────────────────────────────────────────────

const KOD = /[A-Z2-9]{5}-[A-Z2-9]{5}/;
/** enhetsnyckel → id i appen. */
const enhetsId = {};
/** person- eller befälsnyckel → { kod, benamning, enhet } */
const konton = {};

async function adminSida(page, id) {
  await page.goto(`${BAS}/admin?unit=${id}`);
  await page.waitForLoadState('networkidle');
}

/** Läser kodlappen och stänger den. */
async function lasKodlapp(page) {
  await page.getByText(KOD).first().waitFor({ timeout: 30_000 });
  const lappar = await page.locator('p.font-mono').evaluateAll((ps) =>
    ps.map((p) => ({ kod: p.textContent.trim(), benamning: p.previousElementSibling?.textContent.trim() ?? '' })),
  );
  await page.getByRole('button', { name: 'Stäng' }).click();
  await page.getByText(KOD).first().waitFor({ state: 'detached' });
  return lappar;
}

/**
 * Id:n för enheterna i trädet som heter `namn`. Länkens namn är också
 * nivåns kortform och antal personer ("BAT 1. bataljon 12 vpl"), så själva
 * enhetsnamnet läses ur sitt eget fält.
 */
async function enhetsIdn(page, namn) {
  return page.locator('a[href*="/admin?unit="]').evaluateAll(
    (as, n) => as.filter((a) => a.querySelector('.truncate')?.textContent.trim() === n).map((a) => Number(new URL(a.href).searchParams.get('unit'))),
    namn,
  );
}

async function skapaEnhet(page, foralderId, namn) {
  await adminSida(page, foralderId);
  await page.getByLabel('Namn', { exact: true }).fill(namn);
  await page.getByRole('button', { name: 'Skapa', exact: true }).click();
  await page.getByText(`Skapade ${namn}.`).waitFor();
  // Den nya enheten är den med högst id bland länkarna med det namnet.
  return Math.max(...(await enhetsIdn(page, namn)));
}

async function skapaVarnpliktiga(page, id, antal) {
  await adminSida(page, id);
  await page.getByLabel('Antal värnpliktiga').fill(String(antal));
  await page.getByRole('button', { name: /Skapa värnpliktiga och koder/ }).click();
  return lasKodlapp(page);
}

async function skapaDirekt(page, plutonId, benamning) {
  await adminSida(page, plutonId);
  await page.getByRole('button', { name: 'Lägg till värnpliktiga direkt i plutonen' }).click();
  const form = page.locator('form', { has: page.getByText('Antal', { exact: true }) }).last();
  await form.getByLabel('Antal', { exact: true }).fill('1');
  await form.getByLabel('Benämning', { exact: true }).fill(benamning);
  await form.getByRole('button', { name: 'Skapa', exact: true }).click();
  return lasKodlapp(page);
}

async function skapaBefal(page, id) {
  await adminSida(page, id);
  await page.getByRole('button', { name: 'Lägg till befäl' }).click();
  return lasKodlapp(page);
}

/** Raden för en person i adminvyn. */
function personrad(page, benamning) {
  return page
    .locator('div')
    .filter({ has: page.locator('button[title="Byt benämning"]', { hasText: new RegExp(`^${benamning}$`) }) })
    .filter({ has: page.getByRole('button', { name: /Spärra|Aktivera/ }) })
    .last();
}

async function byggOrganisation(page) {
  await page.waitForLoadState('networkidle');
  [enhetsId['']] = await enhetsIdn(page, '1. bataljon');
  if (!enhetsId['']) throw new Error('Hittar inte 1. bataljon i adminvyn');

  for (const e of enheter()) {
    if (e.nyckel === '') continue;
    enhetsId[e.nyckel] = await skapaEnhet(page, enhetsId[e.foralder], e.namn);
    logg('  skapade', e.namn, `(${e.nyckel})`);
  }
  for (const e of enheter()) {
    if (e.sort === 'grupp' && e.antal > 0) {
      const lappar = await skapaVarnpliktiga(page, enhetsId[e.nyckel], e.antal);
      kontroll('admin', `antal koder för ${e.nyckel}`, e.antal, lappar.length);
      lappar.forEach((l, i) => {
        konton[`${e.nyckel}-${String(i + 1).padStart(2, '0')}`] = { ...l, enhet: e.nyckel };
      });
    }
    if (e.sort === 'pluton') {
      for (const [i, namn] of (e.direkt ?? []).entries()) {
        const [lapp] = await skapaDirekt(page, enhetsId[e.nyckel], namn);
        // Appen numrerar som för värnpliktiga: "Sjukvårdare 01".
        kontroll('admin', `direktplacerad i ${e.nyckel}`, `${namn} 01`, lapp.benamning);
        konton[`${e.nyckel}-D-${String(i + 1).padStart(2, '0')}`] = { ...lapp, enhet: e.nyckel };
      }
    }
  }
  for (const b of befal()) {
    const [lapp] = await skapaBefal(page, enhetsId[b.enhet]);
    kontroll('admin', `befälets benämning ${b.nyckel}`, b.roll, lapp.benamning);
    konton[b.nyckel] = { ...lapp, enhet: b.enhet };
  }
  logg(`  ${Object.keys(konton).length} koder utdelade`);
}

async function handelse(page, h) {
  const k = h.person ? konton[h.person] : null;
  if (h.typ === 'nyKod') {
    const gammal = k.kod;
    await adminSida(page, enhetsId[k.enhet]);
    await personrad(page, k.benamning).getByRole('button', { name: 'Ny kod' }).click();
    const ruta = page.getByRole('dialog', { name: `Ge ${k.benamning} en ny kod?` });
    await ruta.getByRole('button', { name: 'Utfärda ny kod' }).click();
    const [lapp] = await lasKodlapp(page);
    k.kod = lapp.kod;
    k.gammalKod = gammal;
    logg('  ny kod för', h.person);
  }
  if (h.typ === 'flytt') {
    await adminSida(page, enhetsId[k.enhet]);
    const del = page.locator('div, section').filter({ has: page.getByRole('heading', { name: 'Flytta person' }) }).last();
    const val = del.locator('select');
    await val.nth(0).selectOption({ label: k.benamning });
    const mal = enheter().find((e) => e.nyckel === h.till);
    const malVag = ['1. bataljon', ...h.till.split('-').map((_, i, a) => enheter().find((e) => e.nyckel === a.slice(0, i + 1).join('-')).namn)].join(' › ');
    const varde = await val.nth(1).locator('option').evaluateAll((os, v) => os.find((o) => o.textContent.trim().endsWith(v))?.value, malVag);
    if (!varde) throw new Error(`Hittar inte ${malVag} bland flyttmålen`);
    await val.nth(1).selectOption(varde);
    await del.getByRole('button', { name: 'Flytta', exact: true }).click();
    await page.getByText(`Flyttad till ${malVag}.`).waitFor();
    k.enhet = mal.nyckel;
    logg('  flyttade', h.person, 'till', h.till);
  }
  if (h.typ === 'sparr') {
    await adminSida(page, enhetsId[k.enhet]);
    await personrad(page, k.benamning).getByRole('button', { name: 'Spärra' }).click();
    await personrad(page, k.benamning).getByRole('button', { name: 'Aktivera' }).waitFor();
    logg('  spärrade', h.person);
  }
  if (h.typ === 'ny') {
    const [lapp] = await skapaVarnpliktiga(page, enhetsId[h.enhet], 1);
    konton[h.nyckel] = { ...lapp, enhet: h.enhet };
    logg('  ny värnpliktig', h.nyckel, lapp.benamning);
  }
}

// ── Incheckningen ───────────────────────────────────────────────────────────

/** Fyller i och skickar. Kontrollerar sammanfattningen innan den skickas. */
async function checkaIn(page, person, poang, dag, rattelse = false) {
  if (rattelse) {
    await page.goto(`${BAS}/soldat?redigera=1`);
    await page.waitForLoadState('networkidle');
  }
  await page.getByRole('button', { name: /Starta incheckning|Fortsätt/ }).click();
  for (let i = 0; i < KATEGORIER.length; i++) {
    const reglage = page.locator('input[type="range"]');
    await reglage.focus();
    await page.keyboard.press('Home');
    for (let j = 1; j < poang[KATEGORIER[i].key]; j++) await page.keyboard.press('ArrowRight');
    const sista = i === KATEGORIER.length - 1;
    await page.getByRole('button', { name: sista ? 'Sammanfattning' : 'Nästa' }).click();
  }
  // Sammanfattningen ska säga exakt det som fylldes i.
  for (const k of KATEGORIER) {
    const rad = page.getByRole('button', { name: new RegExp(`^Ändra ${k.label}, nu \\d+ av 10`) });
    const namn = (await rad.getAttribute('aria-label')) ?? (await rad.innerText());
    const visat = Number(namn.match(/nu (\d+) av 10/)?.[1]);
    if (!kontroll(`dag ${dag}: incheckning`, `${person} ${k.label}`, poang[k.key], visat)) await bild(page, `incheckning-${person}`);
  }
  await page.getByRole('button', { name: /Bekräfta och skicka|Spara ändringen/ }).click();
  await page.waitForURL(/\/soldat\/dashboard$/, { timeout: 30_000 });
  await page.waitForLoadState('networkidle');
}

/** Den värnpliktiges översikt efter incheckningen, mot facit. */
async function kontrolleraEgenVy(page, person, dag) {
  const f = egenVy(plan, person, dag);
  const kort = async (etikett) => {
    const el = page.locator('div', { has: page.getByText(etikett, { exact: false }) }).filter({ hasText: etikett }).last();
    return synlig(el);
  };
  const samlat = await kort('Samlat mående idag');
  const frekvens = await kort('Svarsfrekvens');
  const ok1 = kontroll(`dag ${dag}: egen vy`, `${person} samlat mående idag`, true, samlat.includes(f.samlat));
  const ok2 = kontroll(`dag ${dag}: egen vy`, `${person} svarsfrekvens`, true, frekvens.includes(f.frekvens) && frekvens.includes(f.frekvensUnder));
  if (!ok1 || !ok2) {
    resultat.at(-1).detalj = { facit: f, samlat, frekvens };
    await bild(page, `egen-vy-${person}`);
  }
}

async function dagensIncheckningar(dag) {
  const uppgifter = Object.entries(plan.svar[dag]).filter(([, s]) => s !== null);
  let i = 0;
  const arbetare = async () => {
    while (i < uppgifter.length) {
      const [person, poang] = uppgifter[i++];
      const k = konton[person];
      const { ctx, page } = await nySida(dag === DAGAR ? 1280 : 390);
      try {
        await loggaIn(page, k.kod);
        if (!page.url().includes('/soldat')) throw new Error(`${person} hamnade på ${page.url()}`);
        const forst = plan.forstaSvar[`${dag}:${person}`];
        if (forst) {
          await checkaIn(page, person, forst, dag);
          await checkaIn(page, person, poang, dag, true);
        } else {
          await checkaIn(page, person, poang, dag);
        }
        if (dag === DAGAR) await kontrolleraEgenVy(page, person, dag);
      } catch (e) {
        kontroll(`dag ${dag}: incheckning`, `${person} kunde checka in`, true, String(e.message).slice(0, 300));
        resultat.at(-1).detalj = { webblasaren: page.felLogg, adress: page.url() };
        await bild(page, `incheckning-misslyckades-${person}`);
      } finally {
        await ctx.close();
      }
    }
  };
  await Promise.all(Array.from({ length: SAMTIDIGA }, arbetare));
  logg(`  ${uppgifter.length} incheckningar`);
}

// ── Befälen ─────────────────────────────────────────────────────────────────

const VY = { bataljon: '/bataljon', kompani: '/kompani', pluton: '/pluton' };

async function kontrolleraBefal(b) {
  const { ctx, page } = await nySida(1280);
  try {
    await loggaIn(page, konton[b.nyckel].kod);
    kontroll('befäl', `${b.nyckel} hamnar på sin vy`, VY[b.sort], new URL(page.url()).pathname);

    for (const period of [7, 14, 21]) {
      const f = befalsvy(plan, b.enhet, period);
      const var_ = `${b.nyckel} ${period} d`;
      await page.goto(`${BAS}${VY[b.sort]}?period=${period}`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(900); // uppräkningen

      // Integritet: ingen enskild persons benämning i en befälsvy.
      const hela = await synlig(page.locator('main'));
      kontroll('integritet', `${var_}: ingen benämning syns`, false, /Värnpliktig \d|Sjukvårdare/.test(hela));

      // Nyckeltalen.
      for (const [etikett, v] of Object.entries(f.nyckeltal)) {
        const ruta = page.locator('dl').first().locator('div', { has: page.getByText(etikett, { exact: true }) }).last();
        const dd = ruta.locator('dd');
        const visat = { varde: await synlig(dd.nth(0)), under: await synlig(dd.nth(1)) };
        if (!kontroll('översikt', `${var_}: ${etikett}`, v, visat)) await bild(page, `${var_}-${etikett}`);
      }

      // Kategoritabellen.
      if (f.kategorier) {
        const rader = await page.locator('ul > li').filter({ has: page.locator('.text-lg') }).evaluateAll((lis) => {
          const t = window.__synlig;
          return lis.map((li) => {
            const c = li.children;
            return {
              kategori: t(c[0]),
              snitt: t(c[1].querySelector('.text-lg')),
              status: t(c[1].lastElementChild),
              forandring: t(c[3].lastElementChild),
              iRott: t(c[4]),
            };
          });
        });
        const facitRader = f.kategorier.map(({ kategori, snitt, status, forandring, iRott }) => ({ kategori, snitt, status, forandring, iRott }));
        if (!kontroll('översikt', `${var_}: kategoritabellen`, facitRader, rader)) await bild(page, `${var_}-kategorier`);
        const legend = await synlig(page.locator('ul').filter({ has: page.locator('.text-lg') }).locator('xpath=following-sibling::div[1]'));
        kontroll('översikt', `${var_}: förklaringen under tabellen`, f.harForra ? `${period} dagarna före` : `Ingen jämförelse: för få svar under de ${period} dagarna före`, legend.includes(`Ingen jämförelse`) ? `Ingen jämförelse: för få svar under de ${period} dagarna före` : legend.includes(`${period} dagarna före`) ? `${period} dagarna före` : legend);
      }

      // Trender: dag för dag.
      await page.getByRole('tab', { name: 'Trender' }).click();
      const trender = await tabellrader(page.getByRole('region', { name: 'Hur många som svarade, dag för dag' }).locator('table'));
      if (!kontroll('trender', `${var_}: dag för dag`, f.trender, trender)) await bild(page, `${var_}-trender`);

      // Jämförelse.
      await page.getByRole('tab', { name: 'Jämförelse' }).click();
      const region = page.getByRole('region', { name: /Jämförelse mellan/ });
      if (await region.count()) {
        const jamf = await tabellrader(region.locator('table'));
        if (!kontroll('jämförelse', `${var_}: tabellen`, f.jamforelse, jamf)) await bild(page, `${var_}-jamforelse`);
      } else {
        kontroll('jämförelse', `${var_}: tabellen`, f.jamforelse, 'ingen tabell');
      }

      // Rapporten.
      await page.goto(`${BAS}/rapport?period=${period}`);
      await page.waitForLoadState('networkidle');
      for (const [etikett, v] of Object.entries(f.rapport.rutor)) {
        if (!v) continue;
        const ruta = page.locator('div.rounded', { has: page.getByText(etikett, { exact: true }) }).last();
        const p = ruta.locator('p');
        const visat = { varde: await synlig(p.nth(1)), under: await synlig(p.nth(2)) };
        if (!kontroll('rapport', `${var_}: ${etikett}`, v, visat)) await bild(page, `${var_}-rapport-${etikett}`);
      }
      const tabeller = page.locator('table');
      if (f.rapport.kategorier) {
        const kat = await tabellrader(tabeller.nth(0));
        if (!kontroll('rapport', `${var_}: kategorier`, f.rapport.kategorier, kat)) await bild(page, `${var_}-rapport-kategorier`);
      }
      const under = await tabellrader(page.getByRole('table', { name: 'Underenheter per kategori' }));
      if (!kontroll('rapport', `${var_}: underenheter`, f.rapport.underenheter, under)) await bild(page, `${var_}-rapport-underenheter`);
      const dagar = await tabellrader(tabeller.last());
      if (!kontroll('rapport', `${var_}: dag för dag`, f.rapport.dagForDag, dagar)) await bild(page, `${var_}-rapport-dagar`);
      const rapportText = await synlig(page.locator('main'));
      kontroll('integritet', `${var_}: ingen benämning i rapporten`, false, /Värnpliktig \d|Sjukvårdare/.test(rapportText));

      // Exporten.
      for (const [typ, facit] of [['dagar', f.csvDagar], ['enheter', f.csvEnheter]]) {
        const svar = await page.request.get(`${BAS}/api/export?period=${period}&typ=${typ}`);
        const csv = (await svar.text()).replace(/^﻿/, '');
        const rader = csv.trim().split('\r\n').map((r) => r.split(';'));
        kontroll('export', `${var_}: CSV ${typ}`, facit, rader);
      }
    }
  } catch (e) {
    kontroll('befäl', `${b.nyckel} kunde kontrolleras`, true, String(e.message).slice(0, 300));
    await bild(page, `befal-${b.nyckel}`);
  } finally {
    await ctx.close();
  }
}

// ── Resultatsidan ───────────────────────────────────────────────────────────

function skrivResultat() {
  writeFileSync(path.join(UT, 'resultat.json'), JSON.stringify({ resultat, fel }, null, 2));
  const omrade = (r) => r.omrade.replace(/^dag \d+: /, '');
  const blad = (x) => (Array.isArray(x) ? x.reduce((s, v) => s + blad(v), 0) : x && typeof x === 'object' ? Object.values(x).reduce((s, v) => s + blad(v), 0) : 1);
  const omraden = [...new Set(resultat.map(omrade))];
  const sammanfattning = omraden.map((o) => {
    const rader = resultat.filter((r) => omrade(r) === o);
    return { o, antal: rader.length, varden: rader.reduce((s, r) => s + blad(r.facit), 0), fel: rader.filter((r) => !r.ok).length };
  });
  const varden = sammanfattning.reduce((s, x) => s + x.varden, 0);
  const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const html = `<!doctype html><html lang="sv"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Verklighetsprov</title>
<style>:root{--bg:#f8fafc;--ink:#0f172a;--dim:#475569;--line:#e2e8f0;--card:#fff;--ok:#047857;--fel:#b91c1c}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--bg:#0b1120;--ink:#e2e8f0;--dim:#94a3b8;--line:#1e293b;--card:#111827;--ok:#34d399;--fel:#f87171}}
:root[data-theme="dark"]{--bg:#0b1120;--ink:#e2e8f0;--dim:#94a3b8;--line:#1e293b;--card:#111827;--ok:#34d399;--fel:#f87171}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 system-ui,sans-serif}main{max-width:1000px;margin:0 auto;padding:24px 16px 64px}
table{border-collapse:collapse;width:100%;font-size:14px}td,th{padding:6px 8px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}td.tal,th.tal{text-align:right}
.ok{color:var(--ok);font-weight:700}.fel{color:var(--fel);font-weight:700}pre{white-space:pre-wrap;word-break:break-word;margin:0;font-size:12px}
p.dim,li{color:var(--dim)}section{background:var(--card);border:1px solid var(--line);border-radius:6px;padding:12px 16px;margin:14px 0}h2{font-size:17px;margin:22px 0 6px}</style></head><body><main>
<h1>Verklighetsprov</h1>
<p><b>${resultat.length} kontroller, ${varden} enskilda värden jämförda mot facit — <span class="${fel.length ? 'fel' : 'ok'}">${fel.length} fel</span>.</b></p>
<p class="dim">En tom installation i pilotläge, som den skulle lämnas över. Administratören byggde två kompanier med fem plutoner och femton grupper och delade ut ${Object.keys(konton).length} koder. De värnpliktiga checkade in genom webbläsaren i fjorton dagar enligt en svarsplan. Sedan loggade alla åtta befäl in, och varje tal i översikten, trenderna, jämförelsen, rapporten och exporten jämfördes, för 7, 14 och 21 dagar. Facit räknades direkt ur svarsplanen, utan appens kod.</p>
<h2>Det som hände under de fjorton dagarna</h2>
<ul><li>En grupp med bara tre personer (ska alltid vara dold) och en sjukvårdare placerad direkt i plutonen.</li>
<li>En tom grupp, en som aldrig svarar och två som svarar sällan.</li>
<li>Dag 3: en värnpliktig rättar sin rapport. Dag 5: ny kod efter en tappad lapp, och den gamla koden slutar fungera.</li>
<li>Dag 6: en värnpliktig flyttas till en annan grupp. Dag 8: en ny värnpliktig tillkommer. Dag 9: en spärras och kommer inte in.</li>
<li>Dag 11: bara tre svarar i en grupp. Ett gränsfall där sömnens snitt är exakt 3,95, som ska visas som 4,0 och gult.</li></ul>
<h2>Per område</h2>
<section><table><tr><th>Område</th><th class="tal">Kontroller</th><th class="tal">Värden</th><th class="tal">Fel</th></tr>${sammanfattning.map((x) => `<tr><td>${esc(x.o)}</td><td class="tal">${x.antal}</td><td class="tal">${x.varden}</td><td class="tal ${x.fel ? 'fel' : 'ok'}">${x.fel}</td></tr>`).join('')}</table></section>
${fel.length ? `<h2>Felen</h2>${fel.map((f) => `<section><b>${esc(f.omrade)}</b> — ${esc(f.vad)}<pre>Facit: ${esc(JSON.stringify(f.facit, null, 1))}</pre><pre>Visat: ${esc(JSON.stringify(f.visat, null, 1))}</pre></section>`).join('')}` : ''}
</main></body></html>`;
  writeFileSync(path.join(UT, 'index.html'), html);
}

// ── Körningen ───────────────────────────────────────────────────────────────

async function main() {
  rmSync(UT, { recursive: true, force: true });
  mkdirSync(UT, { recursive: true });
  for (const f of [DB, `${DB}-wal`, `${DB}-shm`]) rmSync(f, { force: true });
  if (!existsSync(path.join(ROT, '.next/BUILD_ID'))) {
    logg('Bygger appen…');
    execFileSync('npm', ['run', 'build'], { cwd: ROT, stdio: 'inherit' });
  }

  // Första start: tom databas. Administratörskoden skrivs ut en gång.
  logg('Sätter upp en tom installation');
  const uppsattning = execFileSync('npm', ['run', 'db:setup'], { cwd: ROT, env: { ...MILJO, PROV_IDAG: datum(1) }, encoding: 'utf8' });
  const adminKod = uppsattning.match(/Adminkod:\s+(\S+)/)?.[1];
  kontroll('uppstart', 'administratörskoden skrivs ut vid första start', true, Boolean(adminKod));
  if (!adminKod) throw new Error(`Ingen adminkod i utskriften:\n${uppsattning}`);

  browser = await chromium.launch();
  try {
    for (let dag = 1; dag <= TILL_DAG; dag++) {
      aktuellDag = dag;
      logg(`Dag ${dag} (${datum(dag)})`);
      await startaServer(dag);
      const dagens = HANDELSER.filter((h) => h.dag === dag && h.typ !== 'fa' && h.typ !== 'rattelse');
      if (dag === 1 || dagens.length) {
        const { ctx, page } = await nySida(1280);
        await loggaIn(page, adminKod);
        kontroll('admin', `dag ${dag}: administratören hamnar i adminvyn`, '/admin', new URL(page.url()).pathname);
        if (dag === 1) await byggOrganisation(page);
        for (const h of dagens) await handelse(page, h);
        await ctx.close();
      }
      await dagensIncheckningar(dag);

      // Händelsernas följder för inloggningen.
      const ny = HANDELSER.find((h) => h.typ === 'nyKod' && h.dag === dag);
      if (ny) {
        const { ctx, page } = await nySida();
        kontroll('admin', 'den gamla koden slutar fungera efter "Ny kod"', true, await inloggningNekas(page, konton[ny.person].gammalKod));
        await ctx.close();
      }
      const sparr = HANDELSER.find((h) => h.typ === 'sparr' && h.dag === dag);
      if (sparr) {
        const { ctx, page } = await nySida();
        kontroll('admin', 'en spärrad person kommer inte in', true, await inloggningNekas(page, konton[sparr.person].kod));
        await ctx.close();
      }
    }

    logg('Befälen kontrollerar');
    for (const b of TILL_DAG === DAGAR ? befal() : []) {
      await kontrolleraBefal(b);
      logg(`  ${b.nyckel} klar (${fel.length} fel hittills)`);
    }
  } finally {
    await browser.close();
    await stoppaServer();
    writeFileSync(path.join(UT, 'konton.json'), JSON.stringify(konton, null, 2));
    skrivResultat();
  }
  logg(`Klart: ${resultat.length} kontroller, ${fel.length} fel. ${path.join(UT, 'index.html')}`);
}

// `--sidan`: skriv bara om resultatsidan ur en tidigare körning.
if (process.argv.includes('--sidan')) {
  const { readFileSync } = await import('node:fs');
  const d = JSON.parse(readFileSync(path.join(UT, 'resultat.json'), 'utf8'));
  resultat.push(...d.resultat);
  fel.push(...d.fel);
  Object.assign(konton, JSON.parse(readFileSync(path.join(UT, 'konton.json'), 'utf8')));
  skrivResultat();
  process.exit(0);
}

main().catch(async (e) => {
  console.error(e);
  await stoppaServer();
  skrivResultat();
  process.exit(1);
});
