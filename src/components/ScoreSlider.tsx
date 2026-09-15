'use client';

interface Props {
  value: number; // 1–10
  onChange: (v: number) => void;
  color: string;
  /** Frågan reglaget besvarar — läses upp av skärmläsare. */
  label: string;
}

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
 */
export default function ScoreSlider({ value, onChange, color, label }: Props) {
  const pct = ((value - 1) / 9) * 100;

  return (
    <input
      type="range"
      min={1}
      max={10}
      step={1}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="psvi-slider"
      aria-label={label}
      // Skärmläsare läser annars bara siffran. "7 av 10" är begripligt.
      aria-valuetext={`${value} av 10`}
      style={
        {
          '--psvi-color': color,
          '--psvi-pct': `${pct}%`,
        } as React.CSSProperties
      }
    />
  );
}

