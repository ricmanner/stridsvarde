import AppHeader from '@/components/AppHeader';
import NotificationBanner from '@/components/NotificationBanner';
import LeaderDashboard from '@/components/leader/LeaderDashboard';
import { generateLeaderAdvice } from '@/lib/advice';
import { requireRole } from '@/lib/auth/guard';
import {
  getChildComparison,
  getUnitCategorySeries,
  getUnitOverview,
} from '@/lib/db/queries/aggregates';
import { parsePeriod } from '@/lib/privacy';
import type { Role } from '@/lib/roles';

interface Props {
  role: Role;
  levelLabel: string;
  childLabel: string;
  searchParams: Promise<{ period?: string }>;
}

/**
 * Gemensamt skal för alla befälsnivåer.
 *
 * Enheten hämtas alltid ur sessionen, aldrig ur URL:en. Det gör att ett befäl
 * inte kan byta ett id i adressfältet och läsa en annan enhets data — den
 * angreppsytan finns inte. (Skulle enhetsval via URL läggas till senare måste
 * assertCanReadUnit() i lib/auth/guard.ts användas.)
 */
export default async function LeaderPageShell({
  role,
  levelLabel,
  childLabel,
  searchParams,
}: Props) {
  const session = await requireRole(role);

  // Endast vitlistade perioder — se kommentaren i queries/privacy.ts.
  const period = parsePeriod((await searchParams).period);

  const [overview, series, comparison] = await Promise.all([
    getUnitOverview(session.unitId, period),
    getUnitCategorySeries(session.unitId, period),
    getChildComparison(session.unitId, period),
  ]);

  // Rådet bygger på aggregatet — finns inget underlag ges inget råd.
  const advice = overview.categories.ok
    ? generateLeaderAdvice(overview.categories.data)
    : null;

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader unit={session.unitName} label={session.label} role={session.role} />
      <NotificationBanner userId={session.id} />
      <main id="innehall" className="flex flex-1 flex-col">
        {/* Sidans rubrik i strukturen. På skärmen står samma sak i
            sammanfattningsraden och i sidhuvudet. */}
        <h1 className="sr-only">
          {levelLabel} — {session.unitName}
        </h1>
        <LeaderDashboard
          levelLabel={levelLabel}
          childLabel={childLabel}
          period={period}
          overview={overview}
          series={series}
          comparison={comparison}
          advice={advice}
        />
      </main>
    </div>
  );
}
