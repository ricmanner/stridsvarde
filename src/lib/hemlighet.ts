import { createHash, timingSafeEqual } from 'node:crypto';

/**
 * Jämför två hemligheter utan att avslöja hur många tecken som stämde.
 *
 * En vanlig `===` på strängar ger upp vid första tecknet som skiljer. Skillnaden
 * i tid är liten men mätbar, och den som får gissa hur många gånger som helst kan
 * ta sig fram tecken för tecken i stället för att gissa hela hemligheten — ett
 * arbete som går från omöjligt till minuter.
 *
 * Båda värdena hashas först. Det gör två saker: längderna blir alltid lika, vilket
 * timingSafeEqual kräver för att inte kasta, och själva längden på hemligheten
 * läcker inte heller. Ett kastat fel mitt i en kontroll är en kontroll som inte
 * körs, och det är den sortens lucka som inte syns förrän någon letar efter den.
 *
 * Filen är avsiktligt fri från 'server-only' så att den går att testa utan att
 * ett helt serverbygge behöver startas.
 */
export function hemligheterLika(a: string, b: string): boolean {
  return timingSafeEqual(
    createHash('sha256').update(a, 'utf8').digest(),
    createHash('sha256').update(b, 'utf8').digest(),
  );
}
