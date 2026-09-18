'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { requireRole } from '@/lib/auth/guard';
import {
  createUnit,
  canDeleteUser,
  createUsers,
  deleteUnit,
  deleteUser,
  getUnitDeletion,
  getUnitDeletionUserIds,
  moveUser,
  reissueCode,
  renameUser,
  setUserActive,
  type IssuedCode,
  type UnitDeletion,
} from '@/lib/db/queries/admin';
import { eraseCheckInsForUsers, erasePersonalData } from '@/lib/db/retention';
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
 * Två steg med flit. Hälsodatan går via erasePersonalData() i retention.ts,
 * som räknar och loggar posterna; själva kontot via deleteUser() i
 * queries/admin.ts, som strukturellt inte får röra check_ins. Ordningen
 * spelar roll: räkningen måste ske innan raden försvinner, eftersom
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

  const erased = await erasePersonalData(admin.id, userId);

  const result = await deleteUser(admin.id, userId);
  if (!result.ok) return { error: result.error };

  revalidatePath('/admin');
  return { deleted: { label: result.label, erased } };
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
 * ALLA kontroller görs innan hälsodatan raderas. Görs de efteråt kan
 * rapporterna vara borta när raderingen sedan nekas — exakt det fel som
 * först smög sig in när personer fick kunna raderas. Namnbekräftelsen
 * kontrolleras därför här, och igen i deleteUnit(): den första kontrollen
 * skyddar ordningen, den andra skyddar varje annan väg dit.
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

  await eraseCheckInsForUsers(
    admin.id,
    await getUnitDeletionUserIds(admin.id, unitId),
    d.name,
  );

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
 * Sätter upp felloggen i databasen.
 *
 * Syns bara på statussidan, och bara när tabellen saknas. Kan köras hur många
 * gånger som helst — satserna skapar bara det som inte redan finns.
 */
export async function setupErrorLogAction(): Promise<void> {
  const admin = await requireRole('admin');

  const { ensureErrorLogTable } = await import('@/lib/db/queries/health');
  await ensureErrorLogTable(admin.id);

  revalidatePath('/status');
}
