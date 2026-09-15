'use client';

import { Printer } from 'lucide-react';

/** Egen klientkomponent enbart för att window.print() kräver det. */
export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="flex cursor-pointer items-center gap-1.5 rounded-md bg-slate-900 px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
    >
      <Printer size={14} aria-hidden />
      Skriv ut / spara som PDF
    </button>
  );
}
