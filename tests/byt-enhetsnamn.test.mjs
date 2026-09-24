/**
 * Byta namn på en enhet.
 *
 * Personer har kunnat byta benämning länge; enheter har inte kunnat det alls.
 * Följden är att ett felskrivet enhetsnamn bara gick att rätta genom att
 * radera enheten och skapa den på nytt — och raderingen tar med sig personer
 * och rapporter. Att rätta en stavning fick alltså kosta data.
 *
 * Det viktigaste testet nedan är att namnbytet INTE rör något annat. En enhet
 * hänger ihop med sina underenheter genom id, inte genom namn, men det är den
 * sortens sak man vill ha bevisad och inte antagen: träffar bytet fel rad
 * eller följer med nedåt i trädet upptäcks det först när ett befäl ser fel
 * enhet i sin vy.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { buildOrg, database } from './setup.mjs';

test('namnbytet ändrar enheten — och ingenting annat', async () => {
  const { client } = await database();
  const org = await buildOrg(client);
  const { renameUnit } = await import('../src/lib/db/queries/admin.ts');

  const rad = async (sql, args = []) => (await client.execute({ sql, args })).rows;
  const namn = async (id) => String((await rad('SELECT name FROM units WHERE id = ?', [id]))[0].name);

  // Läget före: plutonens barn, deras namn, föräldrar och personer.
  const foreBarn = await rad('SELECT id, name, parent_id, kind FROM units WHERE parent_id = ? ORDER BY id', [org.pluton]);
  const forePersoner = Number((await rad(
    'SELECT count(*) n FROM users WHERE unit_id IN (SELECT id FROM units WHERE parent_id = ?)', [org.pluton]))[0].n);
  assert.ok(foreBarn.length >= 2 && forePersoner > 0, 'provet behöver barn och personer');

  const svar = await renameUnit(org.grupper['Grupp A'], org.pluton, '  Understödsplutonen  ');
  assert.equal(svar.ok, true);
  assert.equal(svar.name, 'Understödsplutonen', 'mellanslag i kanterna ska bort');
  assert.equal(await namn(org.pluton), 'Understödsplutonen');

  // Kärnan: barnen är orörda — namn, förälder och sort som förut.
  const efterBarn = await rad('SELECT id, name, parent_id, kind FROM units WHERE parent_id = ? ORDER BY id', [org.pluton]);
  assert.deepEqual(
    efterBarn.map((r) => [Number(r.id), r.name, Number(r.parent_id), r.kind]),
    foreBarn.map((r) => [Number(r.id), r.name, Number(r.parent_id), r.kind]),
    'underenheterna ska inte påverkas av att föräldern byter namn',
  );

  const efterPersoner = Number((await rad(
    'SELECT count(*) n FROM users WHERE unit_id IN (SELECT id FROM units WHERE parent_id = ?)', [org.pluton]))[0].n);
  assert.equal(efterPersoner, forePersoner, 'personerna ska sitta kvar i sina grupper');

  // Och ingen annan enhet fick nytt namn på köpet.
  assert.equal(await namn(org.kompani), '1. Kompaniet');
  assert.equal(await namn(org.bataljon), 'Bataljonen');

  // Trädet som adminvyn och befälsvyerna läser ska visa det nya namnet, och
  // barnens sökvägar ska följa med — de räknas fram ur trädet, inte lagras.
  const { getUnitPaths } = await import('../src/lib/db/queries/admin.ts');
  const vagar = await getUnitPaths();
  const gruppA = vagar.find((v) => v.id === org.grupper['Grupp A']);
  assert.match(gruppA.path, /Understödsplutonen/, 'barnets sökväg ska visa förälderns nya namn');
});

test('två syskon kan inte heta lika, men samma namn under olika föräldrar går bra', async () => {
  const { client } = await database();
  const org = await buildOrg(client);
  const { renameUnit } = await import('../src/lib/db/queries/admin.ts');

  const svar = await renameUnit(org.bataljon, org.grupper['Grupp A'], 'Grupp B');
  assert.equal(svar.ok, false, 'namnet är upptaget av syskonet');
  assert.match(svar.error, /heter/i);

  // Samma namn i en annan pluton är däremot helt i sin ordning.
  const annan = await buildOrg(client);
  const ok = await renameUnit(annan.bataljon, annan.grupper['Grupp A'], 'Grupp A');
  assert.equal(ok.ok, true, 'ett eget namn ska få behållas');
});

test('namnet måste vara rimligt, och enheten måste finnas', async () => {
  const { client } = await database();
  const org = await buildOrg(client);
  const { renameUnit } = await import('../src/lib/db/queries/admin.ts');

  for (const dåligt of ['', ' ', 'A', '   B  ']) {
    const svar = await renameUnit(org.bataljon, org.kompani, dåligt);
    assert.equal(svar.ok, false, `"${dåligt}" borde ha avvisats`);
  }
  assert.equal((await renameUnit(org.bataljon, org.kompani, 'x'.repeat(61))).ok, false, 'för långt');
  assert.equal((await renameUnit(org.bataljon, org.kompani, 'x'.repeat(60))).ok, true, '60 tecken ska gå');

  const saknas = await renameUnit(org.bataljon, 999_999, 'Spöket');
  assert.equal(saknas.ok, false);
  assert.match(saknas.error, /saknas|finns inte/i);
});

test('bytet antecknas, men det gamla namnet sparas inte', async () => {
  const { client } = await database();
  const org = await buildOrg(client);
  const { renameUnit } = await import('../src/lib/db/queries/admin.ts');

  await renameUnit(org.bataljon, org.kompani, 'Livkompaniet');

  const [rad] = (await client.execute({
    sql: "SELECT action, detail FROM audit_log WHERE action = 'unit.rename' ORDER BY id DESC LIMIT 1",
    args: [],
  })).rows;

  assert.ok(rad, 'ändringen ska gå att spåra');
  /*
   * Samma regel som för personer: ändringen loggas, det tidigare namnet inte.
   * En granskningslogg som sparar varje gammalt namn blir med tiden en egen
   * samling uppgifter som ingen städar.
   */
  assert.ok(!String(rad.detail ?? '').includes('1. Kompaniet'), 'det gamla namnet får inte lagras');
});

test('samma namn en gång till är ofarligt', async () => {
  const { client } = await database();
  const org = await buildOrg(client);
  const { renameUnit } = await import('../src/lib/db/queries/admin.ts');

  // Dubbelklick, eller ett sparat formulär utan ändring. Ska inte bli ett fel
  // om att namnet är upptaget — av enheten själv.
  const svar = await renameUnit(org.bataljon, org.kompani, '1. Kompaniet');
  assert.equal(svar.ok, true);
});
