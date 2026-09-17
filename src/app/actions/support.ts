'use server';

import { revalidatePath } from 'next/cache';

import { requireRole } from '@/lib/auth/guard';
import {
  createTalkRequest,
  findLeaderAbove,
  markNotificationRead,
} from '@/lib/db/queries/notifications';
import type { Role } from '@/lib/roles';

export interface TalkState {
  sent?: boolean;
  error?: string;
}

/**
 * Soldaten begär ett samtal.
 *
 * Systemet larmar aldrig om en enskild individ av sig självt — det skulle
 * göra hela verktyget till övervakning. Den här vägen öppnas bara när
 * soldaten själv trycker på knappen, och inga poäng följer med larmet.
 * Befälet får veta att någon vill prata, inte hur personen svarat.
 */
export async function requestTalkAction(
  _prev: TalkState,
  formData: FormData,
): Promise<TalkState> {
  const user = await requireRole('soldat');

  const level = String(formData.get('level') ?? 'pluton');
  if (level !== 'pluton' && level !== 'kompani') {
    return { error: 'Ogiltigt val.' };
  }

  const leader = await findLeaderAbove(user.unitId, level as Role);
  if (!leader) {
    return {
      error:
        'Hittade inget befäl att skicka till. Kontakta ditt befäl direkt, eller använd numren ovan.',
    };
  }

  await createTalkRequest({
    soldierUserId: user.id,
    soldierLabel: user.label,
    soldierUnitName: user.unitName,
    recipientUserId: leader.id,
    subjectUnitId: user.unitId,
  });

  revalidatePath('/soldat/dashboard');
  return { sent: true };
}

/** Befälet kvitterar en notis. */
export async function dismissNotificationAction(formData: FormData): Promise<void> {
  const user = await requireRole('pluton', 'kompani', 'bataljon');

  const id = Number(formData.get('id'));
  if (!Number.isInteger(id)) return;

  await markNotificationRead(user.id, id);
  revalidatePath('/');
}
