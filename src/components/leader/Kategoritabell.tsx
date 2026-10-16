import CategoryIcon from '@/components/CategoryIcon';
import StatusBadge from '@/components/StatusBadge';
import { CATEGORIES, type Category, getStatus, roundScore } from '@/lib/data';
import type { Kategorilage } from '@/lib/db/queries/aggregates';
import { formatScore, forandring } from '@/lib/format';

/**
 * Kategorierna i befälsvyns översikt: snitt, läge på skalan, förändring mot
 * perioden före, och hur många personer som ligger i rött.
 *
 * Ersätter staplarna som visade fördelningen av alla svar ("123 gula svar").
 * Richard, 16 oktober, efter fysioterapeuterna: befälen vill ha siffror rakt
 * på sak. Staplarna räknade svar i stället för personer, snittet stod minst
 * på raden, och de sju staplarna såg nästan likadana ut. Två skisser (en
 * siffertabell och en skala med markör) blev en: siffrorna står kvar, och
 * skalan visar läget och riktningen i en blick.
 *
 * Sorterad med sämst först — översiktens fråga är vad som behöver åtgärdas.
 * Trender och Jämförelse har fast ordning, så att en kategori står på samma
 * plats där.
 *
 * En rad per kategori i ett rutnät, inte en tabell: i telefonen bryts raden i
 * två, och varje värde bär sin egen etikett för skärmläsare (sr-only), så att
 * den inte behöver kolumnrubriker som bara syns på dator.
 */
export default function Kategoritabell({
  snitt,
  lage,
  svarande,
  period,
}: {
  snitt: Record<Category, number>;
  lage: Record<Category, Kategorilage> | null;
  /** Personer som svarat under perioden — "i rött" räknas av dem. */
  svarande: number;
  period: number;
}) {
  const rader = [...CATEGORIES].sort((a, b) => roundScore(snitt[a.key]) - roundScore(snitt[b.key]));
  /*
   * Finns det något att jämföra med? Med 21 dagar och en historik som är
   * kortare än sex veckor är hela kolumnen tom. Förklaringen lovade ändå en
   * ring för "21 dagarna före" (granskningen 16 oktober). Då säger den i
   * stället varför kolumnen är tom.
   */
  const harForra = CATEGORIES.some((c) => lage?.[c.key]?.forra != null);
  const KOLUMNER =
    'grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 ' +
    'sm:grid-cols-[minmax(9rem,1.3fr)_7rem_minmax(9rem,2fr)_7.5rem_5.5rem]';

  return (
    <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
      {/* Kolumnrubriker, bara på dator. Skärmläsare får etiketten i varje värde. */}
      <div
        aria-hidden
        className={`hidden border-b border-slate-200 bg-slate-50 px-5 py-2.5 text-etikett font-bold uppercase tracking-[0.08em] text-slate-500 sm:grid ${KOLUMNER}`}
      >
        <span>Kategori</span>
        <span className="text-right">Snitt</span>
        <span className="flex flex-col gap-1">
          Läge på skalan
          {/* Skalans siffror en gång, här, i stället för på varje rad. */}
          <span className="flex justify-between font-normal normal-case tracking-normal">
            <span>1</span>
            <span>4</span>
            <span>7</span>
            <span>10</span>
          </span>
        </span>
        <span className="text-right">Mot perioden före</span>
        <span className="text-right">I rött</span>
      </div>

      <ul>
        {rader.map((c) => {
          const v = snitt[c.key];
          const l = lage?.[c.key];
          return (
            <li key={c.key} className={`border-b border-slate-100 px-4 py-3 last:border-b-0 sm:px-5 ${KOLUMNER}`}>
              <span className="flex items-center gap-2.5 text-sm font-medium text-slate-800">
                <span className="text-slate-400">
                  <CategoryIcon namn={c.icon} size={15} />
                </span>
                {c.label}
              </span>

              <span className="flex items-center justify-end gap-2">
                <span className="sr-only">Snitt</span>
                <span className="text-lg font-bold tabular-nums text-slate-900">{formatScore(v)}</span>
                <StatusBadge status={getStatus(v)} size="sm" />
              </span>

              <span className="col-span-2 sm:col-span-1" aria-hidden>
                <Skala nu={v} forra={l?.forra ?? null} />
              </span>

              <Forandring nu={v} forra={l?.forra ?? null} period={period} />

              <span className="text-right text-sm tabular-nums text-slate-700">
                <span className="sr-only">I rött: </span>
                {l ? (
                  <>
                    <span className={l.iRott > 0 ? 'font-semibold text-red-700' : ''}>{l.iRott}</span>
                    <span className="text-slate-500"> av {svarande}</span>
                    <span className="sm:hidden"> i rött</span>
                  </>
                ) : (
                  '–'
                )}
              </span>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap gap-x-5 gap-y-1 border-t border-slate-100 px-4 py-2.5 text-etikett text-slate-500 sm:px-5">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-1 rounded-sm bg-slate-900" aria-hidden /> de senaste {period} dagarna
        </span>
        {harForra ? (
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block size-2 rounded-full border-2 border-slate-500 bg-white" aria-hidden /> {period} dagarna före
          </span>
        ) : (
          <span>Ingen jämförelse: för få svar under de {period} dagarna före</span>
        )}
        <span>I rött: personer vars eget snitt ligger under 4, av dem som svarat</span>
      </div>
    </div>
  );
}

/** Skalan 1–10 med fälten rött, gult och grönt, och de två markörerna. */
function Skala({ nu, forra }: { nu: number; forra: number | null }) {
  const pos = (v: number) => `${((roundScore(v) - 1) / 9) * 100}%`;
  return (
    <span className="block">
      <span className="relative block h-2 rounded-full bg-[linear-gradient(to_right,#fde2e2_0_33.33%,#fdf0d5_33.33%_66.66%,#dcf3e8_66.66%_100%)]">
        {forra !== null && (
          <span
            className="absolute top-0 size-2 -translate-x-1/2 rounded-full border-2 border-slate-500 bg-white"
            style={{ left: pos(forra) }}
          />
        )}
        <span
          className="absolute -top-1 h-4 w-1 -translate-x-1/2 rounded-sm bg-slate-900"
          style={{ left: pos(nu) }}
        />
      </span>
      {/* I telefonen saknas kolumnrubriken, så siffrorna står under varje skala. */}
      <span className="mt-1 flex justify-between text-etikett leading-none text-slate-500 sm:hidden">
        <span>1</span>
        <span>4</span>
        <span>7</span>
        <span>10</span>
      </span>
    </span>
  );
}

/** Förändringen i de tal som visas: pil och färg från ett halvt steg (forandring()). */
function Forandring({ nu, forra, period }: { nu: number; forra: number | null; period: number }) {
  if (forra === null) {
    return (
      <span className="text-sm text-slate-500 sm:text-right">
        <span className="sr-only">Mot perioden före: inget att jämföra med</span>
        <span aria-hidden>–</span>
      </span>
    );
  }
  const f = forandring(nu, forra);
  const text = (
    <span
      className={
        f.riktning === 'ned'
          ? 'font-semibold text-red-700'
          : f.riktning === 'upp'
            ? 'font-semibold text-emerald-700'
            : 'text-slate-500'
      }
    >
      {f.text}
    </span>
  );
  return (
    <span className="text-sm tabular-nums sm:text-right">
      <span className="sr-only">
        Mot de {period} dagarna före: från {formatScore(forra)}.{' '}
      </span>
      <span className="text-slate-500 sm:hidden">Mot perioden före </span>
      {text}
    </span>
  );
}
