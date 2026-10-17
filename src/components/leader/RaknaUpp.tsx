// Ingen 'use client': komponenten används bara inifrån befälsvyn, som redan
// är en klientkomponent, och den tar en funktion (visa) som inte kan skickas
// från servern.
import { useEffect, useState, useSyncExternalStore } from 'react';

import { uppraknat } from '@/lib/rakna-upp';

const TID_MS = 700;
const ingenPrenumeration = () => () => {};

/**
 * Ett nyckeltal som räknas upp från noll — Richards val A den 16 oktober.
 *
 * Bara när befälsvyn monteras i webbläsaren efter en navigering, som
 * inloggningen. Vid en omladdning har servern redan ritat talet, och en
 * uppräkning då hade sett ut som att talet blinkade till noll och tillbaka.
 * useSyncExternalStore skiljer de två fallen åt: under hydreringen används
 * serverns svar (false), vid en vanlig montering webbläsarens (true).
 *
 * Inte heller vid byte av flik eller period — då står talet direkt. Aldrig
 * för den som valt "minska rörelse". Skärmläsare får slutvärdet, inte
 * siffrorna på vägen dit.
 */
export default function RaknaUpp({
  varde,
  decimaler = 0,
  visa,
  animera = true,
}: {
  varde: number;
  decimaler?: number;
  /** Hur talet skrivs, t.ex. formatScore eller procent. */
  visa: (v: number) => string;
  /**
   * Falskt när talet monteras igen efter ett flikbyte: då ska slutvärdet stå
   * direkt. Nyckeltalen ligger i Översikt och monteras om när man kommer
   * tillbaka dit (17 oktober).
   */
  animera?: boolean;
}) {
  const iWebblasaren = useSyncExternalStore(ingenPrenumeration, () => true, () => false);
  const [animerar] = useState(
    () =>
      animera &&
      iWebblasaren &&
      typeof window !== 'undefined' &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  const [lage, setLage] = useState<{ v: number; klar: boolean }>({ v: 0, klar: !animerar });

  useEffect(() => {
    if (!animerar) return;
    const start = performance.now();
    let ram = 0;
    const steg = (nu: number) => {
      const t = (nu - start) / TID_MS;
      if (t >= 1) {
        setLage({ v: varde, klar: true });
        return;
      }
      setLage({ v: uppraknat(t, varde, decimaler), klar: false });
      ram = requestAnimationFrame(steg);
    };
    ram = requestAnimationFrame(steg);
    return () => cancelAnimationFrame(ram);
    // Bara vid monteringen: ett nytt värde senare (annan period) visas direkt.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <span aria-hidden>{visa(lage.klar ? varde : lage.v)}</span>
      <span className="sr-only">{visa(varde)}</span>
    </>
  );
}
