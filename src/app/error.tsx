'use client';

import { useEffect } from 'react';
import Link from 'next/link';

/**
 * Vad en användare möter när något går sönder.
 *
 * Next.js standardruta är på engelska och talar om "Application error: a
 * client-side exception". Det är obegripligt för en värnpliktig och pinsamt
 * på en storskärm — här handlar det bara om vad personen framför skärmen ska
 * göra härnäst.
 *
 * Felmeddelandet visas inte. Det kan innehålla tekniska detaljer som inte
 * hör hemma framför den som råkade klicka fel.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  /*
   * Skicka felet till servern.
   *
   * onRequestError fångar bara serverfel. Kraschade en klientkomponent fick
   * användaren den här rutan medan statussidan fortsatte säga att inga fel
   * inträffat — administratören såg ingenting medan appen var trasig.
   *
   * keepalive: användaren stänger ofta fliken direkt när något gått sönder,
   * och en vanlig fetch avbryts då innan den hunnit iväg.
   */
  useEffect(() => {
    fetch('/api/klientfel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: window.location.pathname,
        message: error.message,
        digest: error.digest ?? null,
      }),
      keepalive: true,
    }).catch(() => {
      /* Nätet är nere eller sidan stängs. Rapporten är inte värd ett eget fel. */
    });
  }, [error]);

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
