/**
 * Vad en graf säger till den som lyssnar.
 *
 * Graferna var märkta `role="img"` med en etikett som sa vad de HETER — "Ditt
 * mående de senaste fjorton dagarna" — och ingenting om innehållet. Den som
 * använder skärmläsare fick alltså veta att det finns en graf, och fick gå
 * vidare. Det är appens största tillgänglighetslucka, och den enda som handlar
 * om information i stället för om hantering.
 *
 * Texten prövas här, som en funktion, och att varje graf pekar på sin text
 * prövas i tillganglighet.test.mjs.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import './setup.mjs';

test('en serie beskrivs med sina egna tal', async () => {
  const { seriebeskrivning } = await import('../src/lib/graftext.ts');

  const punkter = [
    { key: '2026-09-20', label: 'sön', value: 6 },
    { key: '2026-09-21', label: 'mån', value: null },
    { key: '2026-09-22', label: 'tis', value: 4.2 },
    { key: '2026-09-23', label: 'ons', value: 7.5 },
    { key: '2026-09-24', label: 'tor', value: 5 },
  ];
  const text = seriebeskrivning(punkter);

  assert.match(text, /5,0/, 'senaste värdet, med decimalkomma');
  assert.match(text, /4,2/, 'lägsta värdet');
  assert.match(text, /22\/9/, 'och vilken dag det var');
  assert.match(text, /7,5/, 'högsta värdet');
  assert.match(text, /23\/9/);
  assert.match(text, /utan svar/, 'dagen utan svar ska nämnas');

  /*
   * Datum, inte veckodag. Den värnpliktiges översiktsgraf har veckodagar på
   * axeln, och över fjorton dagar finns varje veckodag två gånger — "lägst på
   * tisdag" pekar då på två dagar.
   */
  assert.ok(!/tis|ons|mån/.test(text), `veckodag i stället för datum: ${text}`);
});

test('en serie utan värden påstår ingenting', async () => {
  const { seriebeskrivning } = await import('../src/lib/graftext.ts');

  const tomma = [
    { key: '2026-09-20', label: 'sön', value: null },
    { key: '2026-09-21', label: 'mån', value: null },
  ];

  const text = seriebeskrivning(tomma);
  assert.match(text, /underlag|ingen/i, 'ska säga att det inte finns något att visa');
  assert.ok(!/\d,\d/.test(text), 'och inte hitta på ett tal');
  assert.equal(seriebeskrivning([]), text, 'tom lista behandlas som tomma dagar');
});

test('ett enda värde beskrivs utan att låtsas vara en trend', async () => {
  const { seriebeskrivning } = await import('../src/lib/graftext.ts');

  const text = seriebeskrivning([{ key: '2026-09-24', label: 'tor', value: 8 }]);

  assert.match(text, /8,0/);
  // Med en enda punkt är lägst och högst samma tal som det senaste. Tre
  // påståenden om ett värde hjälper ingen.
  assert.ok(!/[Ll]ägst/.test(text), `sa "lägst" om en enda punkt: ${text}`);
});

test('lika värden hela perioden räknas inte upp som lägst och högst', async () => {
  const { seriebeskrivning } = await import('../src/lib/graftext.ts');

  const text = seriebeskrivning([
    { key: '2026-09-23', label: 'ons', value: 6 },
    { key: '2026-09-24', label: 'tor', value: 6 },
  ]);

  assert.match(text, /6,0/);
  assert.ok(!/[Ll]ägst/.test(text), `"lägst 6,0, högst 6,0" säger ingenting: ${text}`);
});

test('en jämförelse beskriver båda serierna', async () => {
  const { jämförelsebeskrivning } = await import('../src/lib/graftext.ts');

  const text = jämförelsebeskrivning(
    'Grupp 2',
    [{ key: '2026-09-24', label: 'tor', value: 4 }],
    'Hela enheten',
    [{ key: '2026-09-24', label: 'tor', value: 6.5 }],
  );

  assert.match(text, /Grupp 2/);
  assert.match(text, /4,0/);
  assert.match(text, /Hela enheten/);
  assert.match(text, /6,5/);
});

