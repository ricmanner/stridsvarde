import AppHeader from '@/components/AppHeader';
import NotificationBanner from '@/components/NotificationBanner';
import LeaderDashboard from '@/components/leader/LeaderDashboard';
import { generateLeaderAdvice } from '@/lib/advice';
import { requireRole } from '@/lib/auth/guard';
import {
  getChildComparison,
  getKategorilage,
  getUnitCategorySeries,
  getUnitOverview,
  getVeckounderlag,
} from '@/lib/db/queries/aggregates';
import { veckokort } from '@/lib/veckosammanfattning';
import { parsePeriod } from '@/lib/privacy';
import type { Role } from '@/lib/roles';
import type { ChildKind } from '@/lib/unit-names';

interface Props {
  role: Role;
  levelLabel: string;
  childLabel: string;
  /** Underenheternas sort. Bär genus, så rubriken kan säga "ett kompani". */
  childKind: ChildKind;
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
  childKind,
  searchParams,
}: Props) {
  const session = await requireRole(role);

  // Endast vitlistade perioder — se kommentaren i queries/privacy.ts.
  const period = parsePeriod((await searchParams).period);

  const [overview, series, comparison, lage, veckounderlag] = await Promise.all([
    getUnitOverview(session.unitId, period),
    getUnitCategorySeries(session.unitId, period),
    getChildComparison(session.unitId, period),
    getKategorilage(session.unitId, period),
    getVeckounderlag(session.unitId),
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
        {/* Sidans rubrik (h1) är enhetens namn, överst i LeaderDashboard. */}
        <LeaderDashboard
          unitName={session.unitName}
          levelLabel={levelLabel}
          childLabel={childLabel}
          childKind={childKind}
          period={period}
          overview={overview}
          series={series}
          comparison={comparison}
          lage={lage}
          advice={advice}
          vecka={veckokort(veckounderlag)}
        />
      </main>
    </div>
  );
}
