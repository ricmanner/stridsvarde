import 'server-only';

import { and, asc, eq, sql } from 'drizzle-orm';

import { generateCode, hashCode } from '../../auth/codes';
import { serviceDate } from '../../date';
import { ROLE_LABEL, type Role } from '../../roles';
import { db } from '..';
import { auditLog, sessions, units, users } from '../schema';

/*
 * Administration av organisation och koder.
 *
 * Ingen fråga här rör check_ins. Att lägga upp en pluton och dela ut koder
 * kräver inte tillgång till någons hälsodata, och rollen får därför inte
 * heller ha den. Det är en strukturell begränsning, inte en inställning:
 * tabellen refereras inte i den här filen.
 */

export type UnitKind = 'bataljon' | 'kompani' | 'pluton' | 'grupp';

/** Vilken nivå som får ligga under vilken. */
const ALLOWED_CHILD: Record<UnitKind, UnitKind | null> = {
  bataljon: 'kompani',
  kompani: 'pluton',
  pluton: 'grupp',
  grupp: null,
};

export const KIND_LABEL: Record<UnitKind, string> = {
  bataljon: 'Bataljon',
  kompani: 'Kompani',
  pluton: 'Pluton',
  grupp: 'Grupp',
};

export interface TreeNode {
  id: number;
  name: string;
  kind: UnitKind;
  parentId: number | null;
  depth: number;
  /** Soldater direkt i enheten. */
  directSoldiers: number;
  /** Soldater i hela subträdet. */
  totalSoldiers: number;
  leaders: number;
}

/** Hela enhetsträdet med antal, i visningsordning. */
export async function getUnitTree(): Promise<TreeNode[]> {
  const rows = (await db.all(sql`
    WITH RECURSIVE tree(id, name, kind, parent_id, depth, path) AS (
          SELECT id, name, kind, parent_id, 0, printf('%04d', id)
            FROM units WHERE parent_id IS NULL
      UNION ALL
          SELECT u.id, u.name, u.kind, u.parent_id, t.depth + 1,
                 t.path || '/' || printf('%04d', u.id)
            FROM units u JOIN tree t ON u.parent_id = t.id
    ),
    sub(root, node) AS (
          SELECT id, id FROM units
      UNION ALL
          SELECT s.root, u.id FROM units u JOIN sub s ON u.parent_id = s.node
    )
    SELECT t.id, t.name, t.kind, t.parent_id, t.depth,
           (SELECT COUNT(*) FROM users x WHERE x.unit_id = t.id AND x.role = 'soldat' AND x.active = 1) AS direct_soldiers,
           (SELECT COUNT(*) FROM users x WHERE x.role = 'soldat' AND x.active = 1
                             AND x.unit_id IN (SELECT node FROM sub WHERE root = t.id)) AS total_soldiers,
           (SELECT COUNT(*) FROM users x WHERE x.unit_id = t.id AND x.role <> 'soldat' AND x.active = 1) AS leaders
      FROM tree t
     ORDER BY t.path
  `)) as Record<string, string | number | null>[];

  return rows.map((r) => ({
    id: Number(r.id),
    name: String(r.name),
    kind: String(r.kind) as UnitKind,
    parentId: r.parent_id === null ? null : Number(r.parent_id),
    depth: Number(r.depth),
    directSoldiers: Number(r.direct_soldiers),
    totalSoldiers: Number(r.total_soldiers),
    leaders: Number(r.leaders),
  }));
}

