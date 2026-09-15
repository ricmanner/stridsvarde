import type { Config } from 'drizzle-kit';

/**
 * Används bara vid utveckling för att generera migrationer:
 *   npx drizzle-kit generate
 *
 * Migrationerna körs sedan automatiskt när servern startar (se
 * src/lib/db/migrate.ts) så att ingen behöver köra ett kommando manuellt.
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
