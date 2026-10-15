import type { NextConfig } from 'next';

const utveckling = process.env.NODE_ENV === 'development';

/**
 * Innehållspolicy (CSP).
 *
 * Appen hämtar ingenting utifrån — inga teckensnitt, skript, bilder eller
 * anrop till någon annan värd. Därför kan allt låsas till 'self', och en
 * angripare som lyckas få in skript i sidan har ingen väg att ladda sin kod
 * eller skicka ut hälsodata.
 *
 * Två undantag, båda mätta och inte gissade:
 *
 * 'unsafe-inline' för STIL: Recharts skriver egna stilregler i sidan när
 * graferna ritas, och de fyra framräknade inline-stilarna i appen är just
 * inline. Utan undantaget ritas inga grafer alls.
 *
 * 'unsafe-inline' för SKRIPT: Next lägger in sitt uppstartsskript i sidan.
 * Rätt lösning är en nonce per request, men den kräver att varje sida renderas
 * dynamiskt — inloggningssidan är statisk idag, och att göra om det är en
 * arkitekturändring, inte en säkerhetsrättning. Undantaget hindrar alltså inte
 * inbakade skript, men det hindrar fortfarande att skript HÄMTAS från en annan
 * värd, vilket är den väg som behövs för att få ut data.
 *
 * 'unsafe-eval' bara i utveckling: React använder eval för att bygga
 * felmeddelanden med serverns stackspårning. I produktion behövs det inte.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${utveckling ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  // Appen får aldrig ligga i någon annans ram. Utan detta kan en angripare
  // lägga en osynlig ram över sin egen sida och lura ett inloggat befäl att
  // klicka på "Radera enhet" i tron att hen klickar på något annat.
  "frame-ancestors 'none'",
  // Skulle brytas mot http://localhost under utveckling.
  ...(utveckling ? [] : ['upgrade-insecure-requests']),
].join('; ');

const nextConfig: NextConfig = {
  /**
   * Säkerhetsrubriker på varje svar.
   *
   * Vercel lägger till strict-transport-security åt oss. Resten fanns inte.
   */
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          // Äldre webbläsare som inte känner frame-ancestors.
          { key: 'X-Frame-Options', value: 'DENY' },
          // Hindrar webbläsaren från att gissa filtyp och köra en CSV som HTML.
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          /*
           * Adressen kan avslöja vilken enhet ett befäl tittar på. Den ska
           * inte följa med till någon annan värd. Appen länkar inte ut
           * någonstans idag, så det kostar ingenting.
           */
          { key: 'Referrer-Policy', value: 'same-origin' },
          // Appen ber aldrig om kamera, mikrofon eller plats.
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
          },
        ],
      },
    ];
  },

  /**
   * Svara inte med `x-powered-by: Next.js`.
   *
   * Rubriken talar om exakt vilket ramverk som körs — det första en angripare
   * vill veta för att välja vilken sårbarhet som är värd att prova. Den gör
   * ingen nytta för appen.
   */
  poweredByHeader: false,

  /**
   * libSQL har native-bindningar som inte får buntas av Turbopack —
   * de måste laddas som vanliga Node-moduler på servern.
   */
  serverExternalPackages: [
    '@libsql/client',
    '@libsql/darwin-arm64',
    '@libsql/darwin-x64',
    '@libsql/linux-x64-gnu',
    '@libsql/linux-arm64-gnu',
  ],
};

export default nextConfig;
