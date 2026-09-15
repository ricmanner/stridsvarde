import 'server-only';

import { redirect } from 'next/navigation';
import { sql } from 'drizzle-orm';

import { db } from '../db';
import type { Role } from '../roles';
import { getSessionUser, type SessionUser } from './session';

/** Kräver att någon är inloggad. Skickar annars till inloggningen. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect('/?utgangen=1');
  return user;
}

/**
 * Kräver en viss roll.
 *
 * Måste anropas först i VARJE sida och VARJE Server Action — inte bara i
 * sidan som råkar rendera formuläret. Next.js dokumentation är tydlig med att
 * Server Actions är POST till den route de används på, och att en
 * proxy-matcher tyst kan hoppa över dem. Proxyn i src/proxy.ts är en
 * bekvämlighet, aldrig ett skydd.
 */
export async function requireRole(...allowed: Role[]): Promise<SessionUser> {
  const user = await requireUser();
  if (!allowed.includes(user.role)) redirect('/ingen-behorighet');
  return user;
}

/**
 * Kontrollerar att användaren får läsa data för en viss enhet.
 *
 * Utan det här kan ett befäl byta ut ett id i en URL och läsa en annan
 * plutons hälsodata. Kontrollen ligger avsiktligt intill dataåtkomsten i
 * stället för i sidan, så att den inte kan glömmas bort i en ny vy.
 */
export async function assertCanReadUnit(user: SessionUser, unitId: number): Promise<void> {
  if (user.unitId === unitId) return;

  const rows = await db.all(sql`
    WITH RECURSIVE subtree(id) AS (
          SELECT id FROM units WHERE id = ${user.unitId}
      UNION ALL
          SELECT u.id FROM units u JOIN subtree s ON u.parent_id = s.id
    )
    SELECT 1 FROM subtree WHERE id = ${unitId} LIMIT 1
  `);

  if (rows.length === 0) redirect('/ingen-behorighet');
}
