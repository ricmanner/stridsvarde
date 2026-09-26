'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { Check, ChevronLeft, ChevronRight } from 'lucide-react';

import CategoryIcon from '@/components/CategoryIcon';
import ScoreSlider from '@/components/ScoreSlider';
import { CATEGORIES, type Category, getStatus, statusBg, statusLabel, statusTextColor } from '@/lib/data';
import { submitCheckIn, type CheckInState } from '@/app/actions/checkin';
import { formatScore, procent } from '@/lib/format';
import { TIDSGRÄNS_KLIENT_MS } from '@/lib/tidsgrans';

const EMPTY: Record<Category, number> = { fysisk: 5, psykisk: 5, social: 5, somn: 5, kost: 5, energi: 5 };

/**
 * Beskedet när ingenting alls kommer tillbaka.
 *
 * Skiljer sig från serverns med flit: når begäran aldrig fram vet vi inte om
 * något sparades, och då får vi inte påstå att det inte gjordes. Att trycka
 * igen är ofarligt — dagens rapport skrivs över, den dubbleras inte.
 */
const TYST_NÄT =
  'Ingen kontakt med servern. Kontrollera täckningen och försök igen — ' +
  'dina svar finns kvar, och du kan trycka utan att det blir dubbelt.';

const KNAPP =
  'flex w-full cursor-pointer items-center justify-center gap-2 rounded-md bg-slate-900 ' +
  'px-4 py-3.5 text-sm font-semibold tracking-[0.04em] text-white ' +
  'disabled:cursor-not-allowed disabled:bg-slate-300';

/**
 * Knappen som skickar in, med allt som hör till när nätet sviker.
 *
 * Egen komponent för att den ska gå att montera om. Det är inte en
 * uppstädning utan själva rättningen:
 *
 * `useActionState` KÖAR anrop. Ett nytt försök medan det första fortfarande
 * hänger ställer sig bakom det och skickas aldrig — knappen ser ut att
 * fungera men gör ingenting, vilket är värre än en låst knapp, för då tror
 * den värnpliktige att rapporten gått iväg. Det fångades av
 * `e2e/natverksfel.spec.ts`, inte av att någon läste koden.
 *
 * Att montera om komponenten ger en ny krok med tom kö. Den gamla begäran
 * rullar vidare i bakgrunden och kan mycket väl komma fram — det är
 * ofarligt, eftersom incheckningen skriver över dagens rad i stället för att
 * lägga till en ny.
 */
function Skickaformular({
  scores,
  editing,
  automatiskt,
  nyttFörsök,
}: {
  scores: Record<Category, number>;
  editing: boolean;
  /** Sant när komponenten just monterats om för ett nytt försök. */
  automatiskt: boolean;
  nyttFörsök: () => void;
}) {
  const [state, formAction, pending] = useActionState<CheckInState, FormData>(submitCheckIn, {});
  const [tystnad, setTystnad] = useState(false);
  const formulär = useRef<HTMLFormElement>(null);

  /*
   * Skyddsnät för det servern inte kan se.
   *
   * Hänger databasen slår serverns tidsgräns till och vi får ett riktigt
   * felmeddelande tillbaka. Men dör täckningen på väg TILL servern hör den
   * aldrig av begäran — då finns ingen som kan svara, och bara webbläsaren
   * vet att något är på gång.
   *
   * Väntar längre än servern (se lib/tidsgrans.ts), så att ett ärligt svar
   * som är på väg hinner fram innan vi drar den här slutsatsen.
   */
  useEffect(() => {
    if (!pending) return;
    const klocka = setTimeout(() => setTystnad(true), TIDSGRÄNS_KLIENT_MS);
    return () => clearTimeout(klocka);
  }, [pending]);

  // Trycket som begärde ett nytt försök var på den gamla komponenten. Skicka
  // direkt när den nya är på plats, så att ett tryck räcker.
  useEffect(() => {
    if (automatiskt) formulär.current?.requestSubmit();
  }, [automatiskt]);

  const fel = state.error ?? (tystnad ? TYST_NÄT : null);
  const etikett = editing ? 'Spara ändringen' : 'Bekräfta och skicka';

  return (
    /*
      Svaren skickas som ett vanligt formulär till en Server Action.
      Servern validerar varje värde på nytt — klienten är inte betrodd.
    */
    <form action={formAction} ref={formulär}>
      {CATEGORIES.map((cat) => (
        <input key={cat.key} type="hidden" name={cat.key} value={scores[cat.key]} />
      ))}

      {fel && (
        <p role="alert" className="mb-3 text-center text-xs text-red-700">
          {fel}
        </p>
      )}

      {/*
        Vid tystnad byts knappen ut mot en som ber om ett nytt formulär i
        stället för att skicka i det gamla. Skickade den som vanligt skulle
        anropet hamna i kön bakom det som redan hänger, och ingenting hända.
      */}
      {tystnad ? (
        <button type="button" onClick={nyttFörsök} className={KNAPP}>
          <Check size={16} aria-hidden />
          {etikett}
        </button>
      ) : (
        <button type="submit" disabled={pending} className={KNAPP}>
          <Check size={16} aria-hidden />
          {pending ? 'Sparar…' : etikett}
        </button>
      )}
    </form>
  );
}

