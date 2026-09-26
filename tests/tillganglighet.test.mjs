/**
 * Tillgänglighet som inte kan falla bort obemärkt.
 *
 * Lagen om tillgänglighet till digital offentlig service kräver WCAG 2.1 AA.
 * Det mesta i det kravet måste bedömas av en människa, men några saker går
 * att läsa ur koden — och det är just de som brukar försvinna när en ny sida
 * läggs till i hast: huvudlandmärket, sidans rubrik, och flikar som bara är
 * knappar utan att berätta att de hör ihop.
 *
 * Testet granskar alltså koden, inte en renderad sida. Det ersätter inte en
 * riktig granskning med skärmläsare, men det hindrar en tyst tillbakagång.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const APP = path.resolve(import.meta.dirname, '..', 'src', 'app');
const KOMPONENTER = path.resolve(import.meta.dirname, '..', 'src', 'components');

/** Sidor som medvetet saknar landmärke: felsidorna, som inte visar någon data. */
const UTAN_KRAV = new Set(['error.tsx', 'global-error.tsx', 'not-found.tsx']);

function sidor(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = path.join(dir, d.name);
    if (d.isDirectory()) return sidor(p);
    return d.name === 'page.tsx' ? [p] : [];
  });
}

/** Sidan själv, plus komponenten den överlämnar hela innehållet till. */
function kodFor(fil) {
  let kod = readFileSync(fil, 'utf8');
  const skal = kod.match(/from '@\/components\/([\w/]+)'/g) ?? [];
  for (const rad of skal) {
    const namn = rad.match(/from '@\/components\/([\w/]+)'/)[1];
    const p = path.join(KOMPONENTER, `${namn}.tsx`);
    try {
      kod += readFileSync(p, 'utf8');
    } catch {
      /* komponenten finns inte som .tsx — hoppa över */
    }
  }
  return kod;
}

test('varje sida har ett huvudlandmärke att hoppa till', () => {
  const brister = [];
  for (const fil of sidor(APP)) {
    const namn = path.relative(APP, fil);
    if (UTAN_KRAV.has(path.basename(fil))) continue;
    const kod = kodFor(fil);
    if (!/<main[\s>]/.test(kod)) brister.push(`${namn}: saknar <main>`);
    if (!/id="innehall"/.test(kod)) brister.push(`${namn}: <main> saknar id="innehall"`);
  }
  assert.deepEqual(brister, [], 'hopplänken i layouten pekar på id="innehall"');
});

test('varje sida har en rubrik', () => {
  const brister = [];
  for (const fil of sidor(APP)) {
    if (UTAN_KRAV.has(path.basename(fil))) continue;
    if (!/<h1[\s>]/.test(kodFor(fil))) brister.push(path.relative(APP, fil));
  }
  assert.deepEqual(brister, [], 'sidor utan <h1> går inte att navigera med skärmläsare');
});

test('hopplänken finns i layouten och är dold tills den får fokus', () => {
  const layout = readFileSync(path.join(APP, 'layout.tsx'), 'utf8');
  assert.match(layout, /href="#innehall"/, 'hopplänk saknas');
  assert.match(layout, /sr-only/, 'länken ska vara osynlig tills den fokuseras');
  assert.match(layout, /focus:not-sr-only/, 'och synlig när den fokuseras');
});

test('flikarna är riktiga flikar, inte knappar i rad', () => {
  const tabs = readFileSync(path.join(KOMPONENTER, 'Tabs.tsx'), 'utf8');
  for (const krav of ['role="tablist"', 'role="tab"', 'aria-selected', 'aria-controls', 'ArrowRight', 'role="tabpanel"']) {
    assert.ok(tabs.includes(krav), `Tabs.tsx saknar ${krav}`);
  }

  // Och ingen vy får bygga en egen flikrad vid sidan om.
  const vyer = [
    path.join(KOMPONENTER, 'leader', 'LeaderDashboard.tsx'),
    path.join(APP, 'soldat', 'dashboard', 'DashboardClient.tsx'),
  ];
  for (const fil of vyer) {
    const kod = readFileSync(fil, 'utf8');
    assert.match(kod, /<Tabs\b/, `${path.basename(fil)} ska använda den gemensamma flikkomponenten`);
    assert.match(kod, /<Panel\b/, `${path.basename(fil)} ska märka upp sina paneler`);
  }
});

test('ingen text i den värnpliktiges flöde ligger under kontrastkravet', () => {
  /*
   * #94A3B8 mot vitt är 2,6:1 och #CBD5E1 omkring 1,7:1 — långt under AA:s
   * 4,5:1. De användes som "diskret" text i wizarden och på återkopplingen,
   * alltså i appens enda vy som varje värnpliktig måste använda.
   */
  const filer = [
    path.join(APP, 'soldat', 'CheckinWizard.tsx'),
    path.join(APP, 'soldat', 'dashboard', 'DashboardClient.tsx'),
  ];
  for (const fil of filer) {
    const kod = readFileSync(fil, 'utf8');
    assert.ok(!/color:\s*'#94A3B8'/.test(kod), `${path.basename(fil)}: #94A3B8 som textfärg`);
    assert.ok(!/color:\s*'#CBD5E1'/.test(kod), `${path.basename(fil)}: #CBD5E1 som textfärg`);
  }
});

test('sammanfattningens rader går att nå med tangentbord', () => {
  const kod = readFileSync(path.join(APP, 'soldat', 'CheckinWizard.tsx'), 'utf8');

  // Raden som låter en rätta ett svar ska vara en knapp, inte en klickbar div.
  assert.match(kod, /<button[\s\S]{0,400}onClick=\{\(\) => setStep\(i \+ 1\)\}/, 'raden ska vara en knapp');
  assert.ok(
    !/<div[^>]*\n?[^>]*onClick=\{\(\) => setStep/.test(kod),
    'ingen klickbar div kvar i sammanfattningen',
  );
});

/*
 * Graferna ska peka på sin beskrivning.
 *
 * Alla sex grafer var märkta role="img" med en etikett som sa vad de HETER —
 * "Ditt mående de senaste fjorton dagarna" — och inget om innehållet. Den som
 * lyssnar fick veta att det FINNS en graf, och inget mer. Texten byggs i
 * lib/graftext.ts, som prövas i graftext.test.mjs; här kontrolleras bara att
 * varje graf faktiskt pekar på en.
 *
 * Innehåll inuti ett element med role="img" göms för skärmläsaren, så
 * beskrivningen kan inte ligga där inne. Den ligger i ett eget stycke intill,
 * och grafen pekar på den med aria-describedby.
 */
test('varje graf pekar på sin beskrivning', () => {
  for (const fil of ['charts/ScoreTrendChart.tsx', 'leader/ChildFocus.tsx']) {
    const kod = readFileSync(path.join(KOMPONENTER, fil), 'utf8')
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    const antalGrafer = (kod.match(/role="img"/g) ?? []).length;
    const antalBeskrivna = (kod.match(/aria-describedby=/g) ?? []).length;

    assert.ok(antalGrafer > 0, `${fil}: ingen graf hittad`);
    assert.equal(
      antalBeskrivna,
      antalGrafer,
      `${fil}: ${antalGrafer} grafer men ${antalBeskrivna} beskrivningar`,
    );
  }
});
