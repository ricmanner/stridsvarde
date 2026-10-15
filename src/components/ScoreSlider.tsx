'use client';

import { useState } from 'react';

import { andelVidTryck, vardeVidTryck } from '@/lib/reglage';

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

/** Knappens bredd, samma som --psvi-tumbredd i globals.css. */
const TUMME = 40;

/**
 * Byggd på en riktig <input type="range">.
 *
 * Tidigare var det här 111 rader egen pekarhantering med div:ar: inget
 * tangentbordsstöd, ingen roll, inga aria-attribut. En soldat som inte kunde
 * använda mus eller pekskärm med precision kunde helt enkelt inte checka in.
 * För en myndighetsapplikation är det inte förhandlingsbart — lagen om
 * tillgänglighet till digital offentlig service kräver WCAG 2.1 AA.
 *
 * Det riktiga reglaget ligger kvar och sköter piltangenter, Home/End och
 * skärmläsare. Men det RITAR ingenting: spåret och knappen som syns är egna
 * element under det. Ett range-element med steg om 1 hoppar mellan
 * siffrorna, och dess tumme går inte att låta glida — Richard provade på
 * iPhone och tyckte att det hackade. De egna elementen glider (globals.css).
 *
 * TOMT LÄGE (sedan den 15 oktober). Reglaget stod förut på 5, och den som
 * bara tryckte Nästa skickade in en femma som såg ut som ett svar. Nu står en
 * grå knapp i mitten, utan färgad linje, och skärmläsaren säger "Inget svar
 * än". Ett range-element kan inte sakna värde, så det står på 5 inuti — det
 * gör att första piltrycket ger 4 eller 6, som väntat.
 *
 * TRYCK OCH DRAG räknas om till en siffra här (lib/reglage.ts), av två skäl:
 * - Ett tryck på femman i tomt läge ändrar inte värdet, så webbläsaren säger
 *   ingenting.
 * - iPhones Safari flyttar inte ett reglage vid tryck på spåret, och drar
 *   bara om man träffat tummen. Nu går det att trycka och dra var som helst.
 * På en dator gör webbläsaren samma sak själv och kommer fram till samma tal.
 */
export default function ScoreSlider({ value, onChange, color, label, beskrivning }: Props) {
  /*
   * Var fingret är, 0–1, medan man drar — null annars. Knappen följer
   * fingret utan att avrundas, och glider till siffran när man släpper.
   * Siffran som sparas är alltid hel (onChange).
   */
  const [fri, setFri] = useState<number | null>(null);
  const drar = fri !== null;
  const tom = value === null;
  // Mitt på skalan i tomt läge, där den grå knappen står.
  const andel = fri ?? ((value ?? 5) - 1) / 9;

  let valuetext = 'Inget svar än';
  if (!tom) valuetext = beskrivning ? `${value} av 10. ${beskrivning}` : `${value} av 10`;

  function franPekare(e: React.PointerEvent<HTMLInputElement>) {
    const ruta = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - ruta.left;
    setFri(andelVidTryck(x, ruta.width, TUMME));
    const v = vardeVidTryck(x, ruta.width, TUMME);
    if (v !== value) onChange(v);
  }

  return (
    <div
      className="psvi-reglage"
      data-tom={tom ? '' : undefined}
      data-drar={drar ? '' : undefined}
      style={
        {
          '--psvi-color': color,
          '--psvi-andel': andel,
        } as React.CSSProperties
      }
    >
      <div className="psvi-spar" aria-hidden />
      <div className="psvi-fyllning" aria-hidden />
      <div className="psvi-tumme" aria-hidden />
      <input
        type="range"
        min={1}
        max={10}
        step={1}
        value={value ?? 5}
        onChange={(e) => onChange(Number(e.target.value))}
        onPointerDown={franPekare}
        onPointerMove={(e) => {
          if (drar) franPekare(e);
        }}
        onPointerUp={() => setFri(null)}
        onPointerCancel={() => setFri(null)}
        onLostPointerCapture={() => setFri(null)}
        className="psvi-slider"
        aria-label={label}
        // Skärmläsare läser annars bara siffran. "7 av 10" är begripligt, och
        // beskrivningen ger samma sak som den som ser texten ovanför reglaget.
        aria-valuetext={valuetext}
      />
    </div>
  );
}