test('spindeldiagrammet räknas upp kategori för kategori', async () => {
  const { profilbeskrivning } = await import('../src/lib/graftext.ts');

  const text = profilbeskrivning('Grupp 2', 'Hela enheten', [
    { kategori: 'Fysisk', vald: 5, snitt: 6.4 },
    { kategori: 'Sömn', vald: 3.5, snitt: 6 },
  ]);

  assert.match(text, /Fysisk 5,0 mot 6,4/);
  assert.match(text, /Sömn 3,5 mot 6,0/);
});

test('en undanhållen referens beskrivs utan att låtsas om ett tal', async () => {
  const { profilbeskrivning } = await import('../src/lib/graftext.ts');

  /*
   * Enhetens snitt kan vara undanhållet av integritetsskäl medan
   * underenhetens visas. Då får beskrivningen inte antyda en jämförelse som
   * inte finns — och absolut inte fylla i en nolla.
   */
  const text = profilbeskrivning('Grupp 2', 'Hela enheten', [
    { kategori: 'Fysisk', vald: 5, snitt: null },
    { kategori: 'Sömn', vald: 3.5, snitt: null },
  ]);

  assert.match(text, /Fysisk 5,0/);
  assert.ok(!/mot/.test(text), `påstod en jämförelse som inte finns: ${text}`);
  assert.ok(!/0,0/.test(text), 'en undanhållen siffra får aldrig bli en nolla');
});

test('är senaste värdet också periodens ytterlighet sägs det, inte upprepas', async () => {
  const { seriebeskrivning } = await import('../src/lib/graftext.ts');

  /*
   * Uppmätt i en riktig körning: "Senaste värdet 5,5 den 26/9. Lägst 4,2 den
   * 15/9, högst 5,5 den 26/9." Samma tal och samma dag två gånger i samma
   * mening — och det som är intressant, att man ligger på sitt högsta, gick
   * förlorat i upprepningen.
   */
  const stiger = [
    { key: '2026-09-24', label: 'tor', value: 4.2 },
    { key: '2026-09-25', label: 'fre', value: 5 },
    { key: '2026-09-26', label: 'lör', value: 5.5 },
  ];
  const upp = seriebeskrivning(stiger);
  assert.match(upp, /periodens högsta/, 'ska säga att man ligger högst');
  assert.equal(upp.match(/5,5/g).length, 1, `5,5 sägs två gånger: ${upp}`);
  assert.match(upp, /[Ll]ägst 4,2/, 'den andra ytterligheten står kvar');

  const faller = [
    { key: '2026-09-24', label: 'tor', value: 6 },
    { key: '2026-09-25', label: 'fre', value: 5 },
    { key: '2026-09-26', label: 'lör', value: 3.5 },
  ];
  const ner = seriebeskrivning(faller);
  assert.match(ner, /periodens lägsta/, 'ska säga att man ligger lägst');
  assert.equal(ner.match(/3,5/g).length, 1, `3,5 sägs två gånger: ${ner}`);
  assert.match(ner, /[Hh]ögst 6,0/);
});

test('referensnamnet böjs efter sin plats i meningen', async () => {
  const kod = await import('node:fs').then((fs) =>
    fs.readFileSync('src/components/leader/ChildFocus.tsx', 'utf8'),
  );

  // "Grupp 3 mot Hela enheten, per kategori" — versal mitt i en mening.
  assert.match(
    kod,
    /profilbeskrivning\(vald\.name, 'hela enheten'/,
    'spindeldiagrammet ska säga "mot hela enheten", med liten bokstav',
  );
  // Medan linjegrafens text inleder en mening med namnet, och då är versalen rätt.
  assert.match(kod, /'Hela enheten',/, 'linjegrafen inleder en mening med namnet');
});
