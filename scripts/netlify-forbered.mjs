/**
 * Skapar katalogen som @netlify/plugin-nextjs glömmer skapa.
 *
 * Kringgår ett fel i plugin-nextjs 5.15.13 (senaste i skrivande stund).
 * Efter bygget kopierar pluginet Next-utdatan till serverfunktionen. De
 * flesta filerna går genom `cp`, som skapar målkatalogerna på vägen — men
 * `server/functions-config-manifest.json` skrivs om på plats med `writeFile`,
 * som inte gör det. Alla kopieringarna startas samtidigt, så skrivningen
 * hinner ofta före den `cp` som skulle ha skapat `server/`, och bygget dör på
 *
 *     ENOENT ... ___netlify-server-handler/.next/server/functions-config-manifest.json
 *
 * Manifestet skrivs bara om när det innehåller `/_middleware`, alltså bara för
 * projekt som har en proxy. Vi har `src/proxy.ts`, så vi träffas varje gång.
 *
 * Källa: plugin-nextjs, dist/build/content/server.js — `copyNextServerCode`
 * och `replaceFunctionsConfigManifest`.
 * https://github.com/opennextjs/opennextjs-netlify
 *
 * Varför det här fungerar: pluginet rensar `functions-internal` i `onPreBuild`,
 * som körs FÖRE byggkommandot (och på Netlifys egna byggservrar inte alls).
 * Katalogen vi skapar här finns alltså kvar när `onBuild` kopierar.
 *
 * Utanför Netlify skapar det här en tom katalog i `.netlify/`, som är
 * git-ignorerad. Ofarligt. Ta bort skriptet när pluginet rättats.
 */
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const dir = path.resolve(
  import.meta.dirname,
  '..',
  '.netlify/functions-internal/___netlify-server-handler/.next/server',
);

mkdirSync(dir, { recursive: true });
