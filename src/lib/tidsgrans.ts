/*
 * Bortre gränser för väntan.
 *
 * Appen hade tidigare ingen alls. Hängde Turso hängde begäran, och den
 * värnpliktige såg "Sparar…" i all evighet — ingen felruta, ingen möjlighet
 * att försöka igen, och laddade hen om sidan var sex svar borta.
 *
 * Två gränser behövs, inte en, för att två olika saker kan hänga:
 *
 *   Servern når inte databasen  → serverns gräns slår till, och den
 *                                 värnpliktige får ett riktigt felmeddelande.
 *   Telefonen når inte servern  → servern vet ingenting om saken. Bara
 *                                 webbläsaren kan ge upp, för ingen annan
 *                                 vet att något är på gång.
 *
 * Därför ligger båda talen här, intill varandra: förhållandet mellan dem är
 * det som betyder något, och det är lätt att råka bryta om de bor isär.
 *
 * Filen är avsiktligt fri från 'server-only' — klientens skyddsnät läser
 * samma tal, och de ska inte kunna glida isär.
 */

/**
 * Hur länge servern väntar på databasen innan den ger upp.
 *
 * Tio sekunder är valt efter vad en människa gör, inte efter vad nätet
 * klarar. Fem sekunder ger falsklarm på dåligt 4G, där sex till åtta
 * sekunder är fullt normalt. Tjugo känns som att appen hängt sig, och då
 * trycker folk om eller stänger — vilket är sämre än ett ärligt besked.
 */
export const TIDSGRÄNS_SERVER_MS = 10_000;

/**
 * Hur länge webbläsaren väntar på ett svar innan den släpper knappen.
 *
 * MÅSTE vara längre än serverns gräns. Ger klienten upp först klipps
 * serverns ärliga felmeddelande av på vägen, och värre: en incheckning som
 * faktiskt sparades ser ut att ha misslyckats. Marginalen på fem sekunder
 * rymmer resan fram och tillbaka.
 */
export const TIDSGRÄNS_KLIENT_MS = 15_000;

/** Kastas när något inte svarade i tid. Skild från fel i arbetet självt. */
export class Tidsgränsfel extends Error {
  constructor(vad: string, ms: number) {
    super(`${vad} svarade inte inom ${Math.round(ms / 1000)} sekunder`);
    this.name = 'Tidsgränsfel';
  }
}

/**
 * Väntar på `arbete`, men inte längre än `ms`.
 *
 * `vad` beskriver vad som väntas på och hamnar i felmeddelandet — står det
 * bara "tidsgräns överskriden" i felloggen kan administratören inte se var i
 * appen det satt.
 *
 * Viktigt att veta: arbetet AVBRYTS inte. Databasfrågan rullar vidare på
 * andra sidan och kan mycket väl lyckas efteråt. Det är acceptabelt just här
 * eftersom incheckningen skriver över dagens rad i stället för att lägga till
 * en ny (`onConflictDoUpdate` i queries/checkins.ts) — ett nytt försök ger
 * alltså aldrig två rapporter, oavsett vilket av försöken som kom fram.
 * Används den här funktionen på en väg som INTE tål att köras två gånger
 * måste det hanteras där.
 */
export async function medTidsgräns<T>(arbete: Promise<T>, ms: number, vad: string): Promise<T> {
  // Timern måste stoppas, inte bara ignoreras. En timer som får leva vidare
  // håller händelseslingan vid liv tills den löper ut, och i en serverlös
  // funktion kan svaret då bli liggande i tio sekunder fast arbetet tog
  // tjugo millisekunder — alltså precis det fel vi försöker rätta.
  let klocka: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      arbete,
      new Promise<never>((_, avvisa) => {
        klocka = setTimeout(() => avvisa(new Tidsgränsfel(vad, ms)), ms);
      }),
    ]);
  } finally {
    clearTimeout(klocka);
  }
}
