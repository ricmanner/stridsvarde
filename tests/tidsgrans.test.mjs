/**
 * Tidsgränsen som avbryter väntan på något som aldrig svarar.
 *
 * Appen har inte haft någon bortre gräns alls. Hänger databasen väntar
 * servern för evigt, och den värnpliktige sitter kvar på "Sparar…".
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import './setup.mjs';

/** Ett löfte som aldrig blir klart — en hängande databas, i en rad. */
const hänger = () => new Promise(() => {});

test('svar som hinner fram lämnas tillbaka orört', async () => {
  const { medTidsgräns } = await import('../src/lib/tidsgrans.ts');

  assert.equal(await medTidsgräns(Promise.resolve(42), 1_000, 'test'), 42);
});

test('något som aldrig svarar avbryts i stället för att vänta för evigt', async () => {
  const { medTidsgräns, Tidsgränsfel } = await import('../src/lib/tidsgrans.ts');

  const start = Date.now();
  await assert.rejects(
    () => medTidsgräns(hänger(), 50, 'sparandet'),
    (fel) => {
      assert.ok(fel instanceof Tidsgränsfel, 'ska gå att skilja från andra fel');
      // Felet ska säga VAD som inte svarade. Står det bara "timeout" i
      // felloggen kan administratören inte veta var i appen det satt.
      assert.match(fel.message, /sparandet/);
      return true;
    },
  );
  assert.ok(Date.now() - start < 1_000, 'ska ha gett upp efter sin egen gräns');
});

test('ett fel från arbetet självt slipper igenom oförändrat', async () => {
  const { medTidsgräns, Tidsgränsfel } = await import('../src/lib/tidsgrans.ts');

  // Annars döljs en trasig SQL-fråga bakom ett missvisande "svarade inte i
  // tid", och nästa person felsöker nätet i stället för frågan.
  const eget = new Error('UNIQUE constraint failed');
  await assert.rejects(
    () => medTidsgräns(Promise.reject(eget), 1_000, 'sparandet'),
    (fel) => {
      assert.equal(fel, eget);
      assert.ok(!(fel instanceof Tidsgränsfel));
      return true;
    },
  );
});

test('klockan städas bort när arbetet hann klart', async () => {
  const { medTidsgräns } = await import('../src/lib/tidsgrans.ts');

  /*
   * En timer som inte stoppas håller händelseslingan vid liv tills den
   * löper ut. I en serverlös funktion betyder det att svaret till den
   * värnpliktige kan bli liggande i tio sekunder trots att sparandet gick
   * på tjugo millisekunder — alltså exakt det fel vi försöker rätta.
   */
  const före = process.getActiveResourcesInfo().filter((r) => r === 'Timeout').length;
  await medTidsgräns(Promise.resolve('klart'), 60_000, 'test');
  const efter = process.getActiveResourcesInfo().filter((r) => r === 'Timeout').length;

  assert.ok(efter <= före, `en timer lämnades kvar (${före} → ${efter})`);
});

test('webbläsaren ger upp senare än servern', async () => {
  const { TIDSGRÄNS_SERVER_MS, TIDSGRÄNS_KLIENT_MS } = await import('../src/lib/tidsgrans.ts');

  // Ger klienten upp först hinner serverns ärliga felmeddelande aldrig fram,
  // och en incheckning som faktiskt sparades kan se ut att ha misslyckats.
  assert.ok(
    TIDSGRÄNS_KLIENT_MS > TIDSGRÄNS_SERVER_MS,
    `klienten (${TIDSGRÄNS_KLIENT_MS} ms) måste vänta längre än servern (${TIDSGRÄNS_SERVER_MS} ms)`,
  );
});
