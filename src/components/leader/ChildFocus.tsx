'use client';

import { useState } from 'react';
import { Check } from 'lucide-react';
import {
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import {
  ACCENT,
  AXIS_TICK,
  AXIS_TEXT,
  BANDS,
  GRID,
  REFERENCE,
  SCALE_MAX,
  SCALE_MIN,
  SCALE_TICKS,
  sparseTicks,
} from '@/components/charts/chart-theme';
import StatusBandLegend from '@/components/charts/StatusBandLegend';
import type { ChildComparison, ChildUnitSummary, SeriesPoint } from '@/lib/db/queries/aggregates';
import { CATEGORIES, type Category } from '@/lib/data';
import { formatScore } from '@/lib/format';
import type { Guarded } from '@/lib/privacy';

/**
 * En vald underenhet mot enhetens snitt — över tid och som profil.
 *
 * Tidigare fick varje underenhet en egen färg i både linjegrafen och
 * spindeldiagrammet. Två problem: färgerna var statusfärgerna (en grupp i
 * "bra"-grönt, en i "kritiskt"-rött), och en palett som håller för
 * färgblindhet räcker bara till ungefär tre serier som överlappar. Ett
 * kompani med fyra plutoner hade redan passerat gränsen.
 *
 * Nu jämförs EN underenhet mot helheten: blå mot grå. Det fungerar för hur
 * många underenheter som helst, och det är vad en profil är till för — hur
 * den här gruppen avviker. Rutnätet ovanför visar alla samtidigt.
 *
 * Förvald är den med lägst snitt, eftersom det är den man oftast vill titta på.
 *
 * Spindeldiagrammet finns kvar på önskemål från en fysioterapeut.
 */
export default function ChildFocus({
  items,
  childLabel,
  comparisonSeries,
  unitSeries,
  unitCategories,
}: {
  items: ChildUnitSummary[];
  childLabel: string;
  comparisonSeries: ChildComparison['series'];
  unitSeries: SeriesPoint[];
  unitCategories: Guarded<Record<Category, number>>;
}) {
  const synliga = items.filter((c) => c.scores !== null && c.overall !== null);
  const lagst = [...synliga].sort((a, b) => (a.overall ?? 0) - (b.overall ?? 0))[0];
  const [valdId, setValdId] = useState<number | undefined>(lagst?.id);
  const [aktiva, setAktiva] = useState<Set<Category>>(new Set(CATEGORIES.map((c) => c.key)));

  const vald = synliga.find((c) => c.id === valdId) ?? lagst;
  if (!vald) return null;

  const ental = childLabel.replace(/er$/, '');
  const snittPerDag = new Map(unitSeries.map((p) => [p.date, p.overall]));

  const tidslinje = comparisonSeries.map((rad) => ({
    key: String(rad.date),
    label: String(rad.label),
    vald: typeof rad[vald.name] === 'number' ? (rad[vald.name] as number) : null,
    snitt: snittPerDag.get(String(rad.date)) ?? null,
  }));
  const etiketter = new Map(tidslinje.map((r) => [r.key, r.label]));

  const profil = CATEGORIES.filter((c) => aktiva.has(c.key)).map((c) => ({
    kategori: c.label.split(' ')[0],
    vald: vald.scores![c.key],
    snitt: unitCategories.ok ? unitCategories.data[c.key] : null,
  }));

  function vaxla(key: Category) {
    setAktiva((prev) => {
      const next = new Set(prev);
      // Minst tre: med två axlar är ett spindeldiagram bara ett streck.
      if (next.has(key) && next.size <= 3) return prev;
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const nyckel = (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
      <span className="flex items-center gap-1.5">
        <span aria-hidden className="inline-block h-[3px] w-4 rounded" style={{ background: ACCENT }} />
        {vald.name}
      </span>
      <span className="flex items-center gap-1.5">
        <span aria-hidden className="inline-block h-[3px] w-4 rounded" style={{ background: REFERENCE }} />
        Hela enheten
      </span>
    </div>
  );

  return (
    <div>
      {/* Ett val överst styr båda graferna. */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-xs text-slate-500">Visa {ental}:</span>
        {synliga.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setValdId(c.id)}
            aria-pressed={c.id === vald.id}
            className={`cursor-pointer rounded-md border-[1.5px] px-3 py-1.5 text-xs font-semibold transition-colors ${
              c.id === vald.id
                ? 'border-slate-900 bg-slate-900 text-white'
                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400'
            }`}
          >
            {c.name}
          </button>
        ))}
      </div>

      <div className="grid items-start gap-3 lg:grid-cols-2">
        <div className="rounded-md border border-slate-200 bg-white px-3 pb-3 pt-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 px-1">
            <span className="text-xs font-semibold text-slate-800">Över tid</span>
            {nyckel}
          </div>
          <div role="img" aria-label={`${vald.name} mot hela enheten över tid`}>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={tidslinje} margin={{ top: 8, right: 14, left: 0, bottom: 0 }}>
                {BANDS.map((b) => (
                  <ReferenceArea key={b.from} y1={b.from} y2={b.to} fill={b.color} fillOpacity={b.opacity} ifOverflow="hidden" />
                ))}
                <XAxis
                  dataKey="key"
                  ticks={sparseTicks(tidslinje.map((r) => r.key), 7)}
                  tickFormatter={(k: string) => etiketter.get(k) ?? ''}
                  interval={0}
                  tick={AXIS_TICK}
                  axisLine={false}
                  tickLine={false}
                  tickMargin={6}
                />
                <YAxis domain={[SCALE_MIN, SCALE_MAX]} ticks={SCALE_TICKS} tick={AXIS_TICK} axisLine={false} tickLine={false} width={26} />
                <Tooltip
                  cursor={{ stroke: '#CBD5E1', strokeWidth: 1 }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const r = payload[0].payload as (typeof tidslinje)[number];
                    return (
                      <div className="rounded-md bg-slate-900 px-3 py-2 text-etikett text-white shadow-lg">
                        <p className="text-slate-300">{r.label}</p>
                        <p className="mt-0.5">{vald.name}: <strong>{r.vald === null ? 'Underlag saknas' : formatScore(r.vald)}</strong></p>
                        <p>Hela enheten: <strong>{r.snitt === null ? 'Underlag saknas' : formatScore(r.snitt)}</strong></p>
                      </div>
                    );
                  }}
                />
                <Line dataKey="snitt" stroke={REFERENCE} strokeWidth={1.5} dot={false} connectNulls={false} isAnimationActive={false} activeDot={{ r: 3, fill: REFERENCE, stroke: '#fff', strokeWidth: 2 }} />
                <Line dataKey="vald" stroke={ACCENT} strokeWidth={2.5} dot={false} connectNulls={false} isAnimationActive={false} activeDot={{ r: 4, fill: ACCENT, stroke: '#fff', strokeWidth: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-1 px-1">
            <StatusBandLegend />
          </div>
        </div>

        <div className="rounded-md border border-slate-200 bg-white px-3 pb-3 pt-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 px-1">
            <span className="text-xs font-semibold text-slate-800">Profil</span>
            {nyckel}
          </div>

          {/* Neutral text och en bock — inte kategorifärgad text, som var svårläst. */}
          <div className="mb-1 flex flex-wrap gap-1.5 px-1">
            {CATEGORIES.map((c) => {
              const pa = aktiva.has(c.key);
              return (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => vaxla(c.key)}
                  aria-pressed={pa}
                  className={`flex cursor-pointer items-center gap-1 rounded border-[1.5px] px-2 py-1 text-etikett font-semibold transition-colors ${
                    pa ? 'border-slate-400 bg-slate-100 text-slate-800' : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                  }`}
                >
                  {pa && <Check size={11} aria-hidden />}
                  {c.label.split(' ')[0]}
                </button>
              );
            })}
          </div>

          <div role="img" aria-label={`Profil för ${vald.name} mot hela enheten`}>
            <ResponsiveContainer width="100%" height={250}>
              <RadarChart data={profil} outerRadius="72%">
                <PolarGrid stroke={GRID} />
                <PolarAngleAxis dataKey="kategori" tick={{ fill: AXIS_TEXT, fontSize: 11 }} />
                <PolarRadiusAxis domain={[0, SCALE_MAX]} tick={false} axisLine={false} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const r = payload[0].payload as (typeof profil)[number];
                    return (
                      <div className="rounded-md bg-slate-900 px-3 py-2 text-etikett text-white shadow-lg">
                        <p className="text-slate-300">{r.kategori}</p>
                        <p className="mt-0.5">{vald.name}: <strong>{formatScore(r.vald)}</strong></p>
                        {r.snitt !== null && <p>Hela enheten: <strong>{formatScore(r.snitt)}</strong></p>}
                      </div>
                    );
                  }}
                />
                {unitCategories.ok && (
                  <Radar dataKey="snitt" stroke={REFERENCE} strokeWidth={1.5} fill="none" isAnimationActive={false} />
                )}
                <Radar dataKey="vald" stroke={ACCENT} strokeWidth={2.5} fill={ACCENT} fillOpacity={0.12} isAnimationActive={false} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
