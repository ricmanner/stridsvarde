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
  /** Dagens samlade snitt, när ett kort för det ska visas (`samlat`). */
  overall?: number | null;
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
  samlat = false,
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
  /**
   * Ett första kort för det samlade måendet. Befälsvyn visar det: helheten
   * först, sedan frågorna. Med sju frågor blir det åtta kort, två jämna rader
   * på dator — förut stod det sjunde ensamt (16 oktober).
   */
  samlat?: boolean;
}) {
  const kort = [
    ...(samlat
      ? [{
          key: 'samlat',
          label: 'Samlat mående',
          varde: (r: CategoryRow) => r.overall ?? null,
          snitt: summary ? CATEGORIES.reduce((a, c) => a + summary[c.key], 0) / CATEGORIES.length : null,
        }]
      : []),
    ...CATEGORIES.map((cat) => ({
      key: cat.key,
      label: cat.label,
      varde: (r: CategoryRow) => r.scores?.[cat.key] ?? null,
      snitt: summary ? summary[cat.key] : null,
    })),
  ];

  return (
    <div>
      <div className={`grid gap-3 sm:grid-cols-2 ${samlat ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}>
        {kort.map((k) => {
          const data = rows.map((r) => ({ key: r.key, label: r.label, value: k.varde(r) }));
          const senaste = [...data].reverse().find((d) => d.value !== null)?.value ?? null;
          const visat = summary ? k.snitt : senaste;

          return (
            <div
              key={k.key}
              className={`rounded-md border bg-white px-3 pb-2 pt-3 ${k.key === 'samlat' ? 'border-slate-300' : 'border-slate-200'}`}
            >
              {/*
                Namnet och snittet på var sin rad, i alla kort: bredvid snittet
                kapades "Kost och näring" till "Kost och …", och bröts bara de
                långa namnen hamnade graferna på olika höjd (16 oktober).
              */}
              <div className="mb-1 flex flex-col items-start gap-0.5 px-1">
                <span className="text-xs font-semibold text-slate-800">{k.label}</span>
                {visat !== null && visat !== undefined ? (
                  <span className="flex shrink-0 items-center gap-1.5">
                    <span className="text-etikett text-slate-500">{summary ? summaryLabel ?? 'snitt' : 'senast'}</span>
                    <span className="text-sm font-bold text-slate-900">{formatScore(visat)}</span>
                    <StatusBadge status={getStatus(visat)} size="sm" />
                  </span>
                ) : (
                  <span className="text-etikett text-slate-500">Underlag saknas</span>
                )}
              </div>
              <ScoreTrendChart data={data} height={130} compact ariaLabel={`${ariaPrefix}: ${k.label}`} />
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
