'use client';

import StatusBadge from '@/components/StatusBadge';
import { CATEGORIES, getStatus, type Category } from '@/lib/data';
import { formatScore } from '@/lib/format';

import ScoreTrendChart from './ScoreTrendChart';
import StatusBandLegend from './StatusBandLegend';

export interface CategoryRow {
  key: string;
  label: string;
  scores: Record<Category, number> | null;
}

/**
 * En liten graf per kategori, i ett rutnät.
 *
 * Ersätter en graf med sex färgade linjer. De trasslade in sig i två klungor
 * utan etiketter, så det gick inte att se vilken linje som var sömn — och
 * färgerna krockade med statusfärgerna. Sex små grafer med samma skala går att
 * läsa var för sig och jämföra sinsemellan, och ingen behöver en egen färg.
 */
export default function CategoryTrendGrid({
  rows,
  ariaPrefix,
  summary,
  summaryLabel,
}: {
  rows: CategoryRow[];
  ariaPrefix: string;
  /**
   * Värdet i varje korts rubrik. Befälsvyn skickar periodens snitt — samma
   * siffra som på översikten. Utan det visade trenderna senaste dagens värde,
   * och kost kunde stå som röd på en flik och gul på nästa utan att något
   * ändrats. Utelämnas det visas senaste värdet, som för den värnpliktige.
   */
  summary?: Record<Category, number> | null;
  summaryLabel?: string;
}) {
  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {CATEGORIES.map((cat) => {
          const data = rows.map((r) => ({ key: r.key, label: r.label, value: r.scores?.[cat.key] ?? null }));
          const senaste = [...data].reverse().find((d) => d.value !== null)?.value ?? null;
          const visat = summary ? summary[cat.key] : senaste;

          return (
            <div key={cat.key} className="rounded-md border border-slate-200 bg-white px-3 pb-2 pt-3">
              <div className="mb-1 flex items-center justify-between gap-2 px-1">
                <span className="truncate text-[13px] font-semibold text-slate-800">{cat.label}</span>
                {visat !== null && visat !== undefined ? (
                  <span className="flex shrink-0 items-center gap-1.5">
                    <span className="text-[11px] text-slate-500">{summary ? summaryLabel ?? 'snitt' : 'senast'}</span>
                    <span className="text-[15px] font-bold text-slate-900">{formatScore(visat)}</span>
                    <StatusBadge status={getStatus(visat)} size="sm" />
                  </span>
                ) : (
                  <span className="text-[11px] text-slate-500">Underlag saknas</span>
                )}
              </div>
              <ScoreTrendChart data={data} height={130} compact ariaLabel={`${ariaPrefix}: ${cat.label}`} />
            </div>
          );
        })}
      </div>
      <div className="mt-2 px-1">
        <StatusBandLegend />
      </div>
    </div>
  );
}
