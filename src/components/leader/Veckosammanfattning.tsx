import { CalendarDays } from 'lucide-react';

/**
 * Veckosammanfattningen som ruta — överst i befälsvyns översikt och i
 * utskriftsrapporten. Meningarna skrivs i lib/veckosammanfattning.ts.
 *
 * En mening per rad, inte ett stycke: den som ska läsa upp den på
 * kompaniets veckomöte ska kunna peka på en rad i taget.
 *
 * Rubriken är en h2, som befälsvyns andra avsnitt, och står i samma stil.
 */
export default function Veckosammanfattning({ meningar }: { meningar: string[] }) {
  return (
    <section aria-labelledby="veckosammanfattning" className="mb-5">
      <h2
        id="veckosammanfattning"
        className="mb-2 text-etikett font-bold uppercase tracking-[0.1em] text-balance text-slate-500"
      >
        Senaste veckan
      </h2>
      <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
        <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-4 py-2.5 sm:px-5">
          <CalendarDays size={14} className="shrink-0 text-slate-500" aria-hidden />
          <span className="text-xs text-slate-600">De senaste 7 dagarna, jämfört med de 7 före</span>
        </div>
        <ul className="divide-y divide-slate-100">
          {meningar.map((m) => (
            <li key={m} className="px-4 py-3 text-sm leading-relaxed text-slate-800 sm:px-5">
              {m}
            </li>
          ))}
        </ul>
      </div>
      <p className="mt-1.5 text-etikett leading-relaxed text-slate-500">
        Sammanställt automatiskt ur enhetens siffror — ingen AI, och ingenting lämnar appen.
      </p>
    </section>
  );
}