/** Färgat märke — GRÖN, GUL eller RÖD. Färgen räknas fram, därav inline. */
function Marke({ score, size = 'sm' }: { score: number; size?: 'sm' | 'md' }) {
  const status = getStatus(score);
  return (
    <span
      className={`shrink-0 rounded-[3px] text-center font-bold tracking-[0.06em] ${
        size === 'md' ? 'px-3.5 py-1.5 text-xs' : 'min-w-10 px-[7px] py-0.5 text-etikett'
      }`}
      style={{ background: statusBg(status), color: statusTextColor(status) }}
    >
      {statusLabel(status)}
    </span>
  );
}

interface Props {
  /** Dagens redan sparade svar, när soldaten korrigerar en rapport. */
  initial?: Record<Category, number>;
  editing?: boolean;
  /**
   * Dagens datum som text, färdigformaterat av servern.
   *
   * Räknades tidigare ut här med `new Date().toLocaleDateString('sv-SE', …)`.
   * Det här är en klientkomponent, så den formaterade i WEBBLÄSARENS tidszon:
   * en soldat i en annan zon såg en dag i rubriken medan servern sparade en
   * annan i databasen.
   */
  dateLabel: string;
}

/**
 * Incheckningen: sex frågor, en i taget, och en sammanfattning.
 *
 * Skriven i Tailwind som resten av appen. Tidigare låg varje mått som ett
 * inline-objekt, vilket gjorde brytpunkter omöjliga och ledde till att
 * statusfärger och statustexter kopierades in för hand på fyra ställen.
 *
 * Svaren skickas till databasen via en Server Action, inte till localStorage.
 */
