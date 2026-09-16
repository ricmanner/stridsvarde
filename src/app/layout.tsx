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
        <DemoBanner />
        {children}
      </body>
    </html>
  );
}
