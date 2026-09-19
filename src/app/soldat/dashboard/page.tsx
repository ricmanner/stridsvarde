import { redirect } from 'next/navigation';

import AppHeader from '@/components/AppHeader';
import { generateSoldierAdvice } from '@/lib/advice';
import { requireRole } from '@/lib/auth/guard';
import { avgScore, type Category } from '@/lib/data';
import { klockslagLabel, longDateLabel, serviceDate, serviceDateRange, weekdayLabel } from '@/lib/date';
import {
  getOwnHistory,
  getOwnResponseFrequency,
  getTodayCheckIn,
} from '@/lib/db/queries/checkins';
import { aktivSamtalsbegaran } from '@/lib/db/queries/notifications';

import SoldatDashboard from './DashboardClient';

export const dynamic = 'force-dynamic';

const HISTORY_DAYS = 14;

export default async function SoldatDashboardPage() {
  const session = await requireRole('soldat');

  const today = await getTodayCheckIn(session.id);
  if (!today) redirect('/soldat');

  const [history, freq, begaran] = await Promise.all([
    getOwnHistory(session.id, HISTORY_DAYS),
    getOwnResponseFrequency(session.id, HISTORY_DAYS),
    // Har personen bett om samtal ska kvittot stå kvar, även efter en
    // omladdning och så länge ärendet är öppet. Se aktivSamtalsbegaran().
    aktivSamtalsbegaran(session.id),
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
      <main id="innehall" className="mx-auto flex w-full max-w-2xl flex-1 flex-col">
        <h1 className="sr-only">Din återkoppling</h1>
        <SoldatDashboard
          scores={scores}
          advice={today.advice ?? generateSoldierAdvice(scores)}
          chartData={chartData}
          freq={freq}
          begaranSkickad={
            /*
             * Formateras här, på servern. En klientkomponent formaterar i
             * BESÖKARENS tidszon, och då stod fel klockslag för den som satt
             * någon annanstans — samma fel som incheckningens datum en gång
             * hade.
             */
            begaran
              ? `${klockslagLabel(begaran.skickad)} ${
                  begaran.serviceDate === serviceDate()
                    ? 'idag'
                    : longDateLabel(begaran.serviceDate)
                }`
              : null
          }
        />
      </main>
    </div>
  );
}
