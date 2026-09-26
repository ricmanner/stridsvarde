'use client';

import { useActionState, useState } from 'react';
import { ArrowRightLeft, Info, KeyRound, Pencil, Plus, Trash, Trash2, UserCheck, UserX } from 'lucide-react';

import BekraftaKnapp from '@/components/BekraftaKnapp';
import {
  createUnitAction,
  renameUnitAction,
  createUsersAction,
  deleteUserAction,
  erasePersonalDataAction,
  moveUserAction,
  reissueCodeAction,
  renameUserAction,
  toggleUserActiveAction,
  type ActiveState,
  type CodeState,
  type DeleteState,
  type EraseState,
  type MoveState,
  type RenameState,
  type UnitRenameState,
  type UnitState,
} from '@/app/actions/admin';
import { antal } from '@/lib/format';
import { kodnyckel, visaKodlapp } from '@/lib/kodlapp';
import type { AdminUser, MoveTarget, UnitKind } from '@/lib/db/queries/admin';
import { ROLE_LABEL, type Role } from '@/lib/roles';
import { NIVÅORD, ordformer, suggestChildName, type ChildKind } from '@/lib/unit-names';

import CodeSheet from './CodeSheet';
import UnitDeleteSection from './UnitDeleteSection';

interface Props {
  unit: { id: number; name: string; kind: UnitKind; kindLabel: string };
  members: AdminUser[];
  /** Inloggad administratör — den egna raden hanteras annorlunda. */
  currentUserId: number;
  /** Enheter personer i den här enheten kan flyttas till. */
  moveTargets: MoveTarget[];
  /** Namnen på enhetens befintliga underenheter — för att föreslå nästa. */
  childNames: string[];
}

/** Vilken roll som hör hemma på vilken nivå. */
const ROLE_FOR_KIND: Record<string, Role | null> = {
  bataljon: 'bataljon',
  kompani: 'kompani',
  pluton: 'pluton',
  grupp: null,
};

const CHILD_KIND: Record<string, ChildKind | null> = {
  bataljon: 'kompani',
  kompani: 'pluton',
  pluton: 'grupp',
  grupp: null,
};

