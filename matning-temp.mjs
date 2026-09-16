import { register } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
const ROOT = import.meta.dirname;
register('./tests/ts-resolver.mjs', pathToFileURL(path.join(ROOT, 'x.mjs')));

const { client } = await import(`${ROOT}/src/lib/db/client.ts`);

// Räkna och tidsätt varje SQL-anrop.
let n = 0, total = 0;
for (const m of ['execute', 'batch']) {
  const orig = client[m].bind(client);
  client[m] = async (...a) => {
    const t = Date.now();
    try { return await orig(...a); } finally { n++; total += Date.now() - t; }
  };
}

const A = await import(`${ROOT}/src/lib/db/queries/admin.ts`);
const { retentionStatus } = await import(`${ROOT}/src/lib/db/retention.ts`);

const steg = async (namn, fn) => {
  const f = n, t = Date.now();
  const r = await fn();
  console.log(`  ${namn.padEnd(26)} ${String(Date.now() - t).padStart(5)} ms   ${n - f} frågor`);
  return r;
};

console.log('\n  Vad /admin?unit=6 gör:\n');
const tAll = Date.now();
await steg('getUnitTree + stats + gallring', () =>
  Promise.all([A.getUnitTree(), A.getAdminStats(), retentionStatus()]));
await steg('getUnit', () => A.getUnit(6));
const members = await steg('getUsersInUnit', () => A.getUsersInUnit(6));
const roles = [...new Set(members.map((m) => m.role))];
await steg(`getMoveTargets (${roles.length} roller)`, () =>
  Promise.all(roles.map((r) => A.getMoveTargets(r))));

console.log(`\n  SUMMA ${Date.now() - tAll} ms — ${n} SQL-frågor, ${total} ms i nätverket\n`);
process.exit(0);
