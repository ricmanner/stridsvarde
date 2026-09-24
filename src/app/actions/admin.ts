'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { requireRole } from '@/lib/auth/guard';
import { destroySession } from '@/lib/auth/session';
import {
  createUnit,
  canDeleteUser,
  canErasePersonalData,
  createUsers,
  deleteUnit,
  deleteUser,
  getUnitDeletion,
  moveUser,
  reissueCode,
  renameUnit,
  renameUser,
  setUserActive,
  type IssuedCode,
  type UnitDeletion,
} from '@/lib/db/queries/admin';
import { erasePersonalData } from '@/lib/db/retention';
import { ATERSTALL_ORD } from '@/lib/demo';
import type { Role } from '@/lib/roles';

/*
 * Varje action börjar med requireRole('admin').
 *
 * Inte för att sidan redan kontrollerat, utan för att Server Actions är
 * POST-anrop till den route de används på och kan nås direkt. Next.js egen
 * dokumentation varnar för att en proxy-matcher tyst kan hoppa över dem.
 */

export interface UnitState {
  error?: string;
  created?: string;
}

export async function createUnitAction(
  _prev: UnitState,
  formData: FormData,
): Promise<UnitState> {
  const admin = await requireRole('admin');

  const parentId = Number(formData.get('parentId'));
  const name = String(formData.get('name') ?? '');
  if (!Number.isInteger(parentId)) return { error: 'Ogiltig överordnad enhet.' };

  const result = await createUnit(admin.id, parentId, name);
  if (!result.ok) return { error: result.error };

  revalidatePath('/admin');
  return { created: name.trim() };
}

export interface UnitRenameState {
  error?: string;
  /** Det nya namnet, så vyn kan kvittera bytet. */
  renamed?: string;
}

/**
 * Byter namn på en enhet.
 *
 * Fanns inte förrän nu, och saknaden märktes först vid tanken på en
 * överlämning: den enhet som skapas vid första start heter "Bataljonen", och
 * utan det här går den inte att döpa om till förbandets riktiga namn utan att
 * gå direkt på databasen.
 */
export async function renameUnitAction(
  _prev: UnitRenameState,
  formData: FormData,
): Promise<UnitRenameState> {
  const admin = await requireRole('admin');

  const unitId = Number(formData.get('unitId'));
  const name = String(formData.get('name') ?? '');
  if (!Number.isInteger(unitId)) return { error: 'Ogiltig enhet.' };

  const result = await renameUnit(admin.id, unitId, name);
  if (!result.ok) return { error: result.error };

  revalidatePath('/admin');
  return { renamed: result.name };
}

export interface CodeState {
  error?: string;
  /** Visas exakt en gång. Finns inte kvar någonstans efteråt. */
  codes?: IssuedCode[];
  unitName?: string;
}

export async function createUsersAction(
  _prev: CodeState,
  formData: FormData,
): Promise<CodeState> {
  const admin = await requireRole('admin');

  const unitId = Number(formData.get('unitId'));
  const unitName = String(formData.get('unitName') ?? '');
  const role = String(formData.get('role') ?? 'soldat') as Role;
  const count = Number(formData.get('count'));
  const labelPrefix = String(formData.get('labelPrefix') ?? 'Värnpliktig').trim() || 'Värnpliktig';

  const allowed: Role[] = ['soldat', 'pluton', 'kompani', 'bataljon'];
  if (!allowed.includes(role)) return { error: 'Ogiltig roll.' };
  if (!Number.isInteger(unitId)) return { error: 'Ogiltig enhet.' };

  const result = await createUsers(
    admin.id,
    unitId,
    role,
    role === 'soldat' ? count : 1,
    labelPrefix,
  );
  if (!result.ok) return { error: result.error };

  revalidatePath('/admin');
  return { codes: result.codes, unitName };
}

export async function reissueCodeAction(
  _prev: CodeState,
  formData: FormData,
): Promise<CodeState> {
  const admin = await requireRole('admin');

  const userId = Number(formData.get('userId'));
  if (!Number.isInteger(userId)) return { error: 'Ogiltig användare.' };

  const result = await reissueCode(admin.id, userId);
  if (!result.ok) return { error: result.error };

  revalidatePath('/admin');
  return { codes: [{ label: result.label, code: result.code }] };
}

export interface MoveState {
  error?: string;
  moved?: string;
}

export async function moveUserAction(
  _prev: MoveState,
  formData: FormData,
): Promise<MoveState> {
  const admin = await requireRole('admin');

  const userId = Number(formData.get('userId'));
  const targetUnitId = Number(formData.get('targetUnitId'));
  if (!Number.isInteger(userId) || !Number.isInteger(targetUnitId)) {
    return { error: 'Välj både person och målenhet.' };
  }

  const result = await moveUser(admin.id, userId, targetUnitId);
  if (!result.ok) return { error: result.error };

  revalidatePath('/admin');
  return { moved: result.unitName };
}

