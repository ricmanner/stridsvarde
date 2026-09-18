import type { Metadata, Viewport } from 'next';

import DemoBanner from '@/components/DemoBanner';

import './globals.css';

export const metadata: Metadata = {
  title: 'FM – PSVI',
  description: 'Försvarsmaktens Personliga Stridsvärdesindikator',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // maximumScale togs bort medvetet: att blockera zoom bryter mot
  // tillgänglighetskraven (WCAG 1.4.4) och är inte acceptabelt för en
  // myndighetsapplikation.
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sv">
      {/*
        Demons 430px telefonram är borttagen. Appen är nu responsiv på riktigt:
        soldater checkar in i mobilen, befäl analyserar på en bred skärm.
      */}
      <body>
        {/*
          Hoppa förbi sidhuvud, banner och organisationsträd. Syns bara för
          den som tabbar — på adminsidan ligger annars upp till fyrtio länkar
          före innehållet vid varje sidladdning.
        */}
        <a
          href="#innehall"
          className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-slate-900 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
        >
          Hoppa till innehållet
        </a>
        <DemoBanner />
        {children}
      </body>
    </html>
  );
}
