'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Info, X } from 'lucide-react';

import { type Category, getStatus, statusColor } from '@/lib/data';
import { skalnivaer } from '@/lib/skala';

/**
 * Info-knappen vid varje fråga: alla nivåer och vad de betyder.
 *
 * Texten under reglaget visar bara den nivå man står på. Den här listan
 * visar alla på en gång, så att man kan se var gränserna går innan man
 * drar — samma sak som Readiness Advisor har, som fysioterapeuterna visade.
 *
 * Byggd på <dialog> som BekraftaKnapp, av samma skäl: fokusfälla, Escape,
 * och fokus tillbaka till knappen kommer med webbläsaren.
 */
export default function SkalaInfo({
  kategori,
  etikett,
  fraga,
  varde,
}: {
  kategori: Category;
  /** Kategorins namn, "Sömn" — för knappens uppläsning. */
  etikett: string;
  /** Frågan, som blir rutans rubrik. */
  fraga: string;
  /** Där reglaget står, så att den raden kan markeras. Null: inget valt än. */
  varde: number | null;
}) {
  const ruta = useRef<HTMLDialogElement>(null);
  const [oppen, setOppen] = useState(false);
  const rubrikId = useId();
  const valdStatus = varde === null ? null : getStatus(varde);

  useEffect(() => {
    const d = ruta.current;
    if (!d) return;
    if (oppen && !d.open) d.showModal();
    if (!oppen && d.open) d.close();
  }, [oppen]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOppen(true)}
        aria-label={`Vad betyder siffrorna för ${etikett.toLowerCase()}?`}
        // Ikonen är liten; marginalen gör ytan att trycka på större utan
        // att flytta något.
        className="-m-2 cursor-pointer rounded-full p-2 text-slate-500 transition-colors hover:text-slate-900"
      >
        <Info size={16} aria-hidden />
      </button>

      <dialog
        ref={ruta}
        aria-labelledby={rubrikId}
        onClose={() => setOppen(false)}
        // Ett tryck utanför rutan stänger den. Klicket landar då på själva
        // <dialog>, vars bakgrund täcker hela skärmen.
        onClick={(e) => {
          if (e.target === e.currentTarget) setOppen(false);
        }}
        className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-lg border border-slate-200 bg-white p-0 text-slate-900 shadow-xl backdrop:bg-slate-900/40"
      >
        <div className="flex flex-col gap-3 p-5">
          <div className="flex items-start justify-between gap-3">
            <h2 id={rubrikId} className="text-sm font-bold text-slate-900">
              {fraga}
            </h2>
            <button
              type="button"
              onClick={() => setOppen(false)}
              aria-label="Stäng"
              className="-m-1.5 shrink-0 cursor-pointer rounded p-1.5 text-slate-500 transition-colors hover:text-slate-900"
            >
              <X size={16} aria-hidden />
            </button>
          </div>

          <p className="text-xs leading-relaxed text-slate-600">
            Välj den siffra som stämmer bäst just nu.
          </p>

          <ul className="flex flex-col divide-y divide-slate-100 rounded border border-slate-200">
            {skalnivaer(kategori).map((n) => {
              const vald = n.status === valdStatus;
              return (
                <li
                  key={n.status}
                  aria-current={vald ? 'true' : undefined}
                  className={`flex items-start gap-3 px-3 py-2.5 ${vald ? 'bg-slate-50' : ''}`}
                >
                  {/* Ytfärgen, inte textfärgen: pricken är en yta (3:1). */}
                  <span
                    className="mt-1.5 size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: statusColor(n.status) }}
                    aria-hidden
                  />
                  <span className="w-10 shrink-0 text-sm font-semibold tabular-nums text-slate-900">
                    {n.fran}–{n.till}
                  </span>
                  <span className={`text-sm leading-relaxed ${vald ? 'text-slate-900' : 'text-slate-600'}`}>
                    {n.text}
                    {vald && <span className="sr-only"> (där du står nu)</span>}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </dialog>
    </>
  );
}
