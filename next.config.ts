import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
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
