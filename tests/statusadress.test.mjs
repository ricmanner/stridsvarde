/**
 * Vad statussidan får avslöja om databasen.
 *
 * I demoläge står administratörskoden på inloggningssidan — det är meningen,
 * vem som helst ska kunna prova appen som administratör. Följden är att
 * statussidan i praktiken är offentlig, och hela adressen till fjärrdatabasen
 * stod där: värdnamn, region och kontonamn. Det är färdig spaning åt den som
 * vill angripa databasen, och nyckeln är det enda som återstår.
 *
 * I pilotläge finns ingen publicerad kod och administratören är en betrodd
 * person. Då är adressen det den ska vara — felsökningshjälp.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import './setup.mjs';

const { dbAdressFörVisning } = await import('../src/lib/db/client.ts');

const FJÄRR = 'libsql://psvi-demo-ricmanner.aws-eu-west-1.turso.io';
const LOKAL = '/Users/nagon/Code/stridsvarde-v2/data/psvi.db';

test('demoläge avslöjar inte fjärrdatabasens adress', () => {
  const visat = dbAdressFörVisning(FJÄRR, true);

  assert.ok(!visat.includes('psvi-demo-ricmanner'), 'kontonamnet läckte');
  assert.ok(!visat.includes('turso.io'), 'värdnamnet läckte');
  assert.ok(!visat.includes('aws-eu-west-1'), 'regionen läckte');
});

test('demoläge säger ändå vilken sorts databas det är', () => {
  // Administratören ska kunna se att appen kör mot en delad fjärrdatabas och
  // inte mot en lokal fil — det är skillnaden som betyder något vid felsökning.
  assert.match(dbAdressFörVisning(FJÄRR, true), /fjärr/i);
  assert.match(dbAdressFörVisning(LOKAL, true), /lokal/i);
});

test('demoläge avslöjar inte heller en lokal sökväg', () => {
  // En lokal sökväg innehåller användarnamnet på maskinen.
  const visat = dbAdressFörVisning(LOKAL, true);

  assert.ok(!visat.includes('nagon'), 'användarnamnet läckte');
  assert.ok(!visat.includes('/Users/'), 'sökvägen läckte');
});

test('pilotläge visar adressen som den är', () => {
  // Ingen publicerad kod, betrodd administratör, verklig felsökningsnytta.
  assert.equal(dbAdressFörVisning(FJÄRR, false), FJÄRR);
  assert.equal(dbAdressFörVisning(LOKAL, false), LOKAL);
});
