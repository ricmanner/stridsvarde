import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
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
