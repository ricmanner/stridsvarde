'use server';

import { after } from 'next/server';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';

import { hashCode } from '@/lib/auth/codes';
import {
  checkRateLimit,
  clearAttempts,
  pruneAttempts,
  recordAttempt,
  requestIpHash,
} from '@/lib/auth/rateLimit';
import {
  createSession,
  destroySession,
  pruneExpiredSessions,
} from '@/lib/auth/session';
import { db, ensureDb } from '@/lib/db';
import { auditLog, users } from '@/lib/db/schema';
import { homeFor } from '@/lib/roles';

export interface LoginState {
  error?: string;
}

/**
 * Golv på svarstiden.
 *
 * En träff gör mer arbete (skapar session) än en miss. Utan utjämning kan en
 * angripare mäta skillnaden och avgöra om en kod finns — utan att kunna logga
 * in. Alla utfall tar därför minst lika lång tid.
 */
async function pad(startedAt: number, minMs: number): Promise<void> {
  const elapsed = Date.now() - startedAt;
  if (elapsed < minMs) await new Promise((r) => setTimeout(r, minMs - elapsed));
}

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const started = Date.now();
  await ensureDb();

  const input = String(formData.get('code') ?? '');
  const ipHash = await requestIpHash();

  // Spärren kontrolleras före allt arbete med koden.
  const gate = await checkRateLimit(ipHash);
  if (!gate.allowed) {
    await pad(started, gate.backoffMs);
    const min = Math.ceil(gate.retryAfterSec / 60);
    return {
      error: `För många misslyckade försök. Försök igen om ${min} ${min === 1 ? 'minut' : 'minuter'}.`,
    };
  }

  const [user] = await db
    .select({ id: users.id, role: users.role, active: users.active })
    .from(users)
    .where(eq(users.codeHash, hashCode(input)))
    .limit(1);

  const ok = Boolean(user?.active);
  await recordAttempt(ipHash, ok);

  if (!ok || !user) {
    await pad(started, Math.max(gate.backoffMs, 150));
    // Ett och samma meddelande oavsett om koden var okänd, felskriven eller
    // tillhörde ett avaktiverat konto — annars blir felet en upplysningskanal.
    return { error: 'Ogiltig kod. Kontrollera att du skrivit rätt och försök igen.' };
  }

  // Den som kan sin kod ska inte släpa på tidigare feltryckningar.
  await clearAttempts(ipHash);

  await createSession(user.id, user.role);

  // Registreras före redirect() — den kastar, och då hinner inget efter den köras.
  after(async () => {
    await db.update(users).set({ lastLoginAt: new Date().toISOString() }).where(eq(users.id, user.id));
    await db.insert(auditLog).values({
      actorUserId: user.id,
      action: 'login.success',
      detail: null, // aldrig koden, aldrig hälsodata
      createdAt: new Date().toISOString(),
    });
    await pruneExpiredSessions();
    await pruneAttempts();
  });

  // redirect() kastar internt och måste ligga utanför try/catch.
  redirect(homeFor(user.role));
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect('/');
}
