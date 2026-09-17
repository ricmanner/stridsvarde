'use client';

import { Line, LineChart, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { getStatus, statusLabel } from '@/lib/data';
import { formatScore } from '@/lib/format';

import {
  AXIS_TICK,
  BANDS,
  INK,
  SCALE_MAX,
  SCALE_MIN,
  SCALE_TICKS,
  sparseTicks,
} from './chart-theme';

export interface ScorePoint {
  /** Unik per punkt — datumet. Veckodagar upprepas under två veckor. */
  key: string;
  label: string;
  /** null för en dag utan svar, eller utan tillräckligt underlag. */
  value: number | null;
}

/**
 * En serie på skalan 1–10, mot grön, gul och röd bakgrund.
 *
 * Medvetna val:
 *  - En linje i neutralt bläck. Status bärs av bakgrunden, inte av linjen.
 *  - Dagar utan värde blir luckor. Datan ska innehålla varje dag, även tomma;
 *    saknas dagen helt drar linjen rakt över den och tiden trycks ihop.
 *  - Sista värdet markeras med en punkt — det är oftast det man tittar efter.
 *    Ett ensamt värde mellan två luckor får också en punkt, annars syns det
 *    inte alls: en linje behöver två punkter.
 *  - Ingen animation. Den ger inget, och grafer som ritar sig själva ser
 *    oroliga ut på en storskärm.
 */
export default function ScoreTrendChart({
  data,
  height = 180,
  compact = false,
  ariaLabel,
}: {
  data: ScorePoint[];
  height?: number;
  compact?: boolean;
  ariaLabel: string;
}) {
  const labels = new Map(data.map((d) => [d.key, d.label]));
  const sista = data.findLastIndex((d) => d.value !== null);

  return (
    <div role="img" aria-label={ariaLabel}>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 8, right: 14, left: 0, bottom: 0 }}>
          {BANDS.map((b) => (
            <ReferenceArea key={b.from} y1={b.from} y2={b.to} fill={b.color} fillOpacity={b.opacity} ifOverflow="hidden" />
          ))}

          <XAxis
            dataKey="key"
            ticks={sparseTicks(data.map((d) => d.key), compact ? 3 : 7)}
            tickFormatter={(k: string) => labels.get(k) ?? ''}
            interval={0}
            tick={AXIS_TICK}
            axisLine={false}
            tickLine={false}
            tickMargin={6}
          />
          <YAxis
            domain={[SCALE_MIN, SCALE_MAX]}
            ticks={SCALE_TICKS}
            tick={AXIS_TICK}
            axisLine={false}
            tickLine={false}
            width={26}
          />

          <Tooltip
            cursor={{ stroke: '#CBD5E1', strokeWidth: 1 }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as ScorePoint;
              return (
                <div className="rounded-md bg-slate-900 px-3 py-2 text-[11px] text-white shadow-lg">
                  <p className="text-slate-300">{p.label}</p>
                  <p className="mt-0.5 font-semibold">
                    {p.value === null ? 'Inget värde' : `${formatScore(p.value)} · ${statusLabel(getStatus(p.value))}`}
                  </p>
                </div>
              );
            }}
          />

          <Line
            dataKey="value"
            stroke={INK}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            connectNulls={false}
            isAnimationActive={false}
            activeDot={{ r: 4, fill: INK, stroke: '#fff', strokeWidth: 2 }}
            dot={(props: { cx?: number; cy?: number; index?: number }) => {
              const i = props.index ?? -1;
              const ensam =
                data[i]?.value !== null &&
                (i === 0 || data[i - 1]?.value === null) &&
                (i === data.length - 1 || data[i + 1]?.value === null);
              if (i !== sista && !ensam) return <g key={`d${i}`} />;
              return (
                <circle
                  key={`d${i}`}
                  cx={props.cx}
                  cy={props.cy}
                  r={i === sista ? 4 : 3}
                  fill={INK}
                  stroke="#fff"
                  strokeWidth={2}
                />
              );
            }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
