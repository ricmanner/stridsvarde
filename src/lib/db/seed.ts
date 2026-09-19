import 'server-only';

import { sql } from 'drizzle-orm';

import { generateSoldierAdvice } from '../advice';
import { hashCode } from '../auth/codes';
import { serviceDateDaysAgo } from '../date';
import type { Category } from '../data';
import { db, environment, isSeedDemoData } from './client';
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

const KOMPANI_PLUTONER: Record<string, string[]> = {
  '1. Kompaniet': ['Pluton 1', 'Pluton 2', 'Pluton 3'],
  '2. Kompaniet': ['Pluton 4', 'Pluton 5', 'Pluton 6'],
  '3. Kompaniet': ['Pluton 7', 'Pluton 8', 'Pluton 9'],
};

const GRUPPER_PER_PLUTON = 3;
const SOLDATER_PER_GRUPP = 8;

/**
 * Soldater som lämnas utan dagens incheckning.
 *
 * Utan det här får varje seedad soldat en rapport redan för idag, och den som
 * loggar in skickas direkt till översikten utan att någonsin se
 * incheckningen — alltså precis det flöde som ska demonstreras. Grupp 1 i
 * Pluton 1 är ingången i demon och har därför dagen öppen. Att åtta av
 * plutonens tjugofyra saknas gör dessutom svarsfrekvensen realistisk i stället
 * för att stå på 100 %.
 *
 * Exporterad som lista, inte som mönster: `npm run demo:uppdatera` öppnar
 * samma konton igen när demodatan flyttas fram, och måste veta exakt vilka.
 */
export const DAGEN_OPPEN: readonly string[] = Array.from(
  { length: SOLDATER_PER_GRUPP },
  (_, i) => `P1G1-${String(i + 1).padStart(2, '0')}`,
);
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

/**
 * Tömmer demon och bygger upp den igen från grunden.
 *
 * Besökare ska kunna radera enheter, spärra konton och byta koder — det är
 * hälften av det appen ska visa, och demokoderna står på inloggningssidan
 * just för att vem som helst ska kunna prova. Priset är att demon slits ner.
 * Före en visning måste den gå att ställa i ordning igen, och mot den delade
 * databasen finns ingen väg dit från en terminal: nycklarna är märkta som
 * känsliga och kommer tillbaka som [SENSITIVE].
 *
 * Allt sker i en transaktion. Avbryts något mitt i står databasen kvar som
 * den var — en halvt återställd demo vore värre än en sliten.
 *
 * Den som trycker loggas ut. Sessionerna pekar på personer som inte längre
 * finns, så de måste bort; koderna är desamma efteråt och står kvar på
 * inloggningssidan.
 */
export async function aterstallDemo(): Promise<void> {
  /*
   * Kontrollen ligger FÖRE tömningen, av två skäl. Det uppenbara: i ett
   * pilottest är varje rapport en verklig människas och får aldrig raderas.
   * Det mindre uppenbara: efteråt finns inga demokonton kvar att känna igen
   * databasen på, så en kontroll efter tömningen hade varit blind.
   */
  if (environment() !== 'demo') {
    throw new Error(
      'Vägrar: PSVI_ENVIRONMENT är inte "demo". Återställningen raderar all ' +
        'hälsodata och får aldrig köras mot ett pilottest.',
    );
  }

  await db.transaction(async (tx) => {
    // Beroende före beroendemål. check_ins, sessions och notifications städas
    // av kaskaden när users går, men uttryckligt är lättare att läsa än en
    // regel i schemat man måste slå upp.
    await tx.run(sql`DELETE FROM notifications`);
    await tx.run(sql`DELETE FROM sessions`);
    await tx.run(sql`DELETE FROM check_ins`);
    await tx.run(sql`DELETE FROM login_attempts`);
    await tx.run(sql`DELETE FROM users`);

    /*
     * Enheterna djupast först. Främmande nyckel på parent_id är `restrict`,
     * så en förälder kan inte raderas medan ett barn finns kvar — och i
     * vilken ordning en enda DELETE behandlar raderna går inte att styra.
     */
    const djupast = (await tx.all(sql`
      WITH RECURSIVE d(id, depth) AS (
            SELECT id, 0 FROM units WHERE parent_id IS NULL
        UNION ALL
            SELECT u.id, d.depth + 1 FROM units u JOIN d ON u.parent_id = d.id
      )
      SELECT id FROM d ORDER BY depth DESC
    `)) as { id: number }[];

    for (const { id } of djupast) {
      await tx.run(sql`DELETE FROM units WHERE id = ${id}`);
    }

    // Uttryckligen `true`: aldrig ur miljövariabeln. Se seedInTransaction().
    await seedInTransaction(tx, true);

    await tx.insert(auditLog).values({
      actorUserId: null,
      action: 'demo.reset',
      detail: 'Demon återställd till utgångsläget',
      createdAt: now(),
    });
  });
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * @param demo Om demoorganisationen ska skapas. Standard är miljövariabeln,
 *   men återställningen skickar in `true` uttryckligen. Skälet: mot den
 *   delade demon seedas databasen från en terminal, inte av servern, så
 *   `SEED_DEMO_DATA` behöver inte vara satt i den miljö servern kör i. Läste
 *   återställningen variabeln skulle den kunna skapa ett ensamt adminkonto
 *   med en slumpmässig kod — och låsa ute alla, för alltid.
 */
async function seedInTransaction(tx: Tx, demo: boolean = isSeedDemoData()): Promise<void> {
  const [{ count }] = await tx
    .select({ count: sql<number>`count(*)` })
    .from(units);

  if (count > 0) return; // redan seedad, eller seedad av en annan process

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
              label: `Värnpliktig ${nr}`,
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
      if (d === 0 && DAGEN_OPPEN.includes(soldier.code)) continue; // se DAGEN_OPPEN ovan
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
