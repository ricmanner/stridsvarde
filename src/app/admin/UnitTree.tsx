'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import type { TreeNode, UnitKind } from '@/lib/db/queries/admin';

/**
 * Organisationsträdet i adminvyn.
 *
 * Klientkomponent av ett enda skäl: markeringen ska flytta sig i samma
 * ögonblick som man klickar. Tidigare var raderna vanliga länkar till en
 * force-dynamic-sida, så ingenting hände förrän servern svarat — vid ett
 * par hundra millisekunder känns det som att klicket inte tog.
 *
 * Vi visar den klickade raden som vald medan navigeringen pågår och faller
 * tillbaka på serverns svar när den är klar. Ingen synkronisering behövs:
 * `isPending` slår om av sig självt, och då gäller `selectedId` igen. Blev
 * det fel enhet rättar sig listan alltså själv.
 */

/** Dämpad färg per nivå, så grupper och plutoner inte flyter ihop. */
const KIND_STYLE: Record<UnitKind, { bar: string; text: string; kort: string }> = {
  bataljon: { bar: 'bg-slate-400', text: 'text-slate-500', kort: 'BAT' },
  kompani: { bar: 'bg-sky-400', text: 'text-sky-600', kort: 'KOMP' },
  pluton: { bar: 'bg-teal-400', text: 'text-teal-600', kort: 'PLUT' },
  grupp: { bar: 'bg-amber-400', text: 'text-amber-600', kort: 'GRP' },
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

  const shown = pending && clicked !== null ? clicked : selectedId;

  return (
    <nav className="overflow-hidden rounded-md border border-slate-200 bg-white">
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
              setClicked(node.id);
              startTransition(() => router.push(`/admin?unit=${node.id}`, { scroll: false }));
            }}
            className={`flex items-stretch gap-2 border-b border-slate-100 text-sm transition-colors last:border-b-0 ${
              isSelected ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            {/* Färgad kant i stället för bakgrundsfärg: nivån syns, men listan
                blir inte ett fält av kulörer när plutonen har nio grupper. */}
            <span className={`w-[3px] shrink-0 ${style.bar}`} aria-hidden />

            <span
              className="flex flex-1 items-center gap-2 py-2.5 pr-3"
              style={{ paddingLeft: 6 + node.depth * 14 }}
            >
              <span
                className={`shrink-0 font-mono text-[9px] font-bold tracking-wide ${
                  isSelected ? 'text-slate-400' : style.text
                }`}
              >
                {style.kort}
              </span>

              <span className="truncate">{node.name}</span>

              <span
                className={`ml-auto shrink-0 text-[11px] tabular-nums ${
                  isSelected ? 'text-slate-300' : 'text-slate-400'
                }`}
              >
                {node.totalSoldiers > 0 && `${node.totalSoldiers} vpl.`}
                {node.leaders > 0 && ` · ${node.leaders} bef.`}
              </span>
            </span>
          </a>
        );
      })}
    </nav>
  );
}