export default function UnitDetail({ unit, members, currentUserId, moveTargets, childNames }: Props) {
  const [unitState, unitFormAction, creatingUnit] = useActionState<UnitState, FormData>(createUnitAction, {});
  const [namnState, namnFormAction, byterNamn] = useActionState<UnitRenameState, FormData>(renameUnitAction, {});
  const [codeState, codeFormAction, creatingUsers] = useActionState<CodeState, FormData>(createUsersAction, {});
  const [reissueState, reissueFormAction] = useActionState<CodeState, FormData>(reissueCodeAction, {});
  const [activeState, activeFormAction] = useActionState<ActiveState, FormData>(toggleUserActiveAction, {});
  const [moveState, moveFormAction, moving] = useActionState<MoveState, FormData>(moveUserAction, {});
  const [eraseState, eraseFormAction, erasing] = useActionState<EraseState, FormData>(erasePersonalDataAction, {});

  /*
   * Uppdelningen måste ligga före raderingsrutans state nedan, som utgår
   * från den första värnpliktige.
   */
  const soldiers = members.filter((m) => m.role === 'soldat');
  const leaders = members.filter((m) => m.role !== 'soldat');

  /*
   * Vem raderingsrutan ska namnge.
   *
   * Förvalt är första personen i listan — samma som webbläsaren väljer åt en
   * okontrollerad select. Utan det står fältet tomt och knappen går inte att
   * använda förrän man rört den.
   */
  const [raderaId, setRaderaId] = useState(() => String(soldiers[0]?.id ?? ''));
  const raderaNamn = soldiers.find((m) => String(m.id) === raderaId)?.label ?? 'personen';
  const [renameState, renameFormAction] = useActionState<RenameState, FormData>(renameUserAction, {});
  const [deleteState, deleteFormAction] = useActionState<DeleteState, FormData>(deleteUserAction, {});
  const [dismissed, setDismissed] = useState('');
  /** Raden vars benämning redigeras just nu, om någon. */
  const [editing, setEditing] = useState<number | null>(null);
  /** Om formuläret för värnpliktiga direkt på plutonen är utfällt. */
  const [visaVpl, setVisaVpl] = useState(false);


  // Namn som förekommer flera gånger i enheten. Utan något som skiljer dem
  // åt går det inte att se vilken rad man faktiskt klickar på.
  const dupeLabels = new Set(
    members.map((m) => m.label).filter((l, i, arr) => arr.indexOf(l) !== i),
  );

  const leaderRole = ROLE_FOR_KIND[unit.kind];
  const childKind = CHILD_KIND[unit.kind];
  const isGrupp = unit.kind === 'grupp';
  const isPluton = unit.kind === 'pluton';
  const canHoldSoldiers = isGrupp || isPluton;

  // Nyutfärdade koder från endera formuläret, tills de stängs.
  const fresh = reissueState.codes ?? codeState.codes;
  const freshKey = kodnyckel(fresh);
  const showCodes = visaKodlapp(fresh, dismissed);

  return (
    <div>
      <h2 className="no-print mb-2 text-etikett font-bold uppercase tracking-[0.1em] text-slate-500">
        {unit.kindLabel} · {unit.name}
      </h2>

      {showCodes && fresh && (
        <CodeSheet
          codes={fresh}
          unitName={codeState.unitName ?? unit.name}
          onClose={() => setDismissed(freshKey)}
        />
      )}

      <div className="no-print flex flex-col gap-5">
        {/* ── Lägg till personer ── */}
        <section className="rounded-md border border-slate-200 bg-white p-4 sm:p-5">
          <h3 className="mb-3 text-sm font-bold text-slate-900">Lägg till personer</h3>

          {/*
            Befäl först på de nivåer som har befäl.
            En pluton består av grupper; de värnpliktiga hör hemma där, och
            på plutonsnivå sitter plutonchef och annan personal. Tidigare låg
            "Antal värnpliktiga: 8" överst även här, vilket gjorde det
            lättare att lägga dem på fel ställe än på rätt.
          */}
          {leaderRole && (
            <form action={codeFormAction} className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="unitId" value={unit.id} />
              <input type="hidden" name="unitName" value={unit.name} />
              <input type="hidden" name="role" value={leaderRole} />
              <input type="hidden" name="count" value={1} />
              <label className="flex flex-col gap-1">
                <span className="text-etikett font-semibold text-slate-500">Befälets benämning</span>
                <input
                  name="labelPrefix" defaultValue={`${ROLE_LABEL[leaderRole]} ${unit.name}`}
                  maxLength={60} required
                  className="w-64 max-w-full rounded border-[1.5px] border-slate-200 px-2.5 py-1.5 text-sm outline-none focus:border-slate-900"
                />
              </label>
              <button
                type="submit" disabled={creatingUsers}
                className="flex cursor-pointer items-center gap-1.5 rounded-md bg-slate-900 px-3.5 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:bg-slate-300"
              >
                <Plus size={14} aria-hidden />
                {creatingUsers ? 'Skapar…' : 'Lägg till befäl'}
              </button>
            </form>
          )}

          {isGrupp && (
            <form action={codeFormAction} className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="unitId" value={unit.id} />
              <input type="hidden" name="unitName" value={unit.name} />
              <input type="hidden" name="role" value="soldat" />
              <label className="flex flex-col gap-1">
                <span className="text-etikett font-semibold text-slate-500">Antal värnpliktiga</span>
                <input
                  name="count" type="number" min={1} max={50} defaultValue={8} required
                  className="w-24 rounded border-[1.5px] border-slate-200 px-2.5 py-1.5 text-sm outline-none focus:border-slate-900"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-etikett font-semibold text-slate-500">Benämning</span>
                <input
                  name="labelPrefix" defaultValue="Värnpliktig" maxLength={30}
                  className="w-36 rounded border-[1.5px] border-slate-200 px-2.5 py-1.5 text-sm outline-none focus:border-slate-900"
                />
              </label>
              <button
                type="submit" disabled={creatingUsers}
                className="flex cursor-pointer items-center gap-1.5 rounded-md bg-slate-900 px-3.5 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:bg-slate-300"
              >
                <Plus size={14} aria-hidden />
                {creatingUsers ? 'Skapar…' : 'Skapa värnpliktiga och koder'}
              </button>
            </form>
          )}

          {/*
            Fortfarande möjligt att lägga värnpliktiga direkt på plutonen —
            någon som ännu inte tilldelats en grupp måste kunna rapportera —
            men det är inte längre förstahandsvalet, och vad det innebär står
            utskrivet. Aggregaten visar dem som "Direkt i enheten".
          */}
          {isPluton && (
            <div className="mt-4 border-t border-slate-100 pt-4">
              {!visaVpl ? (
                <button
                  type="button"
                  onClick={() => setVisaVpl(true)}
                  className="cursor-pointer text-xs font-semibold text-slate-500 underline underline-offset-2 hover:text-slate-900"
                >
                  Lägg till värnpliktiga direkt i plutonen
                </button>
              ) : (
                <>
                  {/*
                    Bärnsten, inte grått och inte rött. Grå text säger "oviktigt",
                    men det här är ett val med en följd. Rött är reserverat för
                    det som inte går att ångra — radering — och skulle tappa sin
                    tyngd om det användes för en upplysning.
                  */}
                  <div
                    role="note"
                    className="mb-3 flex gap-2.5 rounded-md border border-amber-300 bg-amber-50 px-3.5 py-3"
                  >
                    <Info size={16} className="mt-0.5 shrink-0 text-amber-700" aria-hidden />
                    <div className="text-xs leading-relaxed text-amber-950">
                      <p className="font-semibold">Värnpliktiga hör normalt hemma i en grupp.</p>
                      <p className="mt-0.5">
                        De du lägger till här hamnar utanför grupperna och visas som{' '}
                        <strong>Direkt i enheten</strong> i befälets jämförelse. Använd det
                        bara för den som ännu inte fått en grupp.
                      </p>
                    </div>
                  </div>
                  <form action={codeFormAction} className="flex flex-wrap items-end gap-2">
                    <input type="hidden" name="unitId" value={unit.id} />
                    <input type="hidden" name="unitName" value={unit.name} />
                    <input type="hidden" name="role" value="soldat" />
                    <label className="flex flex-col gap-1">
                      <span className="text-etikett font-semibold text-slate-500">Antal</span>
                      <input
                        name="count" type="number" min={1} max={50} defaultValue={1} required
                        className="w-20 rounded border-[1.5px] border-slate-200 px-2.5 py-1.5 text-sm outline-none focus:border-slate-900"
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-etikett font-semibold text-slate-500">Benämning</span>
                      <input
                        name="labelPrefix" defaultValue="Värnpliktig" maxLength={30}
                        className="w-36 rounded border-[1.5px] border-slate-200 px-2.5 py-1.5 text-sm outline-none focus:border-slate-900"
                      />
                    </label>
                    <button
                      type="submit" disabled={creatingUsers}
                      className="flex cursor-pointer items-center gap-1.5 rounded-md border-[1.5px] border-slate-300 px-3.5 py-2 text-sm font-semibold text-slate-700 hover:border-slate-900 disabled:opacity-50"
                    >
                      <Plus size={14} aria-hidden />
                      {creatingUsers ? 'Skapar…' : 'Skapa'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setVisaVpl(false)}
                      className="cursor-pointer px-2 py-2 text-xs font-semibold text-slate-500 hover:text-slate-700"
                    >
                      Avbryt
                    </button>
                  </form>
                </>
              )}
            </div>
          )}

          {!canHoldSoldiers && (
            <p className="mt-4 border-t border-slate-100 pt-4 text-xs text-slate-500">
              {/* Ordet hämtas ur NIVÅORD. Byggt av sorten plus "snivå" blev det
                  "kompanisnivå", medan kompanichefens egen vy heter
                  "Kompaninivå" — appen motsade sig själv om samma enhet. */}
              Värnpliktiga placeras i en grupp, inte direkt på {NIVÅORD[unit.kind]}.
            </p>
          )}

          {codeState.error && <p role="alert" className="mt-3 text-sm text-red-700">{codeState.error}</p>}
        </section>

        {/* ── Byt namn på enheten ── */}
        <section className="rounded-md border border-slate-200 bg-white p-4 sm:p-5">
          {/* "Byt namn på enheten", inte på sorten: KIND_LABEL + "en" ger
              "kompanien" i stället för "kompaniet". Ett neutrum bland tre
              utrum är inte värt en böjningstabell. */}
          <h3 className="mb-3 text-sm font-bold text-slate-900">Byt namn på enheten</h3>
          <form action={namnFormAction} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="unitId" value={unit.id} />
            {/*
              "Enhetens namn", inte bara "Namn": fältet för ny underenhet
              längre ned heter också Namn, och två fält med samma etikett på
              samma sida går inte att skilja åt för den som lyssnar sig
              igenom formulären i stället för att se rubrikerna ovanför.
            */}
            <label className="flex flex-col gap-1">
              <span className="text-etikett font-semibold text-slate-500">Enhetens namn</span>
              {/*
                Nyckeln tvingar fram ett nytt fält när namnet ändrats. Utan
                den står det gamla värdet kvar i rutan efter ett lyckat byte,
                eftersom defaultValue bara läses när fältet monteras.
              */}
              <input
                key={unit.name}
                name="name" required minLength={2} maxLength={60}
                defaultValue={unit.name}
                className="w-56 max-w-full rounded border-[1.5px] border-slate-200 px-2.5 py-1.5 text-sm outline-none focus:border-slate-900"
              />
            </label>
            <button
              type="submit" disabled={byterNamn}
              className="cursor-pointer rounded-md border-[1.5px] border-slate-300 px-3.5 py-2 text-sm font-semibold text-slate-700 hover:border-slate-900 disabled:opacity-50"
            >
              {byterNamn ? 'Sparar…' : 'Spara namnet'}
            </button>
          </form>
          {namnState.error && <p role="alert" className="mt-2 text-sm text-red-700">{namnState.error}</p>}
          {namnState.renamed && !namnState.error && (
            <p className="mt-2 text-sm text-emerald-700">Enheten heter nu {namnState.renamed}.</p>
          )}
          <p className="mt-2 text-xs text-slate-500">
            Namnet är det enda som ändras. Underenheter, personer och incheckningar påverkas inte.
          </p>
        </section>

        {/* ── Ny underenhet ── */}
        {childKind && (
          <section className="rounded-md border border-slate-200 bg-white p-4 sm:p-5">
            <h3 className="mb-3 text-sm font-bold text-slate-900">
              {/* "Nytt kompani", inte "Ny kompani" — se ordformer() i lib/unit-names.ts. */}
              {ordformer(childKind).ny} {childKind} under {unit.name}
            </h3>
            <form action={unitFormAction} className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="parentId" value={unit.id} />
              {/* Fältet hade bara en platshållare. Den försvinner när man
                  börjar skriva, och en skärmläsare läser den inte som namnet
                  på fältet — det här var enda fältet i vyn utan etikett. */}
              <label className="flex flex-col gap-1">
                <span className="text-etikett font-semibold text-slate-500">Namn</span>
                <input
                  name="name" required minLength={2} maxLength={60}
                  placeholder={suggestChildName(childKind, childNames)}
                  className="w-56 max-w-full rounded border-[1.5px] border-slate-200 px-2.5 py-1.5 text-sm outline-none focus:border-slate-900"
                />
              </label>
              <button
                type="submit" disabled={creatingUnit}
                className="cursor-pointer rounded-md border-[1.5px] border-slate-300 px-3.5 py-2 text-sm font-semibold text-slate-700 hover:border-slate-900 disabled:opacity-50"
              >
                {creatingUnit ? 'Skapar…' : 'Skapa'}
              </button>
            </form>
            {unitState.error && <p role="alert" className="mt-2 text-sm text-red-700">{unitState.error}</p>}
            {unitState.created && <p className="mt-2 text-sm text-emerald-700">Skapade {unitState.created}.</p>}
          </section>
        )}

        {/* ── Personer i enheten ── */}
        <section>
          <h3 className="mb-1 text-etikett font-bold uppercase tracking-[0.1em] text-slate-500">
            Personer i enheten ({members.length})
          </h3>
          <p className="mb-2 text-etikett leading-relaxed text-slate-500">
            Klicka på en benämning för att ändra den. En kod går inte att ta
            fram i efterhand, så benämningen är det enda som knyter en rad till
            en person — den behöver vara något enheten känner igen.
            Vad som räcker är er bedömning: ett tjänstenummer eller en plats i
            gruppen fungerar lika bra som ett namn, med färre uppgifter.
          </p>

          {members.length === 0 ? (
            <p className="rounded-md border border-slate-200 bg-white px-4 py-5 text-center text-xs text-slate-500">
              Inga personer här ännu.
            </p>
          ) : (
            <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
              {[...leaders, ...soldiers].map((m, i) => {
                const isSelf = m.id === currentUserId;
                return (
                <div
                  key={m.id}
                  /*
                    Staplad på mobil, en rad från sm och uppåt.
                    Namn, brickor, inloggningsdatum och tre knappar fick
                    annars radbrytas fritt på en 390 px skärm, och `ml-auto`
                    slutade betyda något så fort det skedde — knapparna
                    hamnade var som helst.
                  */
                  className={`flex flex-col gap-y-2 px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-3 sm:py-2.5 ${
                    i > 0 ? 'border-t border-slate-100' : ''
                  } ${!m.active ? 'bg-slate-50' : isSelf ? 'bg-amber-50' : ''}`}
                >
                  {editing === m.id ? (
                    <form
                      /*
                       * Stänger direkt vid submit. Fälten har required och
                       * maxLength, så de fel servern kan svara med går knappt
                       * att nå härifrån — och kommer ett ändå visas det under
                       * listan.
                       */
                      action={(fd) => {
                        renameFormAction(fd);
                        setEditing(null);
                      }}
                      className="flex flex-wrap items-center gap-1.5"
                    >
                      <input type="hidden" name="userId" value={m.id} />
                      <input
                        name="label"
                        defaultValue={m.label}
                        required
                        /* Servern är den som avgör — se MAX_LABEL i queries/admin.ts. */
                        maxLength={60}
                        autoFocus
                        aria-label="Benämning"
                        className="w-52 max-w-full rounded border-[1.5px] border-slate-900 px-2 py-1 text-sm outline-none"
                      />
                      <button
                        type="submit"
                        className="cursor-pointer rounded bg-slate-900 px-2.5 py-1 text-etikett font-semibold text-white hover:bg-slate-800"
                      >
                        Spara
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditing(null)}
                        className="cursor-pointer rounded px-2 py-1 text-etikett font-semibold text-slate-500 hover:text-slate-900"
                      >
                        Avbryt
                      </button>
                    </form>
                  ) : (
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 sm:contents">
                      <button
                        type="button"
                        onClick={() => setEditing(m.id)}
                        title="Byt benämning"
                        className="flex cursor-pointer items-center gap-1.5 rounded px-1 py-0.5 -mx-1 text-left hover:bg-slate-100"
                      >
                        <span
                          className={`text-sm ${m.active ? 'text-slate-700' : 'text-slate-400 line-through'}`}
                        >
                          {m.label}
                        </span>
                        {/*
                          Alltid synlig, inte bara vid hover: på en pekskärm
                          finns ingen hover, och då vore funktionen omöjlig
                          att hitta.
                        */}
                        <Pencil size={11} className="shrink-0 text-slate-400" aria-hidden />
                      </button>
                      {dupeLabels.has(m.label) && (
                        <span
                          className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-etikett text-slate-600"
                          title="Referensnummer — flera personer i enheten har samma namn"
                        >
                          #{m.id}
                        </span>
                      )}
                    </div>
                  )}
                  {isSelf && (
                    <span className="rounded bg-amber-200 px-1.5 py-0.5 text-etikett font-bold uppercase tracking-wide text-amber-900">
                      Du
                    </span>
                  )}
                  {m.role !== 'soldat' && (
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-etikett font-bold uppercase tracking-wide text-slate-600">
                      {ROLE_LABEL[m.role]}
                    </span>
                  )}
                  <span className="text-etikett text-slate-500">
                    {m.lastLoginAt ? `senast inloggad ${m.lastLoginAt.slice(0, 10)}` : 'aldrig inloggad'}
                  </span>

                  {/*
                    Publicerade demokonton visas som låsta i stället för att
                    ge ett felmeddelande efter en bekräftelseruta. Servern
                    vägrar ändå — se arPublicerattDemokonto() — men en knapp
                    som alltid misslyckas är sämre än ingen knapp.
                  */}
                  {m.skyddad ? (
                    <span className="text-etikett text-slate-500 sm:ml-auto">
                      Låst — demonstrationens ingång
                    </span>
                  ) : (
                  <div className="-mx-1 flex items-center gap-0.5 sm:mx-0 sm:ml-auto sm:gap-1">
                    {/*
                      Ingen kodknapp på den egna raden.

                      Den nya koden visas en enda gång och går inte att hämta
                      fram igen. Ett felklick här låste ute administratören
                      tre gånger under utvecklingen, och varje gång krävdes
                      terminalåtkomst till servern. Bekräftelseruta räckte
                      inte — knappen är borta i stället, och servern avvisar
                      försöket även om någon anropar action:en direkt.

                      Behövs en ny adminkod: en annan administratör utfärdar
                      den, eller "npm run aterstall-admin" på servern.
                    */}
                    {!isSelf && (
                      <form action={reissueFormAction}>
                        <input type="hidden" name="userId" value={m.id} />
                        <button
                          type="submit"
                          title="Spärra nuvarande kod och utfärda en ny"
                          className="flex cursor-pointer items-center gap-1 rounded px-2 py-2 text-etikett font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-900 sm:py-1"
                        >
                          <KeyRound size={12} aria-hidden /> Ny kod
                        </button>
                      </form>
                    )}

                    {/* Det egna kontot kan inte spärras — se setUserActive(). */}
                    {!isSelf && (
                      <form action={activeFormAction}>
                        <input type="hidden" name="userId" value={m.id} />
                        <input type="hidden" name="active" value={String(!m.active)} />
                        <button
                          type="submit"
                          title={m.active ? 'Spärra åtkomst' : 'Återaktivera'}
                          className="flex cursor-pointer items-center gap-1 rounded px-2 py-2 text-etikett font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-900 sm:py-1"
                        >
                          {m.active ? <UserX size={12} aria-hidden /> : <UserCheck size={12} aria-hidden />}
                          {m.active ? 'Spärra' : 'Aktivera'}
                        </button>
                      </form>
                    )}

                    {/*
                      Radering, till skillnad från spärr. Spärren är rätt när
                      någon slutar men uppgifterna ska finnas kvar under
                      lagringstiden. Den här är för misstag — trettio koder
                      skapade av misstag ska inte ligga kvar för alltid.

                      Bekräftelsen säger vad som faktiskt händer, eftersom
                      rapporterna följer med och ingenting går att ångra.
                    */}
                    {!isSelf && (
                      <form action={deleteFormAction}>
                        <input type="hidden" name="userId" value={m.id} />
                        <BekraftaKnapp
                          fraga={`Ta bort ${m.label} permanent?`}
                          forklaring={
                            <>
                              <p>Kontot och personens alla incheckningar raderas. Det går inte att ångra.</p>
                              <p className="mt-1.5">
                                Ska uppgifterna finnas kvar — välj <strong>Spärra</strong> i stället.
                              </p>
                            </>
                          }
                          bekraftaText="Ta bort permanent"
                          className="flex cursor-pointer items-center gap-1 rounded px-2 py-2 text-etikett font-semibold text-slate-500 hover:bg-red-50 hover:text-red-700 sm:py-1"
                        >
                          <Trash size={12} aria-hidden /> Ta bort
                        </BekraftaKnapp>
                      </form>
                    )}
                  </div>
                  )}
                </div>
                );
              })}
            </div>
          )}

          {reissueState.error && <p role="alert" className="mt-2 text-sm text-red-700">{reissueState.error}</p>}
          {activeState.error && <p role="alert" className="mt-2 text-sm text-red-700">{activeState.error}</p>}
          {renameState.error && <p role="alert" className="mt-2 text-sm text-red-700">{renameState.error}</p>}
          {deleteState.error && <p role="alert" className="mt-2 text-sm text-red-700">{deleteState.error}</p>}
          {deleteState.deleted && (
            <p className="mt-2 text-sm text-slate-600">
              {deleteState.deleted.label} borttagen
              {deleteState.deleted.erased > 0 &&
                ` — ${antal(deleteState.deleted.erased, 'incheckning raderad', 'incheckningar raderade')}`}
              .
            </p>
          )}
        </section>

        {/* ── Flytta person ── */}
        {members.length > 0 && (
          <section className="rounded-md border border-slate-200 bg-white p-4 sm:p-5">
            <h3 className="mb-1 text-sm font-bold text-slate-900">Flytta person</h3>
            <p className="mb-3 text-xs leading-relaxed text-slate-500">
              Personen behåller sin kod och hela sin historik. Tidigare svar räknas
              dock in i den nya enhetens statistik — systemet håller inte reda på var
              någon befann sig en viss dag.
            </p>
            <form action={moveFormAction} className="flex flex-wrap items-end gap-2">
              <label className="flex flex-col gap-1">
                <span className="text-etikett font-semibold text-slate-500">Person</span>
                <select
                  name="userId"
                  required
                  className="w-48 max-w-full rounded border-[1.5px] border-slate-200 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-slate-900"
                >
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                      {dupeLabels.has(m.label) ? ` (#${m.id})` : ''}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-etikett font-semibold text-slate-500">Till enhet</span>
                <select
                  name="targetUnitId"
                  required
                  className="w-64 max-w-full rounded border-[1.5px] border-slate-200 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-slate-900"
                >
                  {moveTargets.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.path}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="submit"
                disabled={moving}
                className="flex cursor-pointer items-center gap-1.5 rounded-md border-[1.5px] border-slate-300 px-3.5 py-2 text-sm font-semibold text-slate-700 hover:border-slate-900 disabled:opacity-50"
              >
                <ArrowRightLeft size={14} aria-hidden />
                {moving ? 'Flyttar…' : 'Flytta'}
              </button>
            </form>
            {moveState.error && <p role="alert" className="mt-2 text-sm text-red-700">{moveState.error}</p>}
            {moveState.moved && (
              <p className="mt-2 text-sm text-emerald-700">Flyttad till {moveState.moved}.</p>
            )}
          </section>
        )}

        {/*
          ── Radera hälsodata ──

          Bara värnpliktiga. Listan visade tidigare alla i enheten, alltså
          även befäl — och eftersom bara rollen soldat får checka in blev
          svaret alltid "0 incheckningar raderade". Det ofarliga var de noll
          raderna; det skadliga var att rutan därmed påstod att befäl har
          egna hälsouppgifter. Servern vägrar numera också, se
          canErasePersonalData().
        */}
        {soldiers.length > 0 && (
          <section className="rounded-md border border-red-200 bg-red-50/40 p-4 sm:p-5">
            <h3 className="mb-1 text-sm font-bold text-red-900">Radera hälsodata</h3>
            <p className="mb-3 text-xs leading-relaxed text-red-800">
              Rätten till radering enligt GDPR artikel 17. Personens incheckningar
              tas bort permanent. Kontot och enhetstillhörigheten behålls, så att
              svarsfrekvensen fortfarande räknas rätt. Går inte att ångra.
            </p>
            <form action={eraseFormAction} className="flex flex-wrap items-end gap-2">
              <label className="flex flex-col gap-1">
                <span className="text-etikett font-semibold text-red-700">Person</span>
                {/*
                  Valet följs i state enbart för att bekräftelserutan ska kunna
                  säga vems svar som raderas. En ruta som säger "den här
                  personen" framför en lista med tjugofyra namn bekräftar
                  ingenting — man trycker ja på något man inte läst.
                */}
                <select
                  name="userId"
                  required
                  value={raderaId}
                  onChange={(e) => setRaderaId(e.target.value)}
                  className="w-48 max-w-full rounded border-[1.5px] border-red-200 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-red-600"
                >
                  {soldiers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                      {dupeLabels.has(m.label) ? ` (#${m.id})` : ''}
                    </option>
                  ))}
                </select>
              </label>
              <BekraftaKnapp
                fraga={`Radera samtliga incheckningar för ${raderaNamn}?`}
                forklaring={
                  <>
                    <p>Det går inte att ångra.</p>
                    <p className="mt-1.5">
                      Uppgifterna finns därefter bara kvar i eventuella säkerhetskopior.
                    </p>
                  </>
                }
                bekraftaText="Radera incheckningarna"
                disabled={erasing}
                className="flex cursor-pointer items-center gap-1.5 rounded-md border-[1.5px] border-red-300 px-3.5 py-2 text-sm font-semibold text-red-700 hover:border-red-600 hover:bg-red-100 disabled:opacity-50"
              >
                <Trash2 size={14} aria-hidden />
                {erasing ? 'Raderar…' : 'Radera incheckningarna'}
              </BekraftaKnapp>
            </form>
            {eraseState.error && <p role="alert" className="mt-2 text-sm text-red-700">{eraseState.error}</p>}
            {eraseState.erased !== undefined && (
              <p className="mt-2 text-sm text-red-900">
                {antal(eraseState.erased, 'incheckning raderad', 'incheckningar raderade')}.
              </p>
            )}
          </section>
        )}

        <UnitDeleteSection unitId={unit.id} unitName={unit.name} unitKind={unit.kind} />

        <p className="text-center text-xs leading-relaxed text-slate-500">
          Administratörsrollen har ingen åtkomst till hälsodata. Att lägga upp enheter
          och dela ut koder kräver inte att man kan läsa någons svar.
        </p>
      </div>
    </div>
  );
}
