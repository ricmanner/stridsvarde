'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { ChevronDown } from 'lucide-react';

import type { TreeNode, UnitKind } from '@/lib/db/queries/admin';

/**
 * Organisationsträdet i adminvyn.
 *
 * Klientkomponent av två skäl.
 *
 * Markeringen ska flytta sig i samma ögonblick som man klickar. Tidigare var
 * raderna vanliga länkar till en force-dynamic-sida, så ingenting hände
 * förrän servern svarat — vid ett par hundra millisekunder känns det som att
 * klicket inte tog. Vi visar den klickade raden som vald medan navigeringen
 * pågår och faller tillbaka på serverns svar när den är klar. Ingen
 * synkronisering behövs: `isPending` slår om av sig självt, och då gäller
 * `selectedId` igen. Blev det fel enhet rättar sig listan alltså själv.
 *
 * Och på mobil är listan hopfälld. Med fyrtio enheter låg hela
 * organisationen mellan skärmens överkant och den enhet man just valt — man
 * fick skrolla förbi allt för att se resultatet av sitt eget klick. Nu står
 * vald enhet överst och listan fälls ut när man vill byta. På stora skärmar
 * finns sidospalten kvar som den var.
 */

/** Dämpad färg per nivå, så grupper och plutoner inte flyter ihop. */
const KIND_STYLE: Record<UnitKind, { bar: string; text: string; kort: string }> = {
  bataljon: { bar: 'bg-slate-400', text: 'text-slate-500', kort: 'BAT' },
  kompani: { bar: 'bg-sky-400', text: 'text-sky-700', kort: 'KOMP' },
  pluton: { bar: 'bg-teal-400', text: 'text-teal-700', kort: 'PLUT' },
  grupp: { bar: 'bg-amber-400', text: 'text-amber-700', kort: 'GRP' },
};

export default function UnitTree({
  tree,
  selectedId,
}: {
  tree: TreeNode[];
  selectedId: number | undefined;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [clicked, setClicked] = useState<number | null>(null);
  const [open, setOpen] = useState(false);

  const shown = pending && clicked !== null ? clicked : selectedId;
  const current = tree.find((n) => n.id === shown);

  function select(id: number) {
    setClicked(id);
    setOpen(false);
    startTransition(() => router.push(`/admin?unit=${id}`, { scroll: false }));
  }

  return (
    <div>
      {/* Vald enhet + utfällning. Bara på små skärmar. */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-3 text-left lg:hidden"
      >
        {current && (
          <span className={`h-5 w-[3px] shrink-0 rounded ${KIND_STYLE[current.kind].bar}`} aria-hidden />
        )}
        <span className="min-w-0 flex-1">
          <span className="block text-etikett font-bold uppercase tracking-[0.08em] text-slate-500">
            Vald enhet
          </span>
          <span className="block truncate text-sm font-semibold text-slate-900">
            {current ? current.name : 'Ingen'}
          </span>
        </span>
        <span className="shrink-0 text-etikett font-semibold text-slate-500">
          {open ? 'Stäng' : 'Byt'}
        </span>
        <ChevronDown
          size={16}
          className={`shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>

      <nav
        className={`overflow-hidden rounded-md border border-slate-200 bg-white lg:block ${
          open ? 'mt-2 block' : 'hidden'
        }`}
      >
        {tree.map((node) => {
          const isSelected = node.id === shown;
          const style = KIND_STYLE[node.kind];

          return (
            <a
              key={node.id}
              href={`/admin?unit=${node.id}`}
              aria-current={isSelected ? 'true' : undefined}
              onClick={(e) => {
                // Låt mittenklick och ctrl/cmd-klick öppna i ny flik som vanligt.
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
                e.preventDefault();
                select(node.id);
              }}
              className={`flex items-stretch gap-2 border-b border-slate-100 text-sm transition-colors last:border-b-0 ${
                isSelected ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {/* Färgad kant i stället för bakgrundsfärg: nivån syns, men listan
                  blir inte ett fält av kulörer när plutonen har nio grupper. */}
              <span className={`w-[3px] shrink-0 ${style.bar}`} aria-hidden />

              {/* py-3 på mobil, py-2.5 från sm: en rad ska gå att träffa med
                  tummen utan att listan blir onödigt lång på en bred skärm. */}
              <span
                className="flex flex-1 items-center gap-2 py-3 pr-3 sm:py-2.5"
                style={{ paddingLeft: 6 + node.depth * 14 }}
              >
                <span
                  className={`shrink-0 font-mono text-etikett font-bold tracking-wide ${
                    isSelected ? 'text-slate-400' : style.text
                  }`}
                >
                  {style.kort}
                </span>

                <span className="truncate">{node.name}</span>

                <span
                  className={`ml-auto shrink-0 text-etikett tabular-nums ${
                    isSelected ? 'text-slate-300' : 'text-slate-500'
                  }`}
                >
                  {node.totalSoldiers > 0 && `${node.totalSoldiers} vpl`}
                  {node.leaders > 0 && ` · ${node.leaders} bef`}
                </span>
              </span>
            </a>
          );
        })}
      </nav>
    </div>
  );
}
