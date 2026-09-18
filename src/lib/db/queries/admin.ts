import 'server-only';

import { and, asc, eq, inArray, sql } from 'drizzle-orm';

import { generateCode, hashCode } from '../../auth/codes';
import { serviceDate } from '../../date';
import { DEMOKONTO_SKYDDAT, PUBLICERADE_DEMOKODER } from '../../demo';
import { ROLE_LABEL, type Role } from '../../roles';
import { db } from '..';
import { environment } from '../client';
import { eraseCheckInsForUsers, erasePersonalData } from '../retention';
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
  /**
   * Publicerat demokonto: står på inloggningssidan och går varken att
   * spärra, byta kod på eller radera. Alltid falskt i pilotläge.
   *
   * Beräknas på servern ur kodhashen, som aldrig lämnar den här funktionen.
   */
  skyddad: boolean;
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
      codeHash: users.codeHash,
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

  /*
   * Hashen används här och skickas inte vidare. Vyn behöver veta VILKA rader
   * som är låsta för att kunna gråa ut knapparna, men den behöver inte — och
   * ska inte — få kodhashar till webbläsaren.
   */
  const skyddade =
    environment() === 'demo'
      ? new Set(PUBLICERADE_DEMOKODER.map(({ kod }) => hashCode(kod)))
      : null;

  return rows.map(({ codeHash, ...rad }) => ({
    ...rad,
    skyddad: skyddade?.has(codeHash) ?? false,
  })) as AdminUser[];
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
  /*
   * Längden kontrollerades bara av formulärets maxLength, alltså inte alls:
   * fältet går att ändra i webbläsaren och en Server Action är en vanlig POST.
   * En benämning på 500 tecken sparades rakt in och gjorde listan oläslig.
   */
  const prefix = labelPrefix.trim();
  if (prefix.length > MAX_LABEL) {
    return { ok: false, error: `Benämningen får vara högst ${MAX_LABEL} tecken.` };
  }
  // Bara mellanslag är ingen benämning — då blev namnet "    09".
  const grund = prefix || 'Värnpliktig';
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
        ? `${grund} ${String(startAt + i + 1).padStart(2, '0')}`
        : grund;

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
 * SIN EGEN KOD KAN MAN INTE BYTA. Den nya koden visas en enda gång och
 * lagras bara som hash; hinner man inte skriva av den är man utelåst för
 * gott. Det hände tre gånger under utvecklingen, och varje gång krävdes
 * terminalåtkomst till servern för att ta sig in igen. Varningsrutor och
 * bekräftelser räckte inte — en åtgärd som inte går att ångra och som inte
 * behöver kunna göras av personen själv ska inte finnas där.
 *
 * Behöver en administratör en ny kod finns två vägar: en annan
 * administratör utfärdar den, eller `npm run aterstall-admin` på servern.
 * Det är dessutom rimligare i sak — man utfärdar inte sina egna
 * inloggningsuppgifter.
 */
export async function reissueCode(
  actorUserId: number,
  userId: number,
): Promise<{ ok: true; code: string; label: string } | { ok: false; error: string }> {
  if (userId === actorUserId) {
    return {
      ok: false,
      error:
        'Du kan inte byta din egen kod. Be en annan administratör utfärda en, ' +
        'eller kör "npm run aterstall-admin" på servern.',
    };
  }

  if (await arPublicerattDemokonto(userId)) {
    return { ok: false, error: DEMOKONTO_SKYDDAT };
  }

  const [user] = await db
    .select({ id: users.id, label: users.label })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) return { ok: false, error: 'Användaren saknas.' };

  const code = generateCode();
  await db.update(users).set({ codeHash: hashCode(code) }).where(eq(users.id, userId));

  // Den som har den gamla lappen ska inte kunna fortsätta vara inloggad.
  await db.delete(sessions).where(eq(sessions.userId, userId));

  await audit(actorUserId, 'code.reissue', `användare ${userId}`);
  return { ok: true, code, label: user.label };
}

