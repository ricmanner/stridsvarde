import 'server-only';

import { sql } from 'drizzle-orm';

import { generateSoldierAdvice } from '../advice';
import { hashCode } from '../auth/codes';
import { serviceDateDaysAgo } from '../date';
import type { Category } from '../data';
import { db, isSeedDemoData } from './client';
import { auditLog, checkIns, units, users } from './schema';

/** Deterministisk PRNG så att demodatan ser likadan ut vid varje omstart. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedFrom(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const CATS: Category[] = ['fysisk', 'psykisk', 'social', 'somn', 'kost', 'energi'];

/**
 * Per-pluton utgångsläge per kategori. Pluton 1 har medvetet dålig sömn och
 * kost så att demon berättar samma historia som prototypen gjorde, och så att
 * tröskelvärdeslarmen faktiskt utlöses någonstans.
 */
const PLUTON_PROFILE: Record<string, Partial<Record<Category, number>>> = {
  'Pluton 1': { somn: 3.4, kost: 3.8, energi: 4.2 },
  'Pluton 2': { psykisk: 4.4, social: 4.8 },
  'Pluton 7': { fysisk: 4.6, energi: 4.5 },
};

const PLUTON_BASE: Record<string, number> = {
  'Pluton 1': 6.4, 'Pluton 2': 5.2, 'Pluton 3': 7.0,
  'Pluton 4': 6.6, 'Pluton 5': 7.4, 'Pluton 6': 6.1,
  'Pluton 7': 5.6, 'Pluton 8': 6.8, 'Pluton 9': 7.1,
};

/**
 * Soldater som lämnas utan dagens incheckning.
 *
 * Utan det här får varje seedad soldat en rapport redan för idag, och den som
 * loggar in skickas direkt till översikten utan att någonsin se
 * incheckningen — alltså precis det flöde som ska demonstreras. Grupp 1 i
 * Pluton 1 är ingången i demon och har därför dagen öppen. Att åtta av
 * plutonens tjugofyra saknas gör dessutom svarsfrekvensen realistisk i stället
 * för att stå på 100 %.
 */
const DAGEN_OPPEN = /^P1G1-/;

const KOMPANI_PLUTONER: Record<string, string[]> = {
  '1. Kompaniet': ['Pluton 1', 'Pluton 2', 'Pluton 3'],
  '2. Kompaniet': ['Pluton 4', 'Pluton 5', 'Pluton 6'],
  '3. Kompaniet': ['Pluton 7', 'Pluton 8', 'Pluton 9'],
};

const GRUPPER_PER_PLUTON = 3;
const SOLDATER_PER_GRUPP = 8;
const HISTORIK_DAGAR = 14;
/** Ungefärlig svarsfrekvens i demodatan — så att siffran betyder något. */
const SVARSSANNOLIKHET = 0.82;

const now = () => new Date().toISOString();

function clamp(n: number): number {
  return Math.max(1, Math.min(10, Math.round(n)));
}

async function insertChunked<T>(
  rows: T[],
  insert: (chunk: T[]) => Promise<unknown>,
  size = 200,
): Promise<void> {
  for (let i = 0; i < rows.length; i += size) {
    await insert(rows.slice(i, i + size));
  }
}

/**
 * Körs vid varje serverstart men gör bara något om databasen är tom.
 * Skapar alltid ett admin-konto; demoorganisationen bara när SEED_DEMO_DATA=true.
 */