export default function SoldatCheckin({ initial, editing = false, dateLabel }: Props) {
  const [step, setStep] = useState(0);
  const [scores, setScores] = useState<Record<Category, number>>(initial ?? EMPTY);
  // Räknare, inte ett ja/nej: varje nytt försök ska ge ett NYTT formulär.
  const [omtag, setOmtag] = useState(0);

  const etikett = 'text-etikett font-bold uppercase tracking-[0.08em] text-slate-500';

  // ── Steg 0: vad som väntar ────────────────────────────────────────────────
  if (step === 0) {
    return (
      <div className="flex flex-1 flex-col bg-slate-50">
        <div className="flex flex-1 flex-col px-6 py-10">
          <div className="mb-10">
            <p className={`mb-2 ${etikett}`}>
              {editing ? 'Korrigera dagens rapport' : 'Daglig rapportering'}
            </p>
            <h2 className="mb-3 text-xl font-bold text-slate-900">{dateLabel}</h2>
            <p className="text-sm leading-relaxed text-slate-500">
              {editing
                ? 'Dina tidigare svar är förifyllda. Ändra det som blivit fel — den gamla rapporten skrivs över.'
                : 'Besvara sex frågor om ditt mående. Tar ungefär två minuter. Ditt befäl ser bara sammanställd data för hela gruppen.'}
            </p>
          </div>

          <ol className="mb-10 flex list-none flex-col gap-2 p-0">
            {CATEGORIES.map((cat, i) => (
              <li
                key={cat.key}
                className="flex items-center gap-3 rounded-md border border-slate-200 bg-white px-4 py-3"
              >
                <span className="text-slate-500">
                  <CategoryIcon namn={cat.icon} size={20} />
                </span>
                <span className="text-sm text-slate-600">{cat.label}</span>
                <span className="ml-auto flex size-5 items-center justify-center rounded-full border-[1.5px] border-slate-200 text-etikett text-slate-500">
                  {i + 1}
                </span>
              </li>
            ))}
          </ol>

          <button
            type="button"
            onClick={() => setStep(1)}
            className="cursor-pointer rounded-md bg-slate-900 px-4 py-3.5 text-sm font-semibold tracking-[0.04em] text-white"
          >
            {editing ? 'Fortsätt' : 'Starta incheckning'}
          </button>
        </div>
      </div>
    );
  }

  // ── Steg 1–6: en fråga i taget ────────────────────────────────────────────
  if (step >= 1 && step <= CATEGORIES.length) {
    const cat = CATEGORIES[step - 1];
    const score = scores[cat.key];
    const color = statusTextColor(getStatus(score));
    const andel = step / CATEGORIES.length;

    return (
      <div className="flex flex-1 flex-col bg-slate-50">
        <div className="border-b border-slate-200 bg-white px-6 py-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">
              Fråga {step} av {CATEGORIES.length}
            </span>
            <span className="text-xs text-slate-500">{procent(Math.round(andel * 100))}</span>
          </div>
          {/* Framstegsraden var ren grafik; nu berättar den var man är. */}
          <div
            role="progressbar"
            aria-valuenow={step}
            aria-valuemin={1}
            aria-valuemax={CATEGORIES.length}
            aria-label={`Fråga ${step} av ${CATEGORIES.length}`}
            className="h-[3px] rounded-sm bg-slate-100"
          >
            <div
              className="h-full rounded-sm bg-slate-900 transition-[width] duration-200"
              style={{ width: `${andel * 100}%` }}
            />
          </div>
        </div>

        <div className="flex flex-1 flex-col px-6 py-8">
          <div className="mb-2 flex items-center gap-2.5">
            <span className="text-slate-500">
              <CategoryIcon namn={cat.icon} size={20} />
            </span>
            <span className={etikett}>{cat.label}</span>
          </div>
          <h2 className="mb-10 text-xl font-bold text-slate-900">{cat.question}</h2>

          <div className="mb-8 flex items-baseline gap-2">
            <span className="text-[64px] font-extrabold leading-none tabular-nums" style={{ color }}>
              {score}
            </span>
            <span className="text-xl text-slate-500">/10</span>
            <span className="ml-3">
              <Marke score={score} size="md" />
            </span>
          </div>

          <div className="mb-3">
            <ScoreSlider
              value={score}
              color={color}
              label={cat.question}
              onChange={(v) => setScores((prev) => ({ ...prev, [cat.key]: v }))}
            />
            <div className="mt-2.5 flex justify-between text-etikett font-semibold">
              <span className="text-red-700">1 — Kritiskt</span>
              <span className="text-emerald-700">10 — Utmärkt</span>
            </div>
          </div>

          <div className="mb-auto flex justify-between pt-1" aria-hidden>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
              <span
                key={n}
                className={`text-etikett ${n === score ? 'font-bold text-slate-900' : 'text-slate-500'}`}
              >
                {n}
              </span>
            ))}
          </div>
        </div>

        <div className="flex gap-3 px-6 pb-8 pt-4">
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-white py-[13px] text-sm text-slate-600"
          >
            <ChevronLeft size={16} aria-hidden /> Tillbaka
          </button>
          <button
            type="button"
            onClick={() => setStep((s) => s + 1)}
            className="flex flex-[2] cursor-pointer items-center justify-center gap-1.5 rounded-md bg-slate-900 py-[13px] text-sm font-semibold tracking-[0.04em] text-white"
          >
            {step === CATEGORIES.length ? 'Sammanfattning' : 'Nästa'}
            <ChevronRight size={16} aria-hidden />
          </button>
        </div>
      </div>
    );
  }

  // ── Sammanfattning ────────────────────────────────────────────────────────
  const helhet = Object.values(scores).reduce((a, b) => a + b, 0) / CATEGORIES.length;

  return (
    <div className="flex flex-1 flex-col bg-slate-50">
      <div className="border-b border-slate-200 bg-white p-6">
        <p className={`mb-1 ${etikett}`}>Sammanfattning</p>
        <h2 className="text-xl font-bold text-slate-900">
          {editing ? 'Bekräfta ändringen' : 'Bekräfta din incheckning'}
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5">
        <div className="mb-4 rounded-md border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className={`mb-1 ${etikett}`}>Samlat mående</p>
              <span className="text-4xl font-extrabold tabular-nums text-slate-900">
                {formatScore(helhet)}
              </span>
              <span className="text-base text-slate-500"> /10</span>
            </div>
            <Marke score={helhet} size="md" />
          </div>
        </div>

        <div className="mb-6 overflow-hidden rounded-md border border-slate-200 bg-white">
          {CATEGORIES.map((cat, i) => (
            /*
             * En knapp, inte en div med onClick. Raden gick tidigare bara att
             * nå med mus: den som rättar ett svar med tangentbordet kom inte
             * åt den alls, och en skärmläsare berättade inte att den gick att
             * trycka på.
             */
            <button
              key={cat.key}
              type="button"
              onClick={() => setStep(i + 1)}
              aria-label={`Ändra ${cat.label}, nu ${scores[cat.key]} av 10`}
              className={`flex w-full cursor-pointer items-center gap-3 px-5 py-3.5 text-left ${
                i < CATEGORIES.length - 1 ? 'border-b border-slate-100' : ''
              }`}
            >
              <span className="text-slate-500">
                <CategoryIcon namn={cat.icon} size={20} />
              </span>
              <span className="flex-1 text-sm text-slate-600">{cat.label}</span>
              <span className="min-w-7 text-right text-xl font-bold tabular-nums text-slate-900">
                {scores[cat.key]}
              </span>
              <Marke score={scores[cat.key]} />
            </button>
          ))}
        </div>

        {/*
          Nyckeln gör om formuläret till ett nytt vid varje försök. Se
          kommentaren i Skickaformular — det är hela poängen med den.
        */}
        <Skickaformular
          key={omtag}
          scores={scores}
          editing={editing}
          automatiskt={omtag > 0}
          nyttFörsök={() => setOmtag((n) => n + 1)}
        />

        <p className="mt-2.5 text-center text-xs text-slate-500">
          Ditt befäl ser bara sammanställd data för hela gruppen, aldrig dina enskilda svar.
        </p>
      </div>
    </div>
  );
}
