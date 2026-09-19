import { BANDS } from './chart-theme';

/**
 * Förklarar bakgrundsfälten, en gång under grafen eller rutnätet.
 *
 * Ersätter tre saker som sa samma sak: färgade fält, streckade linjer och
 * etiketterna "GRÖNT" och "RÖTT" inne i grafen. Den senare satt dessutom vid 4
 * — gränsen till gult — medan förklaringen sa "Röd ≤ 3". Grafen motsade sig
 * själv. Gränserna här hämtas från samma konstanter som getStatus().
 */
export default function StatusBandLegend() {
  const [gron, gul, rod] = BANDS;
  const steg = [
    { band: gron, text: `Grön från ${gron.from}` },
    { band: gul, text: `Gul från ${gul.from}` },
    { band: rod, text: `Röd under ${rod.to}` },
  ];
  return (
    <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-etikett text-slate-500">
      <span>Bakgrund:</span>
      {steg.map(({ band, text }) => (
        <span key={text} className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="inline-block size-2.5 rounded-sm"
            style={{ background: band.color, opacity: band.opacity * 5 }}
          />
          {text}
        </span>
      ))}
    </p>
  );
}
