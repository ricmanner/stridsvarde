import 'server-only';

import { cache } from 'react';
import { cookies } from 'next/headers';
import { createHash, randomBytes } from 'node:crypto';
import { and, eq, gt, lt } from 'drizzle-orm';

import { db, ensureDb } from '../db';
import { sessions, units, users } from '../db/schema';
import type { Role } from '../roles';
import { SESSION_COOKIE } from './constants';

export { SESSION_COOKIE };

/**
 * Sessionslängd, olika för soldat och befäl.
 *
 * En värnpliktig checkar in dagligen i sin egen telefon och ska inte behöva
 * logga in varje gång — 30 dagar är rimligt och sänker tröskeln att svara.
 *
 * Ett befäl ser däremot aggregerad hälsodata för upp till nittio personer,
 * ofta på en delad dator på förbandet. Där är en månadslång session en
 * onödig exponering. Tolv timmar räcker för ett arbetspass.
 */
const TTL_SOLDIER_MS = 30 * 24 * 60 * 60 * 1000;
const TTL_LEADER_MS = 12 * 60 * 60 * 1000;

/**
 * Cookien bär den råa token, databasen lagrar bara hashen. Kommer någon över
 * databasfilen går det alltså inte att återskapa en giltig sessionscookie.
 */
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export interface SessionUser {
  id: number;
  label: string;
  role: Role;
  unitId: number;
  unitName: string;
  unitKind: 'bataljon' | 'kompani' | 'pluton' | 'grupp';
}

/**
 * Skapar en session och sätter cookien.
 * Får bara anropas från en Server Action eller Route Handler — Next.js
 * tillåter inte att cookies sätts efter att svaret börjat strömma.
 */
export async function createSession(userId: number, role: Role): Promise<void> {
  const token = randomBytes(32).toString('hex');
  const expiresAt = Date.now() + (role === 'soldat' ? TTL_SOLDIER_MS : TTL_LEADER_MS);

  await db.insert(sessions).values({
    tokenHash: hashToken(token),
    userId,
    expiresAt,
    createdAt: Date.now(),
  });

  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true, // oåtkomlig för JavaScript i webbläsaren
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: new Date(expiresAt),
  });
}

/**
 * Läser inloggad användare ur cookien.
 *
 * Insvept i React `cache()` så att flera anrop under samma request bara ger
 * en databasfråga — en sida som både renderar header och kontrollerar
 * behörighet ska inte slå mot databasen två gånger.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  await ensureDb();

  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const rows = await db
    .select({
      id: users.id,
      label: users.label,
      role: users.role,
      unitId: users.unitId,
      unitName: units.name,
      unitKind: units.kind,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .innerJoin(units, eq(units.id, users.unitId))
    .where(
      and(
        eq(sessions.tokenHash, hashToken(token)),
        gt(sessions.expiresAt, Date.now()),
        eq(users.active, true), // avaktiverat konto → ingen åtkomst
      ),
    )
    .limit(1);

  return rows[0] ?? null;
});

/** Loggar ut: tar bort sessionsraden och cookien. */
export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;

  if (token) {
    await ensureDb();
    await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
  }
  jar.delete(SESSION_COOKIE);
}

/** Städar bort utgångna sessioner. Anropas vid inloggning. */
export async function pruneExpiredSessions(): Promise<void> {
  await db.delete(sessions).where(lt(sessions.expiresAt, Date.now()));
}
