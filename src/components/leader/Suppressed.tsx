import { EyeOff } from 'lucide-react';

/**
 * Visas i stället för en siffra som undanhållits av integritetsskäl.
 *
 * Aldrig en nolla, aldrig ett streck, aldrig en tom yta. En nolla skulle
 * läsas som "alla mår bottendåligt", vilket är den farligaste tänkbara
 * feltolkningen. Befälet ska förstå att underlag saknas — och varför.
 */
export default function Suppressed({
  text,
  compact = false,
}: {
  /** Färdig förklaring från servern — se guard() i lib/privacy.ts. */
  text: string;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <span
        className="text-xs text-slate-400"
        title={text}
        aria-label={text}
      >
        —
      </span>
    );
  }

  return (
    <div className="flex items-start gap-2.5 rounded-md border border-slate-200 bg-slate-50 px-4 py-3.5">
      <EyeOff size={15} className="mt-0.5 shrink-0 text-slate-400" aria-hidden />
      <p className="text-sm leading-relaxed text-slate-500">{text}</p>
    </div>
  );
}
