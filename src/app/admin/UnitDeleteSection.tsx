'use client';

import { useActionState, useState, useTransition } from 'react';

import BekraftaKnapp from '@/components/BekraftaKnapp';
import { Trash2 } from 'lucide-react';

import {
  deleteUnitAction,
  previewUnitDeletionAction,
  type DeleteUnitState,
} from '@/app/actions/admin';
import type { UnitDeletion, UnitKind } from '@/lib/db/queries/admin';
import { uppräkning } from '@/lib/format';

/**
 * Radera en enhet med allt under sig.
 *
 * I tre steg, med flit:
 *   1. Ingenting visas förrän man klickar "Visa vad som raderas". Adminsidan
 *      ska inte räkna fram det vid varje sidbyte, och en farlig knapp ska inte
 *      stå framme i onödan.
 *   2. Förhandsvisningen säger exakt vad som försvinner — hur många
 *      underenheter och personer — eller varför det inte går.
 *   3. Är enheten inte tom måste man skriva dess namn. En bekräftelseruta
 *      klickar man förbi; att skriva "1. Kompaniet" gör man inte av misstag.
 *      Namnet kontrolleras också på servern, så det här är inte bara ett hinder
 *      i formuläret.
 */
export default function UnitDeleteSection({
  unitId,
  unitName,
  unitKind,
}: {
  unitId: number;
  unitName: string;
  unitKind: UnitKind;
}) {
  const [preview, setPreview] = useState<UnitDeletion | { error: string } | null>(null);
  const [loading, startLoading] = useTransition();
  const [bekraftelse, setBekraftelse] = useState('');
  const [state, formAction, deleting] = useActionState<DeleteUnitState, FormData>(deleteUnitAction, {});

  const visa = () => startLoading(async () => setPreview(await previewUnitDeletionAction(unitId)));

  return (
    <section className="rounded-md border border-red-200 bg-red-50/40 p-4 sm:p-5">
      <h3 className="mb-1 text-sm font-bold text-red-900">Radera enheten</h3>

      {!preview && (
        <>
          <p className="mb-3 text-xs leading-relaxed text-red-800">
            {/* En grupp kan aldrig ha underenheter — den ligger nederst i
                trädet. Texten var densamma för alla nivåer och lovade därför
                något som inte kunde finnas. */}
            {unitKind === 'grupp'
              ? `Tar bort ${unitName} med alla personer i den och deras rapporter.`
              : `Tar bort ${unitName} med allt som ligger under den: underenheter, personer och deras rapporter.`}
          </p>
          <button
            type="button"
            onClick={visa}
            disabled={loading}
            className="cursor-pointer rounded-md border-[1.5px] border-red-300 bg-white px-3.5 py-2 text-sm font-semibold text-red-700 hover:border-red-600 disabled:opacity-50"
          >
            {loading ? 'Räknar…' : 'Visa vad som raderas'}
          </button>
        </>
      )}

      {preview && 'error' in preview && (
        <p role="alert" className="text-sm text-red-700">{preview.error}</p>
      )}

      {preview && !('error' in preview) && preview.refusal && (
        <p className="text-xs leading-relaxed text-red-800">
          <strong>Kan inte raderas.</strong> {preview.refusal}
        </p>
      )}

      {preview && !('error' in preview) && !preview.refusal && (
        <DeleteForm
          preview={preview}
          bekraftelse={bekraftelse}
          setBekraftelse={setBekraftelse}
          formAction={formAction}
          deleting={deleting}
          onCancel={() => {
            setPreview(null);
            setBekraftelse('');
          }}
        />
      )}

      {state.error && <p role="alert" className="mt-2 text-sm text-red-700">{state.error}</p>}
    </section>
  );
}

function antal(n: number, en: string, flera: string): string {
  return `${n} ${n === 1 ? en : flera}`;
}

function DeleteForm({
  preview,
  bekraftelse,
  setBekraftelse,
  formAction,
  deleting,
  onCancel,
}: {
  preview: UnitDeletion;
  bekraftelse: string;
  setBekraftelse: (v: string) => void;
  formAction: (fd: FormData) => void;
  deleting: boolean;
  onCancel: () => void;
}) {
  const tom = preview.subunits === 0 && preview.people === 0;
  const matchar = bekraftelse.trim() === preview.name;

  /*
   * Ett enda led i uppräkningen, inte två listor som skarvas ihop efteråt.
   * Rapporterna låg tidigare utanför och lades till med ", och …", vilket gav
   * komma före "och" mellan två led — och två "och" efter varandra när både
   * underenheter och personer fanns. Se uppräkning() i lib/format.ts.
   */
  const delar = [
    preview.subunits > 0 && antal(preview.subunits, 'underenhet', 'underenheter'),
    preview.people > 0 && antal(preview.people, 'person', 'personer'),
    preview.people > 0 && 'alla deras rapporter',
  ].filter((d): d is string => Boolean(d));

  return (
    <form action={formAction}>
      <input type="hidden" name="unitId" value={preview.unitId} />

      {tom ? (
        <p className="mb-3 text-xs leading-relaxed text-red-800">
          {preview.name} är tom. Den tas bort permanent.
        </p>
      ) : (
        <>
          <p className="mb-3 text-xs leading-relaxed text-red-900">
            Raderar <strong>{preview.name}</strong> med {uppräkning(delar)}.{' '}
            <strong>Det går inte att ångra.</strong>
          </p>
          <label className="mb-3 flex flex-col gap-1">
            <span className="text-xs font-semibold text-red-900">
              {/* Inte i jämnbrett typsnitt: där ser "Pluton 2" ut att ha två
                  mellanslag, och den som skriver av det exakt får aldrig igång knappen. */}
              Skriv <strong className="font-bold">{preview.name}</strong> för att bekräfta
            </span>
            <input
              name="confirmName"
              value={bekraftelse}
              onChange={(e) => setBekraftelse(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              className="w-64 max-w-full rounded border-[1.5px] border-red-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-red-600"
            />
          </label>
        </>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {/*
          En tom enhet har ingen namnbekräftelse att skriva, så den får rutan
          i stället. En enhet med innehåll har redan bekräftats genom att
          namnet skrivits — att fråga en gång till hade varit att fråga två
          gånger om samma sak.
        */}
        {tom ? (
          <BekraftaKnapp
            fraga={`Radera ${preview.name}?`}
            forklaring={<p>Enheten är tom och tas bort permanent. Det går inte att ångra.</p>}
            bekraftaText="Radera enheten"
            disabled={deleting}
            className="flex cursor-pointer items-center gap-1.5 rounded-md bg-red-700 px-3.5 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:bg-red-300"
          >
            <Trash2 size={14} aria-hidden />
            {deleting ? 'Raderar…' : `Radera ${preview.name}`}
          </BekraftaKnapp>
        ) : (
          <button
            type="submit"
            disabled={deleting || !matchar}
            className="flex cursor-pointer items-center gap-1.5 rounded-md bg-red-700 px-3.5 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:bg-red-300"
          >
            <Trash2 size={14} aria-hidden />
            {deleting ? 'Raderar…' : `Radera ${preview.name}`}
          </button>
        )}
        <button
          type="button"
          onClick={onCancel}
          className="cursor-pointer px-2 py-2 text-xs font-semibold text-slate-500 hover:text-slate-900"
        >
          Avbryt
        </button>
      </div>
    </form>
  );
}
