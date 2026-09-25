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