export interface EraseState {
  error?: string;
  erased?: number;
}

/**
 * Raderar en persons hälsodata på begäran.
 *
 * GDPR artikel 17. Funktionen fanns redan i retention.ts men gick inte att
 * nå från gränssnittet — en rättighet som är implementerad men oåtkomlig är
 * sämre än ingen alls, eftersom den ser uppfylld ut i en granskning.
 */
export async function erasePersonalDataAction(
  _prev: EraseState,
  formData: FormData,
): Promise<EraseState> {
  const admin = await requireRole('admin');

  const userId = Number(formData.get('userId'));
  if (!Number.isInteger(userId)) return { error: 'Välj en person.' };

  // Samma skydd som radering och kodbyte: personen måste finnas, och demons
  // publicerade konton får inte nollas av någon som loggat in med koden.
  const tillaten = await canErasePersonalData(userId);
  if (!tillaten.ok) return { error: tillaten.error };

  const erased = await erasePersonalData(admin.id, userId);

  revalidatePath('/admin');
  return { erased };
}

export interface ActiveState {
  error?: string;
}

export async function toggleUserActiveAction(
  _prev: ActiveState,
  formData: FormData,
): Promise<ActiveState> {
  const admin = await requireRole('admin');

  const userId = Number(formData.get('userId'));
  const active = formData.get('active') === 'true';
  if (!Number.isInteger(userId)) return { error: 'Ogiltig användare.' };

  const result = await setUserActive(admin.id, userId, active);
  revalidatePath('/admin');

  return result.ok ? {} : { error: result.error };
}

export interface RenameState {
  error?: string;
  /** Id:t som ändrades, så vyn kan stänga rätt rad efteråt. */
  renamedId?: number;
}

export async function renameUserAction(
  _prev: RenameState,
  formData: FormData,
): Promise<RenameState> {
  const admin = await requireRole('admin');

  const userId = Number(formData.get('userId'));
  const label = String(formData.get('label') ?? '');
  if (!Number.isInteger(userId)) return { error: 'Ogiltig användare.' };

  const result = await renameUser(admin.id, userId, label);
  if (!result.ok) return { error: result.error };

  revalidatePath('/admin');
  return { renamedId: userId };
}

export interface DeleteState {
  error?: string;
  /** Namnet på den som togs bort, och hur många rapporter som följde med. */
  deleted?: { label: string; erased: number };
}

/**
 * Tar bort ett konto och personens rapporter.
 *
 * Villkoren kontrolleras här, före allt annat. Själva raderingen — hälsodata,
 * konto och båda raderna i granskningsloggen — sker i EN transaktion inne i
 * deleteUser(). Räkningen måste ske innan kontot försvinner, eftersom
 * incheckningarna annars städas bort av databasens ON DELETE CASCADE och
 * granskningsloggen skulle säga noll.
 */
export async function deleteUserAction(
  _prev: DeleteState,
  formData: FormData,
): Promise<DeleteState> {
  const admin = await requireRole('admin');

  const userId = Number(formData.get('userId'));
  if (!Number.isInteger(userId)) return { error: 'Ogiltig användare.' };

  /*
   * Kontrollen FÖRE raderingen av hälsodata. Görs den efteråt hinner
   * uppgifterna försvinna innan vi upptäcker att kontot inte får tas bort —
   * och då står personen kvar utan sin historik.
   */
  const tillaten = await canDeleteUser(admin.id, userId);
  if (!tillaten.ok) return { error: tillaten.error };

  // Hälsodatan raderas inne i deleteUser(), i samma transaktion som kontot.
  const result = await deleteUser(admin.id, userId);
  if (!result.ok) return { error: result.error };

  revalidatePath('/admin');
  return { deleted: { label: result.label, erased: result.erased } };
}

/**
 * Vad som skulle raderas med enheten. Anropas först när administratören
 * klickar — adminsidan ska inte räkna ut det vid varje sidbyte.
 */
export async function previewUnitDeletionAction(
  unitId: number,
): Promise<UnitDeletion | { error: string }> {
  const admin = await requireRole('admin');
  if (!Number.isInteger(unitId)) return { error: 'Ogiltig enhet.' };

  const d = await getUnitDeletion(admin.id, unitId);
  return d ?? { error: 'Enheten finns inte längre.' };
}

export interface DeleteUnitState {
  error?: string;
}

/**
 * Raderar en enhet med underenheter, personer och rapporter.
 *
 * ALLA kontroller görs innan något raderas, och själva raderingen sker i en
 * enda transaktion inne i deleteUnit(). Namnbekräftelsen kontrolleras både
 * här och där: den första kontrollen ger ett begripligt fel i formuläret,
 * den andra skyddar varje annan väg dit.
 */