export interface AdminUser {
  id: number;
  label: string;
  role: Role;
  active: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export async function getUsersInUnit(unitId: number): Promise<AdminUser[]> {
  const rows = await db
    .select({
      id: users.id,
      label: users.label,
      role: users.role,
      active: users.active,
      lastLoginAt: users.lastLoginAt,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.unitId, unitId))
    /*
     * `id` sist som avgörare — inte kosmetik.
     *
     * Utan den har två personer med samma namn ingen bestämd inbördes
     * ordning, och SQLite returnerar dem i en ordning som ändras när en rad
     * uppdateras. Den som just spärrats eller aktiverats hoppar då i listan,
     * och det ser ut som att fel person ändrades.
     */
    .orderBy(asc(users.role), asc(users.label), asc(users.id));

  return rows as AdminUser[];
}

export async function getUnit(unitId: number) {
  const [row] = await db
    .select({ id: units.id, name: units.name, kind: units.kind, parentId: units.parentId })
    .from(units)
    .where(eq(units.id, unitId))
    .limit(1);
  return row ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Ändringar
// ─────────────────────────────────────────────────────────────────────────────

async function audit(actorUserId: number, action: string, detail: string): Promise<void> {
  // Aldrig en kod, aldrig ett hälsovärde — bara vem som gjorde vad.
  await db.insert(auditLog).values({
    actorUserId,
    action,
    detail,
    createdAt: new Date().toISOString(),
  });
}

export async function createUnit(
  actorUserId: number,
  parentId: number,
  name: string,
): Promise<{ ok: true; id: number } | { ok: false; error: string }> {
  const parent = await getUnit(parentId);
  if (!parent) return { ok: false, error: 'Överordnad enhet saknas.' };

  const kind = ALLOWED_CHILD[parent.kind as UnitKind];
  if (!kind) {
    return {
      ok: false,
      error: `En ${KIND_LABEL[parent.kind as UnitKind].toLowerCase()} kan inte delas upp ytterligare.`,
    };
  }

  const trimmed = name.trim();
  if (trimmed.length < 2 || trimmed.length > 60) {
    return { ok: false, error: 'Namnet måste vara mellan 2 och 60 tecken.' };
  }

  try {
    const [row] = await db
      .insert(units)
      .values({ name: trimmed, kind, parentId, createdAt: new Date().toISOString() })
      .returning({ id: units.id });

    await audit(actorUserId, 'unit.create', `${kind}: ${trimmed}`);
    return { ok: true, id: row.id };
  } catch {
    // Unikindexet (parent_id, name) — två syskon får inte heta lika.
    return { ok: false, error: `Det finns redan en enhet som heter "${trimmed}" här.` };
  }
}

export interface IssuedCode {
  label: string;
  code: string;
}

/**
 * Skapar användare och returnerar deras koder i klartext.
 *
 * Det här är den ENDA gången koden existerar i läsbar form. Databasen får
 * bara HMAC-hashen, så koden går inte att hämta fram igen — tappas den måste
 * en ny utfärdas. Anropande vy måste visa dem direkt och göra tydligt att de
 * inte kan visas igen.
 */
export async function createUsers(
  actorUserId: number,
  unitId: number,
  role: Role,
  count: number,
  labelPrefix: string,
): Promise<{ ok: true; codes: IssuedCode[] } | { ok: false; error: string }> {
  const unit = await getUnit(unitId);
  if (!unit) return { ok: false, error: 'Enheten saknas.' };

  if (!Number.isInteger(count) || count < 1 || count > 50) {
    return { ok: false, error: 'Antal måste vara mellan 1 och 50.' };
  }
  if (role === 'soldat' && unit.kind !== 'grupp' && unit.kind !== 'pluton') {
    return { ok: false, error: 'Soldater placeras i en grupp eller pluton.' };
  }

  // Fortsätt numreringen efter de som redan finns i enheten.
  const [existing] = await db
    .select({ n: sql<number>`count(*)` })
    .from(users)
    .where(and(eq(users.unitId, unitId), eq(users.role, role)));

  const startAt = Number(existing?.n ?? 0);
  const now = new Date().toISOString();
  const issued: IssuedCode[] = [];

  for (let i = 0; i < count; i++) {
    const code = generateCode();
    const label =
      role === 'soldat'
        ? `${labelPrefix} ${String(startAt + i + 1).padStart(2, '0')}`
        : labelPrefix;

    await db.insert(users).values({
      codeHash: hashCode(code),
      label,
      role,
      unitId,
      active: true,
      createdAt: now,
    });

    issued.push({ label, code });
  }

  await audit(actorUserId, 'user.create', `${count} × ${role} i ${unit.name}`);
  return { ok: true, codes: issued };
}

/**
 * Spärrar den gamla koden och utfärdar en ny.
 *
 * Användarens sessioner avslutas samtidigt — annars skulle den som har den
 * gamla lappen kunna fortsätta vara inloggad efter att koden spärrats.
 *
 * MED ETT UNDANTAG: byter man ut sin EGEN kod behålls den pågående sessionen.
 * Annars loggas man ut i samma ögonblick som den nya koden visas, hinner inte
 * läsa den, och är utelåst för alltid — koden lagras bara som hash och kan
 * inte hämtas fram igen. Det är säkert, eftersom sessionen hör till personen
 * och inte till koden, och det är personen själv som just begärt bytet.
 */
export async function reissueCode(
  actorUserId: number,
  userId: number,
): Promise<{ ok: true; code: string; label: string } | { ok: false; error: string }> {
  const [user] = await db
    .select({ id: users.id, label: users.label })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) return { ok: false, error: 'Användaren saknas.' };

  const code = generateCode();
  await db.update(users).set({ codeHash: hashCode(code) }).where(eq(users.id, userId));

  if (userId !== actorUserId) {
    await db.delete(sessions).where(eq(sessions.userId, userId));
  }

  await audit(actorUserId, 'code.reissue', `användare ${userId}`);
  return { ok: true, code, label: user.label };
}

/** Vilka enhetsnivåer en roll får tillhöra. */
const KIND_FOR_ROLE: Record<Role, UnitKind[]> = {
  soldat: ['grupp', 'pluton'],
  pluton: ['pluton'],
  kompani: ['kompani'],
  bataljon: ['bataljon'],
  admin: ['bataljon', 'kompani', 'pluton', 'grupp'],
};

export interface MoveTarget {
  id: number;
  name: string;
  kind: UnitKind;
  /** Hela vägen ned, så att två "Grupp 1" går att skilja åt. */
  path: string;
}

/** Enheter en viss roll kan flyttas till, med full sökväg som etikett. */
export async function getMoveTargets(role: Role): Promise<MoveTarget[]> {
  const kinds = KIND_FOR_ROLE[role];

  const rows = (await db.all(sql`
    WITH RECURSIVE tree(id, name, kind, parent_id, path, sort) AS (
          SELECT id, name, kind, parent_id, name, printf('%04d', id)
            FROM units WHERE parent_id IS NULL
      UNION ALL
          SELECT u.id, u.name, u.kind, u.parent_id,
                 t.path || ' › ' || u.name,
                 t.sort || '/' || printf('%04d', u.id)
            FROM units u JOIN tree t ON u.parent_id = t.id
    )
    SELECT id, name, kind, path FROM tree ORDER BY sort
  `)) as Record<string, string | number>[];

  return rows
    .map((r) => ({
      id: Number(r.id),
      name: String(r.name),
      kind: String(r.kind) as UnitKind,
      path: String(r.path),
    }))
    .filter((u) => kinds.includes(u.kind));
}

/**
 * Flyttar en person till en annan enhet.
 *
 * Utan det här fanns bara en väg när en soldat bytte grupp: spärra kontot och
 * skapa ett nytt. Det raderar personens historik och kräver en ny utdelad kod
 * — för något som händer flera gånger under en utbildningsomgång.
 *
 * Sessionen rörs inte. Personen är densamma, bara på ett annat ställe, och
 * nästa sidladdning visar den nya enhetens data.
 *
 * OBS: incheckningarna följer med personen, så historik från tiden i den
 * gamla enheten räknas in i den nya enhetens aggregat. Det är en medveten
 * förenkling — att göra det korrekt kräver tidsatt enhetstillhörighet, vilket
 * gör varje aggregatfråga dubbelt så komplicerad. Gränssnittet säger detta
 * rakt ut i stället för att låtsas att siffrorna är exakta.
 */
export async function moveUser(
  actorUserId: number,
  userId: number,
  targetUnitId: number,
): Promise<{ ok: true; unitName: string } | { ok: false; error: string }> {
  const [user] = await db
    .select({ id: users.id, label: users.label, role: users.role, unitId: users.unitId })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) return { ok: false, error: 'Personen saknas.' };
  if (user.unitId === targetUnitId) {
    return { ok: false, error: 'Personen tillhör redan den enheten.' };
  }

