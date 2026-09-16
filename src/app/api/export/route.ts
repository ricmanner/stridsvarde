import { after } from 'next/server';
import type { NextRequest } from 'next/server';

import { requireRole } from '@/lib/auth/guard';
import { safeFilename, toCsv } from '@/lib/csv';
import { CATEGORIES } from '@/lib/data';
import { serviceDate } from '@/lib/date';
import { db } from '@/lib/db';
import { getChildComparison, getUnitCategorySeries } from '@/lib/db/queries/aggregates';
import { auditLog } from '@/lib/db/schema';
import { parsePeriod } from '@/lib/privacy';

/**
 * Exporterar befälets egen enhet som CSV.
 *
 * Enheten hämtas ur sessionen, aldrig ur frågesträngen — annars skulle ett
 * befäl kunna byta id och exportera en annan enhets data. Endast aggregat
 * lämnar systemet, och rader som inte klarar k-anonymitetströskeln kommer ut
 * som tomma fält precis som i vyn.
 */
export async function GET(request: NextRequest) {
  const session = await requireRole('pluton', 'kompani', 'bataljon');

  const period = parsePeriod(request.nextUrl.searchParams.get('period'));
  const kind = request.nextUrl.searchParams.get('typ') === 'enheter' ? 'enheter' : 'dagar';

  const headers: string[] = [];
  const rows: Array<Array<string | number | null>> = [];

  if (kind === 'dagar') {
    const series = await getUnitCategorySeries(session.unitId, period);

    headers.push('Datum', 'Svarande', 'Av totalt', ...CATEGORIES.map((c) => c.label), 'Snitt');
    for (const p of series) {
      rows.push([
        p.date,
        p.responders,
        p.eligible,
        ...CATEGORIES.map((c) => p.scores?.[c.key] ?? null),
        p.overall,
      ]);
    }
  } else {
    const { children } = await getChildComparison(session.unitId, period);

    headers.push(
      'Enhet', 'Värnpliktiga', 'Svarande', ...CATEGORIES.map((c) => c.label),
      'Snitt', 'Gröna', 'Gula', 'Röda',
    );
    for (const c of children) {
      rows.push([
        c.name, c.eligible, c.responders,
        ...CATEGORIES.map((cat) => c.scores?.[cat.key] ?? null),
        c.overall,
        c.overall === null ? null : c.green,
        c.overall === null ? null : c.yellow,
        c.overall === null ? null : c.red,
      ]);
    }
  }

  // Loggar VAD som exporterades, aldrig siffrorna själva.
  after(async () => {
    await db.insert(auditLog).values({
      actorUserId: session.id,
      action: 'export.csv',
      detail: `${kind}, ${period} dagar, enhet ${session.unitId}`,
      createdAt: new Date().toISOString(),
    });
  });

  const filename = safeFilename(['psvi', session.unitName, kind, `${period}d`, serviceDate()]) + '.csv';

  return new Response(toCsv(headers, rows), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
