'use server';

import { revalidatePath } from 'next/cache';

import { requireRole } from '@/lib/auth/guard';
import {
  createUnit,
  canDeleteUser,
  createUsers,
  deleteUser,
  moveUser,
  reissueCode,
  renameUser,
  setUserActive,
  type IssuedCode,
} from '@/lib/db/queries/admin';
import { erasePersonalData } from '@/lib/db/retention';
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
