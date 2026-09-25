/**
 * Språket i gränssnittet.
 *
 * Två fel som fanns i adminvyn och som testerna nedan låser:
 *
 *  1. Nivåordet byggdes mekaniskt av enhetens sort plus "snivå". Det blir
 *     rätt för bataljon och pluton men fel för de andra två — "kompanisnivå"
 *     i stället för kompaninivå, "gruppsnivå" i stället för gruppnivå. Värst
 *     var att appen därmed motsade sig själv: kompanichefens egen vy har
 *     rubriken "Kompaninivå".
 *  2. Raderingsrutan satte komma före "och" i en uppräkning, och med både
 *     underenheter och personer blev det två "och" tätt intill varandra.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

import './setup.mjs';

test('nivåordet stavas som i befälsvyernas egna rubriker', async () => {
  const { NIVÅORD, nivåRubrik } = await import('../src/lib/unit-names.ts');

  assert.equal(NIVÅORD.bataljon, 'bataljonsnivå');
  assert.equal(NIVÅORD.kompani, 'kompaninivå', 'kompani böjs utan foge-s');
  assert.equal(NIVÅORD.pluton, 'plutonsnivå');
  assert.equal(NIVÅORD.grupp, 'gruppnivå', 'grupp böjs utan foge-s');

  assert.equal(nivåRubrik('kompani'), 'Kompaninivå');

  /*
   * Rubrikerna i befälsvyerna ska komma ur samma ord. Stod de kvar som egna
   * strängar kunde de glida isär igen — och det var just isärglidningen som
   * gjorde felet synligt: rubriken sa "Kompaninivå" medan adminvyn sa
   * "kompanisnivå" om samma enhet.
   */
  for (const [sort, fil] of [
    ['bataljon', 'src/app/bataljon/page.tsx'],
    ['kompani', 'src/app/kompani/page.tsx'],
    ['pluton', 'src/app/pluton/page.tsx'],
  ]) {
    const kod = readFileSync(fil, 'utf8');
    assert.ok(
      !/levelLabel="/.test(kod),
      `${fil} har rubriken som egen sträng — den ska hämtas ur NIVÅORD`,
    );
    assert.match(kod, new RegExp(`nivåRubrik\\('${sort}'\\)`), `${fil} ska använda nivåRubrik()`);
  }
});

test('ingen bygger nivåordet med "snivå" längre', async () => {
  /*
   * Regelfelet, inte bara de två stavfelen: så länge någon klistrar på
   * "snivå" efter enhetens sort kommer nästa nivå som läggs till att bli fel
   * igen. Den här kontrollen läser koden, för det är formen som är felet.
   */
  const filer = [
    'src/app/admin/UnitDetail.tsx',
    'src/lib/db/queries/admin.ts',
    'src/components/leader/LeaderPageShell.tsx',
  ];

  for (const fil of filer) {
    const kod = readFileSync(fil, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    assert.ok(
      !/\}snivå|['"`]snivå/.test(kod),
      `${fil} bygger fortfarande nivåordet av sort + "snivå"`,
    );
  }
});

test('en uppräkning får komma mellan leden och "och" före det sista', async () => {
  const { uppräkning } = await import('../src/lib/format.ts');

  // Fallet som stod i raderingsrutan: "2 personer, och alla deras rapporter".
  assert.equal(uppräkning(['2 personer', 'alla deras rapporter']), '2 personer och alla deras rapporter');

  // Och fallet med tre led, som gav två "och" efter varandra.
  assert.equal(
    uppräkning(['1 underenhet', '2 personer', 'alla deras rapporter']),
    '1 underenhet, 2 personer och alla deras rapporter',
  );

  assert.equal(uppräkning(['1 underenhet']), '1 underenhet');
  assert.equal(uppräkning([]), '');
});

/*
 * Genus: kompani är ett neutrum bland tre utrum.
 *
 * Samma sorts fel som "kompanisnivå", och av samma orsak: en mening byggdes
 * av enhetens sort plus ett böjt ord. Det blev "Ny kompani", "Jämför en
 * kompani" och "Kompaniet är tom. Den tas bort permanent." — tre ställen där
 * bataljonschefen och administratören möttes av fel svenska. Formerna står nu
 * i ordformer(), som NIVÅORD, och kontrollerna nedan läser koden eftersom det
 * är formen som är felet.
 */
test('enhetssorternas böjda ordformer står på ett ställe', async () => {
  const { ordformer } = await import('../src/lib/unit-names.ts');

  assert.equal(ordformer('kompani').artikel, 'ett', 'ett kompani');
  assert.equal(ordformer('bataljon').artikel, 'en');
  assert.equal(ordformer('pluton').artikel, 'en');
  assert.equal(ordformer('grupp').artikel, 'en');

  assert.equal(ordformer('kompani').ny, 'Nytt', 'Nytt kompani');
  assert.equal(ordformer('pluton').ny, 'Ny');

  assert.equal(ordformer('kompani').tom, 'tomt', 'kompaniet är tomt');
  assert.equal(ordformer('grupp').tom, 'tom');

  assert.equal(ordformer('kompani').pronomen, 'Det', 'det tas bort');
  assert.equal(ordformer('pluton').pronomen, 'Den');
});

test('ingen bygger en mening av enhetens sort plus ett böjt ord', () => {
  const utanKommentarer = (fil) =>
    readFileSync(fil, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

  const detalj = utanKommentarer('src/app/admin/UnitDetail.tsx');
  assert.ok(!/Ny \{childKind\}/.test(detalj), 'rubriken för ny underenhet böjer inte "ny" efter sorten');
  assert.match(detalj, /ordformer\(/, 'UnitDetail ska hämta formerna ur ordformer()');

  const radering = utanKommentarer('src/app/admin/UnitDeleteSection.tsx');
  assert.ok(!/är tom\./.test(radering), '"är tom" gäller inte ett kompani');
  assert.ok(!/Den tas bort/.test(radering), '"Den" gäller inte ett kompani');
  assert.match(radering, /ordformer\(/, 'raderingsrutan ska hämta formerna ur ordformer()');

  const befalsvy = utanKommentarer('src/components/leader/LeaderDashboard.tsx');
  assert.ok(!/Jämför en \{/.test(befalsvy), 'artikeln får inte stå fast — ett kompani, en pluton');
});
