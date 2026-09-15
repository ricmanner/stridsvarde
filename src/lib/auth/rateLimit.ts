import 'server-only';

import { createHmac } from 'node:crypto';
import { headers } from 'next/headers';
import { and, eq, gt, lt, sql } from 'drizzle-orm';

import { db } from '../db';
import { loginAttempts } from '../db/schema';

const WINDOW_MS = 15 * 60_000;
const MAX_FAILURES = 5;

/**
 * Identifierar avsändaren så gott det går.
 *
 * `x-forwarded-for` sätts av klienten och går att förfalska om appen inte
 * står bakom en proxy man själv kontrollerar. Lokalt saknas den helt. Spärren
 * per IP är därför den svagaste nivån — den fångar slarv, inte en beslutsam
 * angripare. Adressen hashas innan lagring; en logg över inloggningsförsök
 * ska inte i sig vara en samling personuppgifter.
 */
export async function requestIpHash(): Promise<string> {
  const h = await headers();
  const raw =
    h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || 'local';
  return createHmac('sha256', process.env.AUTH_PEPPER ?? 'dev').update(raw).digest('hex');
}

export interface RateLimitResult {
  allowed: boolean;
  /** Fördröjning att tillämpa innan svar, för att bromsa gissningar. */
  backoffMs: number;
}

export async function checkRateLimit(ipHash: string): Promise<RateLimitResult> {
  const since = Date.now() - WINDOW_MS;

  const [row] = await db
    .select({ n: sql<number>`count(*)` })
    .from(loginAttempts)
    .where(
      and(
        eq(loginAttempts.ip, ipHash),
        eq(loginAttempts.succeeded, false),
        gt(loginAttempts.attemptedAt, since),
      ),
    );

  const failures = row?.n ?? 0;
  return {
    allowed: failures < MAX_FAILURES,
    // Exponentiell backoff, tak 5 s.
    backoffMs: Math.min(150 * 2 ** failures, 5000),
  };
}

export async function recordAttempt(ipHash: string, succeeded: boolean): Promise<void> {
  await db.insert(loginAttempts).values({
    ip: ipHash,
    succeeded,
    attemptedAt: Date.now(),
  });
}

/** Städar bort gamla försök så att tabellen inte växer obegränsat. */
export async function pruneAttempts(): Promise<void> {
  await db.delete(loginAttempts).where(lt(loginAttempts.attemptedAt, Date.now() - 24 * 3_600_000));
}