export async function seedIfNeeded(): Promise<void> {
  /*
   * Hela seeden ligger i EN transaktion.
   *
   * Utan den kan två processer som startar mot samma databasfil båda se en
   * tom tabell och båda seeda — resultatet blir en halvdubblerad organisation
   * som är svår att upptäcka i efterhand. Med transaktionen blockerar den
   * andra processen tills den första är klar, ser då att enheter finns och
   * avbryter. Allt-eller-inget.
   *
   * OBS: inuti callbacken måste `tx` användas, aldrig `db`. Klienten kör med
   * concurrency: 1, så ett `db`-anrop här skulle vänta på en anslutning som
   * transaktionen håller.
   */
  await db.transaction(async (tx) => {
    await seedInTransaction(tx);
  });
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function seedInTransaction(tx: Tx): Promise<void> {
  const [{ count }] = await tx
    .select({ count: sql<number>`count(*)` })
    .from(units);

  if (count > 0) return; // redan seedad, eller seedad av en annan process

  const demo = isSeedDemoData();
  const ts = now();

  // ── Enhetsträd ────────────────────────────────────────────────────────────
  const [bataljon] = await tx
    .insert(units)
    .values({ name: 'Bataljonen', kind: 'bataljon', parentId: null, createdAt: ts })
    .returning({ id: units.id });

  // Adminkontot behövs alltid, annars går det inte att komma igång.
  const adminCode = demo ? 'ADMIN-01' : (await import('../auth/codes')).generateCode();
  await tx.insert(users).values({
    codeHash: hashCode(adminCode),
    label: 'Systemadministratör',
    role: 'admin',
    unitId: bataljon.id,
    active: true,
    createdAt: ts,
  });
  await tx.insert(auditLog).values({
    actorUserId: null,
    action: 'bootstrap_admin',
    detail: 'Adminkonto skapat vid första start',
    createdAt: ts,
  });

  if (!demo) {
    console.log('\n  Databasen är tom. Adminkod:  %s', adminCode);
    console.log('  Spara den — den visas bara en gång.\n');
    return;
  }

  // ── Demoorganisation ──────────────────────────────────────────────────────
  await tx.insert(users).values({
    codeHash: hashCode('BEF-BAT'),
    label: 'Bataljonschef',
    role: 'bataljon',
    unitId: bataljon.id,
    active: true,
    createdAt: ts,
  });

  type SoldierRow = { id: number; plutonName: string; code: string };
  const soldiers: SoldierRow[] = [];

  let kompaniNr = 0;
  for (const [kompaniNamn, plutonNamn] of Object.entries(KOMPANI_PLUTONER)) {
    kompaniNr++;

    const [kompani] = await tx
      .insert(units)
      .values({ name: kompaniNamn, kind: 'kompani', parentId: bataljon.id, createdAt: ts })
      .returning({ id: units.id });

    await tx.insert(users).values({
      codeHash: hashCode(`BEF-KP${kompaniNr}`),
      label: `Kompanichef ${kompaniNamn}`,
      role: 'kompani',
      unitId: kompani.id,
      active: true,
      createdAt: ts,
    });

    for (const pNamn of plutonNamn) {
      const plutonNr = Number(pNamn.split(' ')[1]);

      const [pluton] = await tx
        .insert(units)
        .values({ name: pNamn, kind: 'pluton', parentId: kompani.id, createdAt: ts })
        .returning({ id: units.id });

      await tx.insert(users).values({
        codeHash: hashCode(`BEF-P${plutonNr}`),
        label: `Plutonchef ${pNamn}`,
        role: 'pluton',
        unitId: pluton.id,
        active: true,
        createdAt: ts,
      });

      for (let g = 1; g <= GRUPPER_PER_PLUTON; g++) {
        const [grupp] = await tx
          .insert(units)
          .values({ name: `Grupp ${g}`, kind: 'grupp', parentId: pluton.id, createdAt: ts })
          .returning({ id: units.id });

        // Koden hålls utanför raden — den ska aldrig kunna råka skrivas till
        // databasen, bara användas för att para ihop soldat och kod efteråt.
        const rows = Array.from({ length: SOLDATER_PER_GRUPP }, (_, i) => {
          const nr = String(i + 1).padStart(2, '0');
          const code = `P${plutonNr}G${g}-${nr}`;
          return {
            code,
            row: {
              codeHash: hashCode(code),
              label: `Soldat ${nr}`,
              role: 'soldat' as const,
              unitId: grupp.id,
              active: true,
              createdAt: ts,
            },
          };
        });

        const inserted = await tx
          .insert(users)
          .values(rows.map((r) => r.row))
          .returning({ id: users.id });

        inserted.forEach((u, i) => {
          soldiers.push({ id: u.id, plutonName: pNamn, code: rows[i].code });
        });
      }
    }
  }

  // ── Historik ──────────────────────────────────────────────────────────────
  const checkInRows: (typeof checkIns.$inferInsert)[] = [];

  for (const soldier of soldiers) {
    const rnd = mulberry32(seedFrom(soldier.code));
    const base = PLUTON_BASE[soldier.plutonName] ?? 6.5;
    const profile = PLUTON_PROFILE[soldier.plutonName] ?? {};
    // Varje soldat har en egen personlig avvikelse som består över tid.
    const personal = (rnd() - 0.5) * 2.4;

    for (let d = HISTORIK_DAGAR - 1; d >= 0; d--) {
      if (d === 0 && DAGEN_OPPEN.test(soldier.code)) continue; // se DAGEN_OPPEN ovan
      if (rnd() > SVARSSANNOLIKHET) continue; // soldaten checkade inte in den dagen

      const dayShift = (rnd() - 0.5) * 1.6;
      const scores = {} as Record<Category, number>;
      for (const cat of CATS) {
        const catBase = profile[cat] ?? base;
        scores[cat] = clamp(catBase + personal + dayShift + (rnd() - 0.5) * 1.8);
      }

      checkInRows.push({
        userId: soldier.id,
        serviceDate: serviceDateDaysAgo(d),
        ...scores,
        advice: generateSoldierAdvice(scores),
        createdAt: ts,
      });
    }
  }

  await insertChunked(checkInRows, (chunk) => tx.insert(checkIns).values(chunk));

  console.log(
    '\n  Demodata seedad: %d enheter, %d soldater, %d incheckningar',
    1 + 3 + 9 + 9 * GRUPPER_PER_PLUTON,
    soldiers.length,
    checkInRows.length,
  );
  console.log('  Demokoder:  ADMIN-01 · BEF-BAT · BEF-KP1 · BEF-P1 · P1G1-01\n');
}
