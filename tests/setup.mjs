/**
 * Gemensam uppsättning för testerna.
 *
 * Databasen skapas EN gång per testfil. Skälet är att Node cachar moduler:
 * appens databasklient binds till DATABASE_PATH vid första importen och
 * följer inte med om variabeln ändras senare.
 *
 * Testerna rensar aldrig databasen. I stället bygger varje test sin egen
 * organisation och frågar bara om sina egna id:n. Eftersom id-sekvensen
 * räknar uppåt kan två tester aldrig krocka, och de kan därför köras
 * parallellt — vilket Node gör som standard.
 */
import { register } from 'node:module';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

register('./ts-resolver.mjs', pathToFileURL(path.join(import.meta.dirname, '/')));

const ROOT = path.resolve(import.meta.dirname, '..');

/*
 * Miljön sätts HÄR, på modulnivå, inte inne i database().
 *
 * src/lib/db/client.ts läser DATABASE_PATH när modulen laddas och binder sig
 * till den sökvägen för resten av processen. Sätts variabeln först inne i en
 * async-funktion hinner ett test som importerar appkod direkt binda klienten
 * till standardsökvägen — alltså den riktiga databasen. Eftersom varje testfil
 * importerar den här modulen överst körs det som följer före allt annat.
 */
const TEST_DIR = mkdtempSync(path.join(tmpdir(), 'psvi-test-'));
const TEST_DB = path.join(TEST_DIR, 'test.db');

process.env.DATABASE_PATH = TEST_DB;
process.env.SEED_DEMO_DATA = 'false';
process.env.AUTH_PEPPER = 'test-pepper-som-ar-tillrackligt-lang-for-att-duga';
process.env.MIN_RESPONDERS = '4';

/*
 * Memoiserar LÖFTET, inte resultatet.
 *
 * Node kör testerna i en fil parallellt. Med `if (shared) return shared`
 * hinner flera tester förbi kontrollen innan den första hunnit sätta värdet,
 * och då skapas en databas per test medan appens klient bundits till en enda
 * av dem. Genom att spara löftet väntar alla på samma uppsättning.
 */
let sharedPromise = null;

/** Databasen för den här testfilen. Skapas en gång, delas av alla tester. */
export function database() {
  if (!sharedPromise) sharedPromise = createDatabase();
  return sharedPromise;
}

async function createDatabase() {
  const { createClient } = await import('@libsql/client');
  const client = createClient({ url: `file:${TEST_DB}`, concurrency: 1 });

  // Kör den faktiska migrationen, inte ett handskrivet schema. Ändras schemat
  // utan att migrationen följer med upptäcks det här.
  const migrationDir = path.join(ROOT, 'drizzle');
  const journal = JSON.parse(
    readFileSync(path.join(migrationDir, 'meta', '_journal.json'), 'utf8'),
  );
  for (const entry of journal.entries) {
    const sqlText = readFileSync(path.join(migrationDir, `${entry.tag}.sql`), 'utf8');
    for (const stmt of sqlText.split('--> statement-breakpoint')) {
      if (stmt.trim()) await client.execute(stmt);
    }
  }
  await client.execute('PRAGMA foreign_keys = ON');

  return {
    client,
    file: TEST_DB,
    cleanup: () => rmSync(TEST_DIR, { recursive: true, force: true }),
  };
}

const iso = () => new Date().toISOString();

/**
 * Bygger en liten organisation: en pluton med två grupper om åtta soldater.
 * Returnerar id:n så att testerna kan styra exakt vem som svarar.
 */
export async function buildOrg(client) {
  const insert = async (sql, args) => {
    const r = await client.execute({ sql, args });
    return Number(r.lastInsertRowid);
  };

  const bataljon = await insert(
    'INSERT INTO units (name, kind, parent_id, created_at) VALUES (?,?,?,?)',
    ['Bataljonen', 'bataljon', null, iso()],
  );
  const kompani = await insert(
    'INSERT INTO units (name, kind, parent_id, created_at) VALUES (?,?,?,?)',
    ['1. Kompaniet', 'kompani', bataljon, iso()],
  );
  const pluton = await insert(
    'INSERT INTO units (name, kind, parent_id, created_at) VALUES (?,?,?,?)',
    ['Pluton 1', 'pluton', kompani, iso()],
  );

  const grupper = {};
  const soldater = {};
  for (const namn of ['Grupp A', 'Grupp B']) {
    const id = await insert(
      'INSERT INTO units (name, kind, parent_id, created_at) VALUES (?,?,?,?)',
      [namn, 'grupp', pluton, iso()],
    );
    grupper[namn] = id;
    soldater[namn] = [];
    for (let i = 1; i <= 8; i++) {
      soldater[namn].push(
        await insert(
          'INSERT INTO users (code_hash, label, role, unit_id, active, created_at) VALUES (?,?,?,?,1,?)',
          [`hash-${id}-${i}`, `Soldat ${i}`, 'soldat', id, iso()],
        ),
      );
    }
  }

  return { bataljon, kompani, pluton, grupper, soldater };
}

/** Låter angivna soldater checka in en given dag, alla med samma värde. */
export async function checkIn(client, userIds, date, value) {
  for (const id of userIds) {
    await client.execute({
      sql: `INSERT INTO check_ins (user_id, service_date, fysisk, psykisk, social, somn, kost, energi, created_at)
            VALUES (?,?,?,?,?,?,?,?,?)`,
      args: [id, date, value, value, value, value, value, value, iso()],
    });
  }
}
