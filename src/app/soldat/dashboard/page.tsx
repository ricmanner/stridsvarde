import { redirect } from 'next/navigation';

import AppHeader from '@/components/AppHeader';
import { generateSoldierAdvice } from '@/lib/advice';
import { requireRole } from '@/lib/auth/guard';
import { avgScore, type Category } from '@/lib/data';
import { serviceDateRange, weekdayLabel } from '@/lib/date';
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
   * Verklig historik, en rad för VARJE dag — även dagar utan incheckning.
   *
   * Tidigare fanns bara dagar med svar med, och kommentaren här påstod att
   * grafen då visade en lucka. Det gjorde den inte: en dag som saknas helt i
   * datan finns inte att rita en lucka i. Linjen drogs rakt över den, dagen
   * försvann ur axeln, och tiden trycktes ihop utan att det syntes. Nu är en
   * tom dag null, och null blir en lucka.
   */
  const perDag = new Map(history.map((row) => [row.serviceDate, row]));
  const chartData = serviceDateRange(HISTORY_DAYS).map((date) => {
    const row = perDag.get(date);
    const dagensScores = row ? toScores(row) : null;
    return {
      date,
      day: weekdayLabel(date),
      scores: dagensScores,
      score: dagensScores ? avgScore(dagensScores) : null,
    };
  });

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