  const target = await getUnit(targetUnitId);
  if (!target) return { ok: false, error: 'Målenheten saknas.' };

  const allowed = KIND_FOR_ROLE[user.role as Role];
  if (!allowed.includes(target.kind as UnitKind)) {
    return {
      ok: false,
      error: `${ROLE_LABEL[user.role as Role]} kan inte placeras på ${KIND_LABEL[target.kind as UnitKind].toLowerCase()}snivå.`,
    };
  }

  await db.update(users).set({ unitId: targetUnitId }).where(eq(users.id, userId));
  await audit(actorUserId, 'user.move', `användare ${userId} → enhet ${targetUnitId}`);

  return { ok: true, unitName: target.name };
}

/** Antal aktiva administratörer utöver en given användare. */
async function otherActiveAdmins(exceptUserId: number): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)` })
    .from(users)
    .where(sql`role = 'admin' AND active = 1 AND id <> ${exceptUserId}`);
  return Number(row?.n ?? 0);
}

export async function setUserActive(
  actorUserId: number,
  userId: number,
  active: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!active) {
    // Att spärra sig själv har ingen rimlig användning och låser ute den som
    // gör det. Behöver man byta administratör lägger man upp den nya först.
    if (userId === actorUserId) {
      return { ok: false, error: 'Du kan inte spärra ditt eget konto.' };
    }

    // Sista administratören får inte spärras — då kan ingen administrera
    // systemet, och återställning kräver tillgång till servern.
    const [target] = await db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (target?.role === 'admin' && (await otherActiveAdmins(userId)) === 0) {
      return { ok: false, error: 'Det måste finnas minst en aktiv administratör.' };
    }
  }

  await db.update(users).set({ active }).where(eq(users.id, userId));

  // Avaktivering ska slå igenom direkt, inte när sessionen råkar löpa ut.
  if (!active) await db.delete(sessions).where(eq(sessions.userId, userId));

  await audit(actorUserId, active ? 'user.activate' : 'user.deactivate', `användare ${userId}`);
  return { ok: true };
}

/** Enkel driftsöversikt för adminstartsidan. Inga hälsovärden. */
export async function getAdminStats() {
  const one = async (q: Promise<{ n: number }[]>) => (await q)[0]?.n ?? 0;

  return {
    units: await one(db.select({ n: sql<number>`count(*)` }).from(units)),
    soldiers: await one(
      db.select({ n: sql<number>`count(*)` }).from(users).where(and(eq(users.role, 'soldat'), eq(users.active, true))),
    ),
    leaders: await one(
      db.select({ n: sql<number>`count(*)` }).from(users).where(sql`role <> 'soldat' AND role <> 'admin' AND active = 1`),
    ),
    inactive: await one(
      db.select({ n: sql<number>`count(*)` }).from(users).where(eq(users.active, false)),
    ),
    today: serviceDate(),
  };
}
