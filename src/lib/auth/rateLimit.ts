import 'server-only';

import { createHmac } from 'node:crypto';
import { headers } from 'next/headers';
import { and, eq, gt, lt, sql } from 'drizzle-orm';

import { db } from '../db';
import { loginAttempts } from '../db/schema';

/*
 * Spärr mot automatiserad avsökning av inloggningen.
 *
 * Avvägningen, med siffror: en kod är tio tecken ur ett alfabet på 31, alltså
 * ungefär 8,2 × 10^14 kombinationer. Även utan någon spärr alls, med tusen
 * gissningar i sekunden, tar det kring 26 000 år att beta av dem. Att gissa
 * en slumpmässig kod är därför inget verkligt hot.
 *
 * Det spärren faktiskt skyddar mot är automatiserad avsökning och att
 * inloggningen används för att belasta servern. Till det räcker en
 * fördröjning — en hård utelåsning tillför nästan ingenting men drabbar
 * verkliga användare hårt. En soldat som knappar fel på en handskriven kod
 * tre gånger i rad är fullständigt normalt, inte ett angrepp.
 *
 * Därför: ingen fördröjning alls de första försöken, sedan en växande men
 * kort paus, och hård spärr först vid tjugo misslyckanden — en nivå ingen
 * människa når av misstag.
 */

const WINDOW_MS = 15 * 60_000;

/** Antal misslyckanden innan någon fördröjning alls märks. */
const FREE_ATTEMPTS = 3;

/** Hård spärr först här. Under den nivån bromsas bara. */
const MAX_FAILURES = 20;

const MAX_DELAY_MS = 3000;

/**
 * Identifierar avsändaren så gott det går.
 *
 * `x-forwarded-for` sätts av klienten och går att förfalska om appen inte
 * står bakom en proxy man själv kontrollerar. Lokalt saknas den helt. Spärren
 * per IP är därför den svagaste nivån — den fångar slarv och enkel
 * automatik, inte en beslutsam angripare. Adressen hashas innan lagring; en
 * logg över inloggningsförsök ska inte i sig vara en samling personuppgifter.
 */
export async function requestIpHash(): Promise<string> {
  const h = await headers();
  const raw =
    h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || 'local';
  return createHmac('sha256', process.env.AUTH_PEPPER ?? 'dev').update(raw).digest('hex');
}

export interface RateLimitResult {
  allowed: boolean;
  /** Fördröjning att tillämpa innan svar. */
  backoffMs: number;
  /** Sekunder kvar av spärren, när allowed är false. */
  retryAfterSec: number;
}

export async function checkRateLimit(ipHash: string): Promise<RateLimitResult> {
  const now = Date.now();
  const since = now - WINDOW_MS;

  const [row] = await db
    .select({
      n: sql<number>`count(*)`,
      oldest: sql<number | null>`min(${loginAttempts.attemptedAt})`,
    })
    .from(loginAttempts)
    .where(
      and(
        eq(loginAttempts.ip, ipHash),
        eq(loginAttempts.succeeded, false),
        gt(loginAttempts.attemptedAt, since),
      ),
    );

  const failures = Number(row?.n ?? 0);

  if (failures >= MAX_FAILURES) {
    // Spärren släpper när det äldsta försöket faller ur fönstret.
    const oldest = Number(row?.oldest ?? now);
    return {
      allowed: false,
      backoffMs: MAX_DELAY_MS,
      retryAfterSec: Math.max(1, Math.ceil((oldest + WINDOW_MS - now) / 1000)),
    };
  }

  const over = Math.max(0, failures - FREE_ATTEMPTS);
  return {
    allowed: true,
    backoffMs: Math.min(over * 400, MAX_DELAY_MS),
    retryAfterSec: 0,
  };
}

export async function recordAttempt(ipHash: string, succeeded: boolean): Promise<void> {
  await db.insert(loginAttempts).values({
    ip: ipHash,
    succeeded,
    attemptedAt: Date.now(),
  });
}

/** Nollställer räknaren efter en lyckad inloggning — den som kan sin kod bromsas inte. */
export async function clearAttempts(ipHash: string): Promise<void> {
  await db.delete(loginAttempts).where(eq(loginAttempts.ip, ipHash));
}

/** Städar bort gamla försök så att tabellen inte växer obegränsat. */
export async function pruneAttempts(): Promise<void> {
  await db.delete(loginAttempts).where(lt(loginAttempts.attemptedAt, Date.now() - 24 * 3_600_000));
}
