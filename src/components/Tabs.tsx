'use client';

import { useRef } from 'react';

/**
 * Flikar som fungerar för den som inte använder mus.
 *
 * Tidigare var flikarna vanliga knappar i rad. För den som ser fungerade det;
 * för en skärmläsare lät det som tre lösryckta knappar, utan besked om att en
 * av dem var vald eller att innehållet under byttes ut. Lagen om
 * tillgänglighet till digital offentlig service kräver WCAG 2.1 AA, och det
 * här är ett av de ställen där kravet är enkelt att uppfylla och tydligt att
 * missa.
 *
 * Mönstret följer WAI-ARIA: en `tablist` med `tab`-knappar som pekar ut sin
 * panel, piltangenter mellan flikarna, och bara den valda fliken i
 * tabbordningen — så att en tangentbordsanvändare tabbar förbi flikraden i
 * ett steg i stället för tre, precis som i ett skrivbordsprogram.
 */

export interface Flik<T extends string> {
  id: T;
  etikett: string;
}

export default function Tabs<T extends string>({
  flikar,
  vald,
  onValj,
  etikett,
  className = '',
  knappklass,
}: {
  flikar: ReadonlyArray<Flik<T>>;
  vald: T;
  onValj: (id: T) => void;
  /** Vad flikraden heter för den som inte ser den. */
  etikett: string;
  className?: string;
  /** Utseendet bestäms av vyn; beteendet av den här komponenten. */
  knappklass: (valdFlik: boolean) => string;
}) {
  const knappar = useRef<Array<HTMLButtonElement | null>>([]);

  function tangent(e: React.KeyboardEvent, index: number) {
    const steg =
      e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : e.key === 'Home' ? -index : e.key === 'End' ? flikar.length - 1 - index : 0;
    if (steg === 0) return;

    e.preventDefault();
    const nasta = (index + steg + flikar.length) % flikar.length;
    onValj(flikar[nasta].id);
    knappar.current[nasta]?.focus();
  }

  return (
    <div role="tablist" aria-label={etikett} className={className}>
      {flikar.map((f, i) => {
        const aktiv = f.id === vald;
        return (
          <button
            key={f.id}
            ref={(el) => {
              knappar.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`flik-${f.id}`}
            aria-selected={aktiv}
            aria-controls={`panel-${f.id}`}
            tabIndex={aktiv ? 0 : -1}
            onClick={() => onValj(f.id)}
            onKeyDown={(e) => tangent(e, i)}
            className={knappklass(aktiv)}
          >
            {f.etikett}
          </button>
        );
      })}
    </div>
  );
}

/** Panelen som hör till en flik. Fokuserbar, så att innehållet går att nå. */
export function Panel({
  id,
  children,
  className = '',
}: {
  id: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      role="tabpanel"
      id={`panel-${id}`}
      aria-labelledby={`flik-${id}`}
      tabIndex={0}
      className={className}
    >
      {children}
    </div>
  );
}
