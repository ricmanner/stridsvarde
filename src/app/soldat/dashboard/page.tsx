import { redirect } from 'next/navigation';

import AppHeader from '@/components/AppHeader';
import { generateSoldierAdvice } from '@/lib/advice';
import { requireRole } from '@/lib/auth/guard';
import { avgScore, type Category } from '@/lib/data';
import { weekdayLabel } from '@/lib/date';
import {
  getOwnHistory,
  getOwnResponseFrequency,
  getTodayCheckIn,
} from '@/lib/db/queries/checkins';

import SoldatDashboard from './DashboardClient';

export const dynamic = 'force-dynamic';

const HISTORY_DAYS = 14;

export default async function SoldatDashboardPage() {
  const session = await requireRole('soldat');

  const today = await getTodayCheckIn(session.id);
  if (!today) redirect('/soldat');

  const [history, freq] = await Promise.all([
    getOwnHistory(session.id, HISTORY_DAYS),
    getOwnResponseFrequency(session.id, HISTORY_DAYS),
  ]);

  const toScores = (r: typeof today): Record<Category, number> => ({
    fysisk: r.fysisk,
    psykisk: r.psykisk,
    social: r.social,
    somn: r.somn,
    kost: r.kost,
    energi: r.energi,
  });

  const scores = toScores(today);

  /*
   * Verklig historik ur databasen. Dagar utan incheckning finns helt enkelt
   * inte med — grafen visar en lucka i stället för ett påhittat värde, vilket
   * demons trendfunktioner gjorde.
   */
  const chartData = history.map((row) => ({
    day: weekdayLabel(row.serviceDate),
    score: avgScore(toScores(row)),
    date: row.serviceDate,
  }));

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader unit={session.unitName} label={session.label} role={session.role} />
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col">
        <SoldatDashboard
          scores={scores}
          advice={today.advice ?? generateSoldierAdvice(scores)}
          chartData={chartData}
          freq={freq}
        />
      </div>
    </div>
  );
}
