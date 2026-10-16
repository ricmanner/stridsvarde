import { formatScore, procent } from '@/lib/format';
import type { Forandring, Veckokort } from '@/lib/veckosammanfattning';

/**
 * Veckan i korthet — överst i befälsvyns översikt och i utskriftsrapporten.
 *
 * Fyra fält med tal i stället för fyra meningar (Richard, 16 oktober:
 * siffror rakt på sak, och jämförelsen med förra veckan ska synas). Alltid de
 * senaste sju dagarna mot de sju före, oavsett vald period — det står i
 * rubrikraden.
 *
 * Ett kategorinamn står alltid helt och i samma färg. Ett tidigare utkast
 * delade "Kost" och "och näring" på två rader med olika färg.
 *
 * Ingen fotnot om hur rutan tas fram (Richard, 16 oktober): att den räknas ur
 * siffrorna utan AI är ett svar att ge muntligt.
 */
export default function Veckosammanfattning({ kort }: { kort: Veckokort }) {
  return (
    <section aria-labelledby="veckosammanfattning" className="mb-6">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2
          id="veckosammanfattning"
          className="text-etikett font-bold uppercase tracking-[0.1em] text-slate-500"
        >
          Senaste veckan
        </h2>
        <span className="text-xs text-slate-500">7 dagar jämfört med de 7 före</span>
      </div>

      {kort.underlag ? (
        <dl className="grid grid-cols-2 overflow-hidden rounded-md border border-slate-200 bg-white sm:grid-cols-4">
          <Falt etikett="Svarade i snitt" varde={procent(kort.svarsprocent)} under={`av ${kort.eligible} varje dag`} />
          <FaltForandring etikett="Störst försämring" f={kort.forsamring} riktning="ned" jamforbar={kort.jamforbar} />
          <FaltForandring etikett="Störst förbättring" f={kort.forbattring} riktning="upp" jamforbar={kort.jamforbar} />
          <Falt
            etikett="Lägst"
            varde={kort.lagst ? kort.lagst.namn : '–'}
            under={kort.lagst ? `snitt ${formatScore(kort.lagst.snitt)}` : 'inget att jämföra med'}
          />
        </dl>
      ) : (
        <p className="rounded-md border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
          Underlag saknas — för få svar för att sammanfatta veckan. I snitt svarade{' '}
          {procent(kort.svarsprocent)} av {kort.eligible} varje dag.
        </p>
      )}
    </section>
  );
}

/*
 * Fälten ramas in av rutnätet: en linje mellan fälten, ingen längs
 * ytterkanten. Fyra i rad på dator, två och två i telefon.
 */
const FALT =
  'flex flex-col gap-1 border-slate-100 px-4 py-3.5 sm:px-5 ' +
  '[&:nth-child(odd)]:border-r [&:nth-child(-n+2)]:border-b ' +
  'sm:[&:nth-child(-n+2)]:border-b-0 sm:[&:not(:last-child)]:border-r';

function Falt({ etikett, varde, under }: { etikett: string; varde: React.ReactNode; under: string }) {
  return (
    <div className={FALT}>
      <dt className="text-etikett font-bold uppercase tracking-[0.08em] text-slate-500">{etikett}</dt>
      <dd className="text-lg font-bold leading-snug tabular-nums text-slate-900">{varde}</dd>
      <dd className="text-xs text-slate-500">{under}</dd>
    </div>
  );
}

function FaltForandring({
  etikett,
  f,
  riktning,
  jamforbar,
}: {
  etikett: string;
  f: Forandring | null;
  riktning: 'upp' | 'ned';
  jamforbar: boolean;
}) {
  if (!jamforbar) return <Falt etikett={etikett} varde="–" under="för få svar veckan innan" />;
  if (!f) return <Falt etikett={etikett} varde="Ingen" under="ingen kategori ändrades 0,5 eller mer" />;
  const steg = Math.abs(f.till - f.fran);
  return (
    <Falt
      etikett={etikett}
      varde={
        <>
          {f.kategori}{' '}
          {/* Pilen och steget i färg: rött nedåt, grönt uppåt. Talen står också i texten under. */}
          <span className={`whitespace-nowrap ${riktning === 'ned' ? 'text-red-700' : 'text-emerald-700'}`}>
            {riktning === 'ned' ? '↓' : '↑'} {formatScore(steg)}
          </span>
        </>
      }
      under={`från ${formatScore(f.fran)} till ${formatScore(f.till)}`}
    />
  );
}
