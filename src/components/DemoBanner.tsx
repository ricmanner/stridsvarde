import { FlaskConical } from 'lucide-react';

import { environment } from '@/lib/db/client';

/**
 * Visas överst i demoläge.
 *
 * En demo och ett pilottest ser likadana ut i webbläsaren, och den som får
 * en länk vet inte vilket hen tittar på. Utan den här raden kan någon dra
 * slutsatser om "plutonens mående" ur siffror som är påhittade — eller, värre,
 * tro att en verklig soldats uppgifter ligger öppet.
 *
 * Renderas bara när PSVI_ENVIRONMENT=demo. I pilotläge finns den inte alls.
 */
export default function DemoBanner() {
  if (environment() !== 'demo') return null;

  return (
    <div className="no-print flex items-center justify-center gap-2 bg-amber-200 px-4 py-1.5 text-center">
      <FlaskConical size={13} className="shrink-0 text-amber-900" aria-hidden />
      <p className="text-[12px] font-semibold text-amber-900">
        Demoversion — all data är påhittad. Inga verkliga personer och inga
        verkliga hälsouppgifter.
      </p>
    </div>
  );
}
