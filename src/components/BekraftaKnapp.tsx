'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';

/**
 * En knapp som frågar en gång till innan den gör något oåterkalleligt.
 *
 * Ersätter webbläsarens `confirm()`. Den rutan är ostilad, ligger utanför
 * appens fokushantering, och visas på operativsystemets språk — en engelsk
 * "OK / Cancel" mitt i en svensk app, framför den som ska radera hälsodata.
 * Appen hade dessutom tre olika sätt att bekräfta: skriv enhetens namn, skriv
 * ÅTERSTÄLL, och den här rutan. Nu ser de två senare likadana ut.
 *
 * Byggd på <dialog> och showModal(). Det ger fokusfälla, Escape-stängning,
 * bakgrunden inert och återlämnat fokus till knappen — allt sådant som annars
 * skrivs för hand och blir nästan rätt.
 *
 * Ligger inuti det formulär den bekräftar, så att knappen i rutan är en
 * vanlig submit. Utan JavaScript skickas formuläret direkt: servern
 * kontrollerar villkoren på nytt ändå, så rutan är en spärr mot
 * felklickning, inte ett skydd.
 */
export default function BekraftaKnapp({
  fraga,
  forklaring,
  bekraftaText,
  children,
  className,
  disabled,
}: {
  /** Rubriken i rutan. En rak fråga, inte "Är du säker?". */
  fraga: string;
  /** Vad som faktiskt händer. Sägs innan, inte efteråt. */
  forklaring: React.ReactNode;
  /** Texten på den knapp som utför handlingen. Säger vad den gör. */
  bekraftaText: string;
  /** Texten på knappen som öppnar rutan. */
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  const ruta = useRef<HTMLDialogElement>(null);
  const [oppen, setOppen] = useState(false);

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
        disabled={disabled}
        onClick={() => setOppen(true)}
        className={className}
      >
        {children}
      </button>

      <dialog
        ref={ruta}
        aria-labelledby="bekrafta-fraga"
        // Escape stänger rutan själv; state måste följa med.
        onClose={() => setOppen(false)}
        className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-lg border border-slate-200 bg-white p-0 text-slate-900 shadow-xl backdrop:bg-slate-900/40"
      >
        <div className="flex flex-col gap-3 p-5">
          <div className="flex items-start gap-2.5">
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-red-700" aria-hidden />
            <h2 id="bekrafta-fraga" className="text-sm font-bold text-slate-900">
              {fraga}
            </h2>
          </div>

          <div className="text-xs leading-relaxed text-slate-600">{forklaring}</div>

          <div className="mt-1 flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => setOppen(false)}
              className="cursor-pointer rounded-md border-[1.5px] border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-900"
            >
              Avbryt
            </button>
            <button
              type="submit"
              onClick={() => setOppen(false)}
              className="cursor-pointer rounded-md bg-red-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-800"
            >
              {bekraftaText}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
