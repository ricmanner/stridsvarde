'use client';

import { vardeVidTryck } from '@/lib/reglage';

interface Props {
  /** 1–10, eller null när frågan ännu inte besvarats. */
  value: number | null;
  onChange: (v: number) => void;
  color: string;
  /** Frågan reglaget besvarar — läses upp av skärmläsare. */
  label: string;
  /** Vad siffran betyder (lib/skala.ts) — läses upp efter siffran. */
  beskrivning?: string;
}

/** Tummens bredd, samma som i .psvi-slider i globals.css. */
const TUMME = 28;

/**
 * Byggd på en riktig <input type="range">.
 *
 * Tidigare var det här 111 rader egen pekarhantering med div:ar: inget
 * tangentbordsstöd, ingen roll, inga aria-attribut. En soldat som inte kunde
 * använda mus eller pekskärm med precision kunde helt enkelt inte checka in.
 * För en myndighetsapplikation är det inte förhandlingsbart — lagen om
 * tillgänglighet till digital offentlig service kräver WCAG 2.1 AA.
 *
 * Med ett native range-element får vi piltangenter, Home/End, skärmläsare och
 * pekskärm gratis, och koden blir en tredjedel så lång. Utseendet är
 * detsamma; stilen ligger i globals.css eftersom pseudo-element för
 * reglagets tumme inte går att sätta med inline-stilar.
 *
 * TOMT LÄGE (sedan den 15 oktober). Reglaget stod förut på 5, och den som
 * bara tryckte Nästa skickade in en femma som såg ut som ett svar. Ett
 * range-element kan inte sakna värde, så det står fortfarande på 5 inuti —
 * men utan tumme och utan färg, och med "Inget svar än" för skärmläsaren.
 * Att det står på 5 gör att första piltrycket ger 4 eller 6, som väntat.
 *
 * Två saker fångas för hand i tomt läge:
 * - Ett tryck mitt på femman ändrar inte värdet, så webbläsaren säger
 *   ingenting. Trycket räknas därför om till en siffra här.
 * - iPhones Safari flyttar inte ett reglage vid tryck på spåret, bara när man
 *   drar i tummen, och här finns ingen. Samma omräkning löser det.
 */
export default function ScoreSlider({ value, onChange, color, label, beskrivning }: Props) {
  const tom = value === null;
  const pct = tom ? 0 : ((value - 1) / 9) * 100;

  let valuetext = 'Inget svar än';
  if (!tom) valuetext = beskrivning ? `${value} av 10. ${beskrivning}` : `${value} av 10`;

  return (
    <input
      type="range"
      min={1}
      max={10}
      step={1}
      value={value ?? 5}
      onChange={(e) => onChange(Number(e.target.value))}
      onPointerDown={(e) => {
        if (!tom) return;
        const ruta = e.currentTarget.getBoundingClientRect();
        onChange(vardeVidTryck(e.clientX - ruta.left, ruta.width, TUMME));
      }}
      className={tom ? 'psvi-slider psvi-slider-tom' : 'psvi-slider'}
      aria-label={label}
      // Skärmläsare läser annars bara siffran. "7 av 10" är begripligt, och
      // beskrivningen ger samma sak som den som ser texten ovanför reglaget.
      aria-valuetext={valuetext}
      style={
        {
          '--psvi-color': color,
          '--psvi-pct': `${pct}%`,
        } as React.CSSProperties
      }
    />
  );
}
