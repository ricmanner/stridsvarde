/**
 * Delas mellan sessionshanteringen och proxyn.
 *
 * Egen fil utan beroenden eftersom src/proxy.ts inte får dra in `server-only`
 * eller databasen — proxyn körs på varje enskild request.
 */
export const SESSION_COOKIE = 'psvi_session';
