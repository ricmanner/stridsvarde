import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'FM – PSVI',
  description: 'Försvarsmaktens Personliga Stridsvärdesindikator',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sv">
      <body style={{ background: '#E8EDF3', minHeight: '100dvh', display: 'flex', alignItems: 'flex-start', justifyContent: 'center' }}>
        <div
          style={{
            width: '100%',
            maxWidth: '430px',
            minHeight: '100dvh',
            background: '#F0F4F8',
            position: 'relative',
            boxShadow: '0 0 40px rgba(0,0,0,0.15)',
            overflow: 'hidden',
          }}
        >
          {children}
        </div>
      </body>
    </html>
  );
}