/** Vilka enhetsnivåer en roll får tillhöra. */
export const KIND_FOR_ROLE: Record<Role, UnitKind[]> = {
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

/**
 * Alla enheter med full sökväg som etikett, i visningsordning.
 *
 * Tar inte längre emot en roll. Svaret beror ändå inte på vilken roll som
 * frågar — bara på enhetsträdet — så den role-parametern innebar att samma
 * rekursiva fråga kördes en gång per roll i den valda enheten. Nu hämtas
 * listan en gång och filtreras med KIND_FOR_ROLE där den används.
 */
export async function getUnitPaths(): Promise<MoveTarget[]> {
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

  return rows.map((r) => ({
    id: Number(r.id),
    name: String(r.name),
    kind: String(r.kind) as UnitKind,
    path: String(r.path),
  }));
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

/**
 * Sant för de konton vars koder står på inloggningssidan i demoläge.
 *
 * Demon publicerar sina koder så att den som får länken kan gå in utan att
 * fråga. Följden är att vem som helst kan logga in som administratör — och
 * därmed spärra, byta kod på eller radera just de konton länken bygger på.
 * Ett klick och demonstrationen är trasig för alla som kommer efter.
 *
 * Skyddet gäller de fem publicerade kontona och ingenting annat. Konton som
 * besökaren skapar själv går att spärra, byta kod på och radera som vanligt,
 * så funktionerna går fortfarande att visa upp.
 *
 * I pilotläge returnerar den alltid falskt: då finns inga kända koder.
 */
async function arPublicerattDemokonto(userId: number): Promise<boolean> {
  if (environment() !== 'demo') return false;

  const [row] = await db
    .select({ codeHash: users.codeHash })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!row) return false;
  return PUBLICERADE_DEMOKODER.some(({ kod }) => hashCode(kod) === row.codeHash);
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

    if (await arPublicerattDemokonto(userId)) {
      return { ok: false, error: DEMOKONTO_SKYDDAT };
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

/**
 * Tar bort ett konto helt.
 *
 * Fanns inte tidigare — det gick bara att spärra. Spärren är rätt verktyg när
 * en person slutar men uppgifterna ska finnas kvar under lagringstiden. Den
 * är fel verktyg när någon råkat skapa trettio koder för mycket: de raderna
 * blir kvar för alltid, syns i varje lista och räknas med i "spärrade".
 *
 * Hälsodatan raderas INTE här. Anropande action kallar först
 * erasePersonalData() i retention.ts, som både räknar och loggar posterna.
 * Den här filen får strukturellt inte röra check_ins — se filhuvudet — och
 * det ska gälla även när vi tar bort saker.
 *
 * Databasen städar resten: sessioner och notiser hänger på användarraden med
 * ON DELETE CASCADE och försvinner med den.
 */
/**
 * Får den här personens hälsodata raderas?
 *
 * Samma skydd som byt kod, spärra och radera redan har. Saknades här: en
 * administratör kunde nolla historiken för ett av demons publicerade konton,
 * vilket är precis vad skyddet finns för — koden står på inloggningssidan och
 * vem som helst kan logga in med den.
 */
export async function canErasePersonalData(
  userId: number,
): Promise<{ ok: true; label: string } | { ok: false; error: string }> {
  const [target] = await db
    .select({ label: users.label })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!target) return { ok: false, error: 'Personen saknas.' };

  if (await arPublicerattDemokonto(userId)) {
    return { ok: false, error: DEMOKONTO_SKYDDAT };
  }

  return { ok: true, label: target.label };
}

export async function canDeleteUser(
  actorUserId: number,
  userId: number,
): Promise<{ ok: true; label: string; role: Role } | { ok: false; error: string }> {
  if (userId === actorUserId) {
    return { ok: false, error: 'Du kan inte ta bort ditt eget konto.' };
  }

  const [target] = await db
    .select({ label: users.label, role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!target) return { ok: false, error: 'Personen saknas.' };

  if (await arPublicerattDemokonto(userId)) {
    return { ok: false, error: DEMOKONTO_SKYDDAT };
  }

  // Samma skydd som vid spärr: utan en administratör går systemet inte att
  // administrera, och återställning kräver tillgång till servern.
  if (target.role === 'admin' && (await otherActiveAdmins(userId)) === 0) {
    return { ok: false, error: 'Det måste finnas minst en aktiv administratör.' };
  }

  return { ok: true, label: target.label, role: target.role };
}

export async function deleteUser(
  actorUserId: number,
  userId: number,
): Promise<{ ok: true; label: string; erased: number } | { ok: false; error: string }> {
  // Kontrolleras igen även om anroparen redan frågat. En raderad rad går inte
  // att ångra, och villkoren får inte hänga på att varje anropsväg minns dem.
  const tillaten = await canDeleteUser(actorUserId, userId);
  if (!tillaten.ok) return tillaten;

  /*
   * Allt i EN transaktion: räkna och radera hälsodatan, ta bort kontot, och
   * skriv båda raderna i granskningsloggen. Tidigare raderades hälsodatan i
   * ett eget steg före det här anropet, och ett avbrott däremellan lämnade
   * ett konto utan sin historik — eller ett felmeddelande som såg ut som att
   * ingenting hänt fast rapporterna redan var borta.
   */
  const erased = await db.transaction(async (tx) => {
    const n = await erasePersonalData(actorUserId, userId, tx);
    await tx.delete(users).where(eq(users.id, userId));
    await tx.insert(auditLog).values({
      actorUserId,
      action: 'user.delete',
      detail: `${tillaten.role} ${userId}`,
      createdAt: new Date().toISOString(),
    });
    return n;
  });

  return { ok: true, label: tillaten.label, erased };
}

/**
 * Vad som försvinner om en enhet raderas, och om det är tillåtet.
 *
 * En enhet raderas med allt under sig: underenheter, personer och — via
 * retention.ts — deras rapporter. Det är den mest omfattande åtgärden i appen,
 * så förhandsvisningen säger exakt vad som försvinner innan något görs.
 *
 * Raderingen får inte bli en bakväg förbi skydd som redan finns för enskilda
 * konton. Därför vägras den om enheten, någonstans under sig, innehåller:
 *   - ditt eget konto (du kan inte radera dig själv),
 *   - den sista aktiva administratören,
 *   - i demoläge, något av de publicerade demokontona.
 */
export interface UnitDeletion {
  unitId: number;
  name: string;
  parentId: number | null;
  /** Underenheter under den här, alla nivåer. Den själv räknas inte. */
  subunits: number;
  people: number;
  /** Ingen anledning att vägra — då är raderingen tillåten. */
  refusal: string | null;
}

interface UnitDeletionInternal extends UnitDeletion {
  userIds: number[];
  /** Från djupast till grunt — ordningen databasen kräver vid radering. */
  unitIdsDeepestFirst: number[];
}

async function inspectUnitDeletion(
  actorUserId: number,
  unitId: number,
): Promise<UnitDeletionInternal | null> {
  const unit = await getUnit(unitId);
  if (!unit) return null;

  const subtree = (await db.all(sql`
    WITH RECURSIVE sub(id, depth) AS (
          SELECT id, 0 FROM units WHERE id = ${unitId}
      UNION ALL
          SELECT u.id, s.depth + 1 FROM units u JOIN sub s ON u.parent_id = s.id
    )
    SELECT id, depth FROM sub ORDER BY depth DESC
  `)) as { id: number; depth: number }[];

  const unitIds = subtree.map((r) => Number(r.id));

  const people = await db
    .select({ id: users.id, role: users.role, active: users.active, codeHash: users.codeHash })
    .from(users)
    .where(inArray(users.unitId, unitIds));

  const userIds = people.map((p) => p.id);

  let refusal: string | null = null;

  if (userIds.includes(actorUserId)) {
    refusal = 'Enheten innehåller ditt eget konto. Du kan inte radera enheten du själv tillhör.';
  }

  if (!refusal && people.some((p) => p.role === 'admin' && p.active)) {
    const [kvar] = (await db.all(sql`
      SELECT count(*) AS n FROM users
       WHERE role = 'admin' AND active = 1 AND unit_id NOT IN ${unitIds}
    `)) as { n: number }[];
    if (Number(kvar?.n ?? 0) === 0) {
      refusal = 'Enheten innehåller den sista aktiva administratören. Då kan ingen administrera systemet.';
    }
  }

  if (!refusal && environment() === 'demo') {
    const publicerade = new Set(PUBLICERADE_DEMOKODER.map(({ kod }) => hashCode(kod)));
    if (people.some((p) => publicerade.has(p.codeHash))) {
      refusal =
        'Enheten innehåller konton som står på inloggningssidan och är demonstrationens ingång. ' +
        'Radera en enhet som inte gör det.';
    }
  }

  return {
    unitId,
    name: unit.name,
    parentId: unit.parentId ?? null,
    subunits: unitIds.length - 1,
    people: userIds.length,
    refusal,
    userIds,
    unitIdsDeepestFirst: unitIds,
  };
}

/** Förhandsvisningen, utan interna id-listor — det här skickas till webbläsaren. */
export async function getUnitDeletion(
  actorUserId: number,
  unitId: number,
): Promise<UnitDeletion | null> {
  const d = await inspectUnitDeletion(actorUserId, unitId);
  if (!d) return null;
  // Uttryckligen fält för fält: id-listorna ska inte följa med till webbläsaren.
  return {
    unitId: d.unitId,
    name: d.name,
    parentId: d.parentId,
    subunits: d.subunits,
    people: d.people,
    refusal: d.refusal,
  };
}

/** Personerna som raderas med enheten — för att deras rapporter ska kunna raderas först. */
export async function getUnitDeletionUserIds(actorUserId: number, unitId: number): Promise<number[]> {
  return (await inspectUnitDeletion(actorUserId, unitId))?.userIds ?? [];
}

/**
 * Raderar en enhet med allt under sig.
 *
 * Är enheten inte tom måste `confirmName` vara exakt enhetens namn. Kontrollen
 * görs HÄR och inte bara i formuläret, så att ingen väg till raderingen kan
 * hoppa över den.
 *
 * Rapporterna raderas inte i den här filen — se eraseCheckInsForUsers() i
 * retention.ts, som anropande action kör först. Skulle den glömmas raderas de
 * ändå av databasen när personerna försvinner, men då räknas och loggas de inte.
 */
export async function deleteUnit(
  actorUserId: number,
  unitId: number,
  confirmName: string,
): Promise<
  | {
      ok: true;
      name: string;
      parentId: number | null;
      subunits: number;
      people: number;
      erased: number;
    }
  | { ok: false; error: string }
> {
  const d = await inspectUnitDeletion(actorUserId, unitId);
  if (!d) return { ok: false, error: 'Enheten finns inte längre.' };
  if (d.refusal) return { ok: false, error: d.refusal };

  const tom = d.subunits === 0 && d.people === 0;
  if (!tom && confirmName.trim() !== d.name) {
    return { ok: false, error: `Skriv enhetens namn, ${d.name}, exakt för att bekräfta.` };
  }

  const erased = await db.transaction(async (tx) => {
    // Hälsodatan först, i samma transaktion — se kommentaren i deleteUser().
    const n = await eraseCheckInsForUsers(actorUserId, d.userIds, d.name, tx);
    // Personerna sedan — databasen vägrar radera en enhet som någon tillhör.
    if (d.userIds.length > 0) {
      await tx.delete(users).where(inArray(users.id, d.userIds));
    }
    // Sist enheterna, djupast först: en enhet med underenheter går inte att radera.
    for (const id of d.unitIdsDeepestFirst) {
      await tx.delete(units).where(eq(units.id, id));
    }
    await tx.insert(auditLog).values({
      actorUserId,
      action: 'unit.delete',
      detail: `${d.name} med ${d.subunits} underenheter och ${d.people} personer`,
      createdAt: new Date().toISOString(),
    });
    return n;
  });

  return {
    ok: true,
    name: d.name,
    parentId: d.parentId,
    subunits: d.subunits,
    people: d.people,
    erased,
  };
}

/** Längsta tillåtna benämning. Samma gräns som vid skapandet av befäl. */
export const MAX_LABEL = 60;

/**
 * Byter benämning på en person.
 *
 * Utan det här gick systemet inte att administrera i praktiken. Soldater
 * skapas som "Soldat 01", "Soldat 02" … och koden lagras bara som hash, så
 * den går inte att söka på. När någon tappat sin kod fanns därför inget sätt
 * för administratören att avgöra vilken rad som var rätt person — och med fel
 * rad spärras någon annans kod i stället.
 *
 * VAD SOM FÅR STÅ I FÄLTET ÄR ETT BESLUT FÖR FÖRSVARSMAKTEN, inte för
 * appen. Ett efternamn gör fältet till en personuppgift; "3. grp plats 7"
 * eller ett tjänstenummer löser samma problem med mindre uppgifter. Därför
 * validerar vi bara längden och säger i gränssnittet vad valet innebär.
 *
 * Det påverkar inte hälsodatans skydd. Administratören når fortfarande aldrig
 * check_ins — se filhuvudet — och befäl ser bara aggregat, aldrig individer.
 * Att veta vem som har vilken kod och att se någons mående är två skilda
 * saker, och de ligger kvar hos två skilda roller.
 */
export async function renameUser(
  actorUserId: number,
  userId: number,
  label: string,
): Promise<{ ok: true; label: string } | { ok: false; error: string }> {
  const trimmed = label.trim();

  if (trimmed.length < 1) return { ok: false, error: 'Benämningen får inte vara tom.' };
  if (trimmed.length > MAX_LABEL) {
    return { ok: false, error: `Benämningen får vara högst ${MAX_LABEL} tecken.` };
  }

  const [target] = await db
    .select({ label: users.label })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!target) return { ok: false, error: 'Personen saknas.' };
  if (target.label === trimmed) return { ok: true, label: trimmed };

  await db.update(users).set({ label: trimmed }).where(eq(users.id, userId));

  /*
   * Den gamla benämningen loggas INTE. Ändringen ska gå att spåra, men en
   * granskningslogg som sparar varje tidigare namn blir med tiden en egen
   * samling personuppgifter — och den som raderas via erasePersonalData
   * skulle ligga kvar i den.
   */
  await audit(actorUserId, 'user.rename', `användare ${userId}`);
  return { ok: true, label: trimmed };
}

/**
 * Enkel driftsöversikt för adminstartsidan. Inga hälsovärden.
 *
 * EN fråga, inte fyra. Tidigare kördes de fyra räkningarna efter varandra,
 * var och en med ett eget anrop över nätet. Mot en lokal fil märktes det
 * inte; mot en fjärrdatabas kostade varje anrop runt hundra millisekunder,
 * och sidan stod still medan den räknade saker som ryms i en enda SELECT.
 */
export async function getAdminStats() {
  const [row] = (await db.all(sql`
    SELECT
      (SELECT count(*) FROM units)                                              AS units,
      (SELECT count(*) FROM users WHERE role = 'soldat' AND active = 1)         AS soldiers,
      (SELECT count(*) FROM users
        WHERE role NOT IN ('soldat', 'admin') AND active = 1)                   AS leaders,
      (SELECT count(*) FROM users WHERE active = 0)                             AS inactive
  `)) as Record<string, number>[];

  return {
    units: Number(row?.units ?? 0),
    soldiers: Number(row?.soldiers ?? 0),
    leaders: Number(row?.leaders ?? 0),
    inactive: Number(row?.inactive ?? 0),
    today: serviceDate(),
  };
}
