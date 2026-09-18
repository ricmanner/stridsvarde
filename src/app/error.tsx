'use client';

import Link from 'next/link';

/**
 * Vad en användare möter när något går sönder.
 *
 * Next.js standardruta är på engelska och talar om "Application error: a
 * client-side exception". Det är obegripligt för en värnpliktig och pinsamt
 * på en storskärm. Felet i sig är redan loggat på servern — här handlar det
 * bara om vad personen framför skärmen ska göra härnäst.
 *
 * Felmeddelandet visas inte. Det kan innehålla tekniska detaljer som inte
 * hör hemma framför den som råkade klicka fel.
 */
export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 text-center">
      <h1 className="text-xl font-bold text-slate-900">Något gick fel</h1>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">
        Sidan kunde inte visas. Dina tidigare svar finns kvar — ingenting har gått förlorat.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={reset}
          className="cursor-pointer rounded-md bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white"
        >
          Försök igen
        </button>
        <Link
          href="/"
          className="rounded-md border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700"
        >
          Till startsidan
        </Link>
      </div>
      <p className="mt-6 text-xs text-slate-500">
        Händer det igen: berätta för den som ansvarar för systemet vad du gjorde när det hände.
      </p>
    </main>
  );
}
