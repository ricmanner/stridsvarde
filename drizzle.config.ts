import type { Config } from 'drizzle-kit';

/**
 * Används bara vid utveckling för att generera migrationer:
 *   npx drizzle-kit generate
 *
 * De körs sedan av `npm run db:setup` (src/lib/db/index.ts). Mot en lokal fil
 * gör servern det själv vid start; mot en delad databas är det ett eget
 * beslut, och kommandot ska köras före driftsättning.
 */
export default {
  schema: './src/lib/db/schema.ts',
  out: './drizzle',
  dialect: 'turso', // libSQL — fungerar mot både file: och fjärrdatabas
  dbCredentials: {
    url: `file:${process.env.DATABASE_PATH ?? './data/psvi.db'}`,
  },
  strict: true,
  verbose: true,
} satisfies Config;
