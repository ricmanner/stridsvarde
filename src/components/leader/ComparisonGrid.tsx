import { AlertTriangle } from 'lucide-react';

import { CELL_TINT } from '@/components/charts/chart-theme';
import StatusBandLegend from '@/components/charts/StatusBandLegend';
import type { ChildUnitSummary } from '@/lib/db/queries/aggregates';
import { CATEGORIES, getStatus, statusLabel } from '@/lib/data';
import { formatScore, procent } from '@/lib/format';

/**
 * Underenheter som rader, kategorier som kolumner, varje ruta tonad efter status.
 *
 * Det befäl oftast vill veta är var det brister — "3. grupp, sömn". I en
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
  /*
   * Kolumnen "I rött" bara när den har något att visa. Så länge en
   * underenhet är dold håller databasen inne antalen för alla (se
   * SKYDDA_DOLDA_SYSKON i queries/aggregates.ts), och kolumnen blev en rad
   * streck. Gömd då (paket 1, 17 oktober).
   */
  const visaIRott = items.some((c) => c.overall !== null && c.red !== null);

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
          {/* Namn, svar och "I rött" bryts inte (whitespace-nowrap): i
              telefonen blev det "1." / "grupp" och "2 av" / "8", och varje
              rad dubbelt så hög. Tabellen rullar redan i sidled. */}
          <thead>
            <tr className="text-etikett font-bold uppercase tracking-[0.08em] text-slate-500">
              <th className="whitespace-nowrap px-4 py-2.5 align-bottom font-bold">Enhet</th>
              {/* Svarsandel, inte "8/8": det räknade personer som svarat minst en
                  gång och lästes som full svarsfrekvens (17 oktober). */}
              <th className="whitespace-nowrap px-2 py-2.5 text-center align-bottom font-bold">Svarsandel</th>
              {/* "I rött" bredvid "Svarade": två personantal ihop, och snittet
                  direkt före kategorierna det sammanfattar (variant A, 17
                  oktober). Stod förut mellan snittet och kategorierna. */}
              {visaIRott && (
                // Får brytas på två rader, som kategorirubrikerna.
                <th className="w-20 px-2 py-2.5 text-center align-bottom font-bold">Personer under 4</th>
              )}
              <th className="border-r-2 border-slate-200 px-1.5 py-2.5 text-center align-bottom font-bold">Snitt</th>
              {CATEGORIES.map((c) => (
                // Hela namnet, även om det tar två rader — se testet i sprak.test.mjs.
                // Lika breda, annars blev SÖMN smal och PSYKISKT MÅENDE bred.
                <th key={c.key} className="w-24 px-1.5 py-2.5 text-center align-bottom font-bold">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((child) => (
              <tr key={child.id}>
                <td className="whitespace-nowrap border-t border-slate-100 px-4 py-2">
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
                <td className="whitespace-nowrap border-t border-slate-100 px-2 py-2 text-center text-xs tabular-nums text-slate-500">
                  {child.svarsandel === null ? '–' : procent(child.svarsandel)}
                </td>
                {child.scores === null || child.overall === null ? (
                  <td colSpan={CATEGORIES.length + (visaIRott ? 2 : 1)} className="border-t border-slate-100 px-4 py-2 text-center text-xs text-slate-500">
                    {/* En nyskapad enhet saknar inte underlag — den saknar folk. */}
                    {child.eligible === 0
                      ? 'Inga värnpliktiga placerade här ännu'
                      : 'Underlag saknas — för få svar för att visa något'}
                  </td>
                ) : (
                  <>
                    {visaIRott && (
                      <td className="whitespace-nowrap border-t border-slate-100 px-2 py-2 text-center text-xs tabular-nums text-slate-500">
                        {child.red === null ? (
                          '–'
                        ) : (
                          <>
                            <span className={child.red > 0 ? 'font-semibold text-red-700' : 'text-slate-700'}>{child.red}</span>
                            {' '}av {child.responders}
                          </>
                        )}
                      </td>
                    )}
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

/**
 * En ruta i jämförelsen. `strong` är enhetens snitt: en storlek större och
 * med en linje mot kategorierna, så att raden läses som helheten och sedan
 * vad den består av (17 oktober).
 */
function Cell({ value, strong = false, label }: { value: number; strong?: boolean; label?: string }) {
  const status = getStatus(value);
  return (
    <td className={`border-t border-slate-100 px-1 py-1.5 ${strong ? 'border-r-2 border-r-slate-200 pr-2' : ''}`}>
      <div
        title={`${label ? `${label}: ` : ''}${formatScore(value)} · ${statusLabel(status)}`}
        className={`flex h-9 items-center justify-center gap-1 rounded tabular-nums text-slate-900 ${
          strong ? 'text-sm font-extrabold' : 'text-xs font-semibold'
        }`}
        style={{ background: CELL_TINT[status] }}
      >
        {status === 'red' && <AlertTriangle size={11} className="shrink-0 text-red-700" aria-label="Röd" />}
        {formatScore(value)}
      </div>
    </td>
  );
}