export async function deleteUnitAction(
  _prev: DeleteUnitState,
  formData: FormData,
): Promise<DeleteUnitState> {
  const admin = await requireRole('admin');

  const unitId = Number(formData.get('unitId'));
  const confirmName = String(formData.get('confirmName') ?? '');
  if (!Number.isInteger(unitId)) return { error: 'Ogiltig enhet.' };

  const d = await getUnitDeletion(admin.id, unitId);
  if (!d) return { error: 'Enheten finns inte längre.' };
  if (d.refusal) return { error: d.refusal };

  const tom = d.subunits === 0 && d.people === 0;
  if (!tom && confirmName.trim() !== d.name) {
    return { error: `Skriv enhetens namn, ${d.name}, exakt för att bekräfta.` };
  }

  // Hälsodatan raderas inne i deleteUnit(), i samma transaktion som enheten.
  const result = await deleteUnit(admin.id, unitId, confirmName);
  if (!result.ok) return { error: result.error };

  /*
   * Vidare till den överordnade enheten härifrån, på servern — inte från
   * formuläret. Efter raderingen laddas sidan om, och eftersom enheten inte
   * längre finns byts komponenten ut innan den hinner skicka vidare. Den
   * vägen testades först, och adressen blev stående på den raderade enheten.
   * Antalet raderade rapporter finns i granskningsloggen.
   */
  revalidatePath('/admin');
  const raderad = encodeURIComponent(result.name);
  redirect(result.parentId ? `/admin?unit=${result.parentId}&raderad=${raderad}` : `/admin?raderad=${raderad}`);
}

/**
 * Lägger till tabeller och index som saknas i databasen.
 *
 * Syns på statussidan, och bara när något faktiskt saknas. Kan köras hur många
 * gånger som helst — satserna skapar bara det som inte redan finns, och rör
 * aldrig befintliga rader.
 */
export async function applySchemaAction(): Promise<void> {
  const admin = await requireRole('admin');

  const { applySchema } = await import('@/lib/db/queries/health');
  await applySchema(admin.id);

  revalidatePath('/status');
}

/**
 * Flyttar fram demodatans historik så att den slutar idag.
 *
 * Demodatan står still medan kalendern går: efter en vecka är befälsvyns
 * förvalda period tom, efter tre veckor visar varje vy "Underlag saknas". En
 * demo som ska visas om ett par månader måste därför flyttas fram först.
 *
 * Finns som knapp och inte bara som `npm run demo:uppdatera`, av samma skäl
 * som schemaknappen ovan: nycklarna till den delade demons databas är märkta
 * som känsliga och går inte att hämta ner till en terminal. Utan knappen går
 * den viktigaste förberedelsen inför en visning inte att göra alls.
 *
 * Skyddet mot att köras mot ett pilottest ligger i applyDemoTimeline(), som
 * kontrollerar både driftläget och att demons konton finns. Knappen visas
 * dessutom bara i demoläge — men ett gränssnitt är inte ett skydd.
 */
export async function applyDemoTimelineAction(): Promise<void> {
  await requireRole('admin');

  const { applyDemoTimeline } = await import('@/lib/db/demo-timeline');
  await applyDemoTimeline();

  revalidatePath('/status');
}

/**
 * Tömmer demon och bygger upp den igen.
 *
 * Besökare ska kunna radera enheter, spärra konton och byta koder — demon
 * slits ner av att användas som den är tänkt. Den här knappen ställer den i
 * ordning igen, inklusive det någon hunnit radera, vilket "Flytta fram
 * demodatan" inte gör: den flyttar datum, den skapar inte tillbaka något.
 *
 * Kräver att ordet skrivs, som enhetsraderingen kräver enhetens namn. Det
 * hindrar en felklickning mitt i en visning, inte en illvillig besökare —
 * mot den senare finns inget skydd så länge koden står på inloggningssidan,
 * och det är ett medvetet val.
 */
export async function aterstallDemoAction(formData: FormData): Promise<void> {
  await requireRole('admin');

  if (String(formData.get('bekraftelse') ?? '').trim().toUpperCase() !== ATERSTALL_ORD) {
    redirect('/status?aterstallning=fel');
  }

  const { aterstallDemo } = await import('@/lib/db/seed');
  await aterstallDemo();

  /*
   * Sessionen är borta med resten av databasen, så inloggningen gäller inte
   * längre. Kakan städas här så att webbläsaren inte bär omkring en pekare
   * till en session som inte finns — annars möts man av "utgången session"
   * i stället för inloggningssidan.
   */
  await destroySession();

  redirect('/?aterstalld=1');
}
