/**
 * Återställning vid utelåsning.
 *
 *   npm run aterstall-admin
 *
 * Utfärdar en ny kod till administratörskontot och skriver ut den. Kräver
 * tillgång till serverns filsystem — det är den avsiktliga säkerhetsgränsen:
 * den som kommer åt databasfilen och .env kan ändå allt, så att kunna
 * återställa därifrån ger inte bort något som inte redan var förlorat.
 *
 * Utan det här skulle ett felklick låsa ut den enda administratören för
 * alltid, eftersom koderna bara lagras som hash och inte kan läsas ut.
 */
import { createHmac, randomInt } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createClient } from '@libsql/client';

function loadEnv() {
  const out = {};
  for (const file of ['.env', '.env.local']) {
    try {
      for (const line of readFileSync(file, 'utf8').split('\n')) {
        if (!line.includes('=') || line.trimStart().startsWith('#')) continue;
        const i = line.indexOf('=');
        out[line.slice(0, i).trim()] = line.slice(i + 1).trim();
      }
    } catch {
      /* filen behöver inte finnas */
    }
  }
  return out;
}

const env = loadEnv();

const pepper = process.env.AUTH_PEPPER ?? env.AUTH_PEPPER;
if (!pepper || pepper.length < 32) {
  console.error('AUTH_PEPPER saknas i .env. Utan den går koder inte att räkna om.');
  process.exit(1);
}

// Samma alfabet och hash som src/lib/auth/codes.ts.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const normalize = (s) => s.toUpperCase().replace(/[^A-Z0-9]/g, '');
const hashCode = (c) => createHmac('sha256', pepper).update(normalize(c)).digest('hex');

function generateCode() {
  let raw = '';
  for (let i = 0; i < 10; i++) raw += ALPHABET[randomInt(ALPHABET.length)];
  return `${raw.slice(0, 5)}-${raw.slice(5)}`;
}

const dbPath = process.env.DATABASE_PATH ?? env.DATABASE_PATH ?? './data/psvi.db';
const resolved = path.isAbsolute(dbPath) ? dbPath : path.join(process.cwd(), dbPath);
const client = createClient({ url: `file:${resolved}`, concurrency: 1 });

// Valfritt: ange en egen kod som argument, annars slumpas en.
const wanted = process.argv[2];
const code = wanted ? wanted : generateCode();

const admins = await client.execute("SELECT id, label FROM users WHERE role = 'admin'");

if (admins.rows.length === 0) {
  console.error('Inget administratörskonto finns. Radera databasen så skapas ett vid nästa start.');
  process.exit(1);
}

const admin = admins.rows[0];

await client.execute({
  sql: 'UPDATE users SET code_hash = ?, active = 1 WHERE id = ?',
  args: [hashCode(code), admin.id],
});
// Gamla sessioner bort — den som eventuellt var inloggad ska inte bli kvar.
await client.execute({ sql: 'DELETE FROM sessions WHERE user_id = ?', args: [admin.id] });
await client.execute({
  sql: 'INSERT INTO audit_log (actor_user_id, action, detail, created_at) VALUES (?, ?, ?, ?)',
  args: [admin.id, 'admin.recover', 'Kod återställd via skript', new Date().toISOString()],
});

console.log(`\n  ${admin.label} har fått en ny kod:\n`);
console.log(`      ${code}\n`);
console.log('  Logga in med den. Den visas inte igen.\n');
