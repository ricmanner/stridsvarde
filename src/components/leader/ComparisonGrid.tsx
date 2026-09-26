import { AlertTriangle } from 'lucide-react';

import { CELL_TINT } from '@/components/charts/chart-theme';
import StatusBandLegend from '@/components/charts/StatusBandLegend';
import type { ChildUnitSummary } from '@/lib/db/queries/aggregates';
import { CATEGORIES, getStatus, statusLabel } from '@/lib/data';
import { formatScore } from '@/lib/format';

/**
 * Underenheter som rader, kategorier som kolumner, varje ruta tonad efter status.
 *
 * Det befäl oftast vill veta är var det brister — "Grupp 3, sömn". I en
 * linjegraf eller ett spindeldiagram letar man efter det; här står det direkt.
 *
 * Här används statusfärgerna för det de betyder: status. Färgen är ändå aldrig
 * ensam om budskapet. Värdet står i rutan, och en röd ruta får en
 * varningssymbol — annars kan den som inte skiljer rött från grönt inte se
 * skillnad.
 */
export default function ComparisonGrid({
  items,
  childLabel,
}: {
  items: ChildUnitSummary[];
  childLabel: string;
}) {
  const ental = childLabel.replace(/er$/, '');

  return (
    <div>
      {/*
        Rullningsbar yta = tangentbordsåtkomst. Rutnätet är bredare än en
        telefonskärm och rullar vågrätt; utan tabIndex går det bara att rulla
        med finger eller mus (WCAG 2.1.1, uppmätt av axe i 390 px).
      */}
      <div
        tabIndex={0}
        role="region"
        aria-label={`Jämförelse mellan ${childLabel}`}
        className="overflow-x-auto rounded-md border border-slate-200 bg-white"
      >
        <table className="w-full min-w-[640px] border-separate border-spacing-0 text-left">
          <thead>
            <tr className="text-etikett font-bold uppercase tracking-[0.08em] text-slate-500">
              <th className="px-4 py-2.5 font-bold">Enhet</th>
              <th className="px-2 py-2.5 text-center font-bold">Svar</th>
              <th className="px-1.5 py-2.5 text-center font-bold">Snitt</th>
              {CATEGORIES.map((c) => (
                <th key={c.key} className="px-1.5 py-2.5 text-center font-bold">
                  {c.label.split(' ')[0]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((child) => (
              <tr key={child.id}>
                <td className="border-t border-slate-100 px-4 py-2">
                  <span className="text-sm font-medium text-slate-800">{child.name}</span>
                  {child.isDirect && (
                    <span
                      className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-etikett text-slate-500"
                      title={`Personer som tillhör enheten direkt, utan ${ental}. Ingen egen enhet.`}
                    >
                      utan {ental}
                    </span>
                  )}
                </td>
                <td className="border-t border-slate-100 px-2 py-2 text-center text-xs tabular-nums text-slate-500">
                  {child.responders}/{child.eligible}
                </td>
                {child.scores === null || child.overall === null ? (
                  <td colSpan={CATEGORIES.length + 1} className="border-t border-slate-100 px-4 py-2 text-center text-xs text-slate-500">
                    {/* En nyskapad enhet saknar inte underlag — den saknar folk. */}
                    {child.eligible === 0
                      ? 'Inga värnpliktiga placerade här ännu'
                      : 'Underlag saknas — för få svar för att visa något'}
                  </td>
                ) : (
                  <>
                    <Cell value={child.overall} strong />
                    {CATEGORIES.map((c) => (
                      <Cell key={c.key} value={child.scores![c.key]} label={c.label} />
                    ))}
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-2 px-1">
        <StatusBandLegend />
      </div>
    </div>
  );
}

function Cell({ value, strong = false, label }: { value: number; strong?: boolean; label?: string }) {
  const status = getStatus(value);
  return (
    <td className="border-t border-slate-100 px-1 py-1.5">
      <div
        title={`${label ? `${label}: ` : ''}${formatScore(value)} · ${statusLabel(status)}`}
        className={`flex h-9 items-center justify-center gap-1 rounded text-xs tabular-nums text-slate-900 ${strong ? 'font-bold' : 'font-semibold'}`}
        style={{ background: CELL_TINT[status] }}
      >
        {status === 'red' && <AlertTriangle size={11} className="shrink-0 text-red-700" aria-label="Röd" />}
        {formatScore(value)}
      </div>
    </td>
  );
}
