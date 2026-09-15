'use client';

import { AlertTriangle, Printer, X } from 'lucide-react';

import type { IssuedCode } from '@/lib/db/queries/admin';

/**
 * Visar nyutfärdade koder — en enda gång.
 *
 * Databasen lagrar bara HMAC-hashen, så koderna kan aldrig plockas fram igen.
 * Det finns ingen "visa kod"-knapp någonstans i systemet, och det är avsiktligt:
 * alternativet vore att läsbara inloggningsuppgifter till hälsodata låg kvar i
 * databasen. Stängs rutan är koderna borta och måste återutfärdas.
 */
export default function CodeSheet({
  codes,
  unitName,
  onClose,
}: {
  codes: IssuedCode[];
  unitName?: string;
  onClose: () => void;
}) {
  return (
    <div className="mb-5 rounded-md border-2 border-amber-300 bg-amber-50 p-4 sm:p-5">
      <div className="no-print mb-4 flex items-start gap-2.5">
        <AlertTriangle size={17} className="mt-0.5 shrink-0 text-amber-700" aria-hidden />
        <div className="flex-1">
          <p className="text-sm font-bold text-amber-900">
            Skriv ut nu — koderna visas aldrig igen
          </p>
          <p className="mt-0.5 text-[13px] leading-relaxed text-amber-800">
            Systemet sparar bara en hash av varje kod. Stänger du rutan går de inte
            att få tillbaka, utan måste utfärdas på nytt.
          </p>
        </div>
        <button
          onClick={onClose}
          className="shrink-0 cursor-pointer rounded p-1 text-amber-700 hover:bg-amber-100"
          aria-label="Stäng"
        >
          <X size={16} aria-hidden />
        </button>
      </div>

      {/* Klipp-isär-lappar. Print-stilen ligger i globals.css. */}
      <div className="grid gap-2 sm:grid-cols-2">
        {codes.map((c) => (
          <div
            key={c.code}
            className="rounded border border-dashed border-slate-400 bg-white px-4 py-3"
            style={{ breakInside: 'avoid' }}
          >
            <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">
              FM – PSVI{unitName ? ` · ${unitName}` : ''}
            </p>
            <p className="mt-0.5 text-[13px] text-slate-600">{c.label}</p>
            <p className="mt-1.5 font-mono text-lg font-bold tracking-[0.12em] text-slate-900">
              {c.code}
            </p>
            <p className="mt-1.5 text-[10px] leading-snug text-slate-400">
              Din personliga kod. Dela den inte med någon.
            </p>
          </div>
        ))}
      </div>

      <button
        onClick={() => window.print()}
        className="no-print mt-4 flex cursor-pointer items-center gap-2 rounded-md bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
      >
        <Printer size={15} aria-hidden />
        Skriv ut {codes.length} {codes.length === 1 ? 'kod' : 'koder'}
      </button>
    </div>
  );
}
