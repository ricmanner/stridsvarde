/**
 * Attrapp för next/headers.
 *
 * Modulen finns bara inne i en förfrågan och kastar utanför en. Spärren mot
 * upprepade felaktiga koder läser en rubrik för att hasha avsändaren, men
 * logiken som ska testas — hur snabbt försöken bromsas — beror inte på den.
 * Attrappen ger en tom uppsättning rubriker så att modulen går att importera.
 */
export async function headers() {
  return new Headers();
}
export async function cookies() {
  return {
    get: () => undefined,
    set: () => {},
    delete: () => {},
  };
}
