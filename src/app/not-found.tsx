import Link from 'next/link';

/**
 * En adress som inte finns.
 *
 * Standardsidan säger "This page could not be found" på engelska. Den som
 * skrivit fel i adressfältet ska få veta det på svenska, och en väg vidare.
 */
export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 text-center">
      <h1 className="text-xl font-bold text-slate-900">Sidan finns inte</h1>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">
        Adressen leder ingenstans. Kontrollera länken, eller gå till startsidan och logga in.
      </p>
      <Link
        href="/"
        className="mt-6 rounded-md bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white"
      >
        Till startsidan
      </Link>
    </main>
  );
}
