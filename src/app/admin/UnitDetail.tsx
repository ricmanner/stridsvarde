'use client';

import { useActionState, useState } from 'react';
import { ArrowRightLeft, KeyRound, Pencil, Plus, Trash2, UserCheck, UserX } from 'lucide-react';

import {
  createUnitAction,
  createUsersAction,
  erasePersonalDataAction,
  moveUserAction,
  reissueCodeAction,
  renameUserAction,
  toggleUserActiveAction,
  type ActiveState,
  type CodeState,
  type EraseState,
  type MoveState,
  type RenameState,
  type UnitState,
} from '@/app/actions/admin';
import type { AdminUser, MoveTarget } from '@/lib/db/queries/admin';
import { ROLE_LABEL, type Role } from '@/lib/roles';

import CodeSheet from './CodeSheet';

interface Props {
  unit: { id: number; name: string; kind: string; kindLabel: string };
  members: AdminUser[];
  /** Inloggad administratör — den egna raden hanteras annorlunda. */
  currentUserId: number;
  /** Enheter personer i den här enheten kan flyttas till. */
  moveTargets: MoveTarget[];
}

/** Vilken roll som hör hemma på vilken nivå. */
const ROLE_FOR_KIND: Record<string, Role | null> = {
  bataljon: 'bataljon',
  kompani: 'kompani',
  pluton: 'pluton',
  grupp: null,
};

const CHILD_KIND: Record<string, string | null> = {
  bataljon: 'kompani',
  kompani: 'pluton',
  pluton: 'grupp',
  grupp: null,
};

export default function UnitDetail({ unit, members, currentUserId, moveTargets }: Props) {
  const [unitState, unitFormAction, creatingUnit] = useActionState<UnitState, FormData>(createUnitAction, {});
  const [codeState, codeFormAction, creatingUsers] = useActionState<CodeState, FormData>(createUsersAction, {});
  const [reissueState, reissueFormAction] = useActionState<CodeState, FormData>(reissueCodeAction, {});
  const [activeState, activeFormAction] = useActionState<ActiveState, FormData>(toggleUserActiveAction, {});
  const [moveState, moveFormAction, moving] = useActionState<MoveState, FormData>(moveUserAction, {});
  const [eraseState, eraseFormAction, erasing] = useActionState<EraseState, FormData>(erasePersonalDataAction, {});
  const [renameState, renameFormAction] = useActionState<RenameState, FormData>(renameUserAction, {});
  const [dismissed, setDismissed] = useState(0);
  /** Raden vars benämning redigeras just nu, om någon. */
  const [editing, setEditing] = useState<number | null>(null);

  const soldiers = members.filter((m) => m.role === 'soldat');
  const leaders = members.filter((m) => m.role !== 'soldat');

  // Namn som förekommer flera gånger i enheten. Utan något som skiljer dem
  // åt går det inte att se vilken rad man faktiskt klickar på.
  const dupeLabels = new Set(
    members.map((m) => m.label).filter((l, i, arr) => arr.indexOf(l) !== i),
  );

  const leaderRole = ROLE_FOR_KIND[unit.kind];
  const childKind = CHILD_KIND[unit.kind];
  const canHoldSoldiers = unit.kind === 'grupp' || unit.kind === 'pluton';

  // Nyutfärdade koder från endera formuläret, tills de stängs.
  const fresh = reissueState.codes ?? codeState.codes;
  const freshKey = (fresh ?? []).map((c) => c.code).join('|');
  const showCodes = fresh && fresh.length > 0 && dismissed !== freshKey.length;

  return (
    <div>
      <h2 className="no-print mb-2 text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">
        {unit.kindLabel} · {unit.name}
      </h2>

      {showCodes && fresh && (
        <CodeSheet
          codes={fresh}
          unitName={codeState.unitName ?? unit.name}
          onClose={() => setDismissed(freshKey.length)}
        />
      )}

      <div className="no-print flex flex-col gap-5">
        {/* ── Lägg till personer ── */}
        <section className="rounded-md border border-slate-200 bg-white p-4 sm:p-5">
          <h3 className="mb-3 text-sm font-bold text-slate-900">Lägg till personer</h3>

          {canHoldSoldiers ? (
            <form action={codeFormAction} className="mb-4 flex flex-wrap items-end gap-2">
              <input type="hidden" name="unitId" value={unit.id} />
              <input type="hidden" name="unitName" value={unit.name} />
              <input type="hidden" name="role" value="soldat" />
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold text-slate-500">Antal soldater</span>
                <input
                  name="count" type="number" min={1} max={50} defaultValue={8} required
                  className="w-24 rounded border-[1.5px] border-slate-200 px-2.5 py-1.5 text-sm outline-none focus:border-slate-900"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold text-slate-500">Benämning</span>
                <input
                  name="labelPrefix" defaultValue="Soldat" maxLength={30}
                  className="w-32 rounded border-[1.5px] border-slate-200 px-2.5 py-1.5 text-sm outline-none focus:border-slate-900"
                />
              </label>
              <button
                type="submit" disabled={creatingUsers}
                className="flex cursor-pointer items-center gap-1.5 rounded-md bg-slate-900 px-3.5 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:bg-slate-300"
              >
                <Plus size={14} aria-hidden />
                {creatingUsers ? 'Skapar…' : 'Skapa och generera koder'}
              </button>
            </form>
          ) : (
            <p className="mb-4 text-[13px] text-slate-500">
              Soldater placeras i en grupp eller pluton, inte direkt på {unit.kindLabel.toLowerCase()}snivå.
            </p>
          )}

          {leaderRole && (
            <form action={codeFormAction} className="flex flex-wrap items-end gap-2 border-t border-slate-100 pt-4">
              <input type="hidden" name="unitId" value={unit.id} />
              <input type="hidden" name="unitName" value={unit.name} />
              <input type="hidden" name="role" value={leaderRole} />
              <input type="hidden" name="count" value={1} />
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold text-slate-500">Befälets benämning</span>
                <input
                  name="labelPrefix" defaultValue={`${ROLE_LABEL[leaderRole]} ${unit.name}`}
                  maxLength={60} required
                  className="w-64 max-w-full rounded border-[1.5px] border-slate-200 px-2.5 py-1.5 text-sm outline-none focus:border-slate-900"
                />
              </label>
              <button
                type="submit" disabled={creatingUsers}
                className="flex cursor-pointer items-center gap-1.5 rounded-md border-[1.5px] border-slate-300 px-3.5 py-2 text-sm font-semibold text-slate-700 hover:border-slate-900 disabled:opacity-50"
              >
                <Plus size={14} aria-hidden />
                Lägg till befäl
              </button>
            </form>
          )}

          {codeState.error && <p role="alert" className="mt-3 text-sm text-red-600">{codeState.error}</p>}
        </section>

        {/* ── Ny underenhet ── */}
        {childKind && (
          <section className="rounded-md border border-slate-200 bg-white p-4 sm:p-5">
            <h3 className="mb-3 text-sm font-bold text-slate-900">
              Ny {childKind} under {unit.name}
            </h3>
            <form action={unitFormAction} className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="parentId" value={unit.id} />
              <input
                name="name" required minLength={2} maxLength={60}
                placeholder={childKind === 'grupp' ? 'Grupp 4' : childKind === 'pluton' ? 'Pluton 10' : '4. Kompaniet'}
                className="w-56 max-w-full rounded border-[1.5px] border-slate-200 px-2.5 py-1.5 text-sm outline-none focus:border-slate-900"
              />
              <button
                type="submit" disabled={creatingUnit}
                className="cursor-pointer rounded-md border-[1.5px] border-slate-300 px-3.5 py-2 text-sm font-semibold text-slate-700 hover:border-slate-900 disabled:opacity-50"
              >
                {creatingUnit ? 'Skapar…' : 'Skapa'}
              </button>
            </form>
            {unitState.error && <p role="alert" className="mt-2 text-sm text-red-600">{unitState.error}</p>}
            {unitState.created && <p className="mt-2 text-sm text-emerald-700">{unitState.created} skapad.</p>}
          </section>
        )}

        {/* ── Personer i enheten ── */}
        <section>
          <h3 className="mb-1 text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">
            Personer i enheten ({members.length})
          </h3>
          <p className="mb-2 text-[11px] leading-relaxed text-slate-500">
            Klicka på en benämning för att ändra den. Koden lagras bara som hash
            och går inte att söka på, så benämningen är det enda som knyter en
            rad till en person — den behöver vara något enheten känner igen.
            Vad som räcker är er bedömning: ett tjänstenummer eller en plats i
            gruppen fungerar lika bra som ett namn, med färre uppgifter.
          </p>

          {members.length === 0 ? (
            <p className="rounded-md border border-slate-200 bg-white px-4 py-5 text-center text-[13px] text-slate-400">
              Inga personer här ännu.
            </p>
          ) : (
            <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
              {[...leaders, ...soldiers].map((m, i) => {
                const isSelf = m.id === currentUserId;
                return (
                <div
                  key={m.id}
                  className={`flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 ${
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
                        className="cursor-pointer rounded bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-slate-800"
                      >
                        Spara
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditing(null)}
                        className="cursor-pointer rounded px-2 py-1 text-[11px] font-semibold text-slate-500 hover:text-slate-900"
                      >
                        Avbryt
                      </button>
                    </form>
                  ) : (
                    <>
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
                        <Pencil size={11} className="shrink-0 text-slate-300" aria-hidden />
                      </button>
                      {dupeLabels.has(m.label) && (
                        <span
                          className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-500"
                          title="Referensnummer — flera personer i enheten har samma namn"
                        >
                          #{m.id}
                        </span>
                      )}
                    </>
                  )}
                  {isSelf && (
                    <span className="rounded bg-amber-200 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-900">
                      Du
                    </span>
                  )}
                  {m.role !== 'soldat' && (
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                      {ROLE_LABEL[m.role]}
                    </span>
                  )}
                  <span className="text-[11px] text-slate-400">
                    {m.lastLoginAt ? `senast inloggad ${m.lastLoginAt.slice(0, 10)}` : 'aldrig inloggad'}
                  </span>

                  <div className="ml-auto flex items-center gap-1">
                    <form
                      action={reissueFormAction}
                      onSubmit={(e) => {
                        /*
                         * Bara för den egna raden. Den gamla koden slutar gälla
                         * omedelbart, och den nya visas en enda gång — hinner
                         * man inte skriva av den är man utelåst. Ett oavsiktligt
                         * klick här får inte kunna låsa ute administratören.
                         */
                        if (
                          isSelf &&
                          !confirm(
                            'Byta din egen inloggningskod?\n\n' +
                              'Den nuvarande slutar gälla direkt. Den nya visas en enda gång — ' +
                              'skriv av den innan du går vidare.\n\n' +
                              'Blir du ändå utelåst: kör "npm run aterstall-admin" i terminalen.',
                          )
                        ) {
                          e.preventDefault();
                        }
                      }}
                    >
                      <input type="hidden" name="userId" value={m.id} />
                      <button
                        type="submit"
                        title={
                          isSelf
                            ? 'Byt din egen kod. Du förblir inloggad, men den gamla koden slutar gälla.'
                            : 'Spärra nuvarande kod och utfärda en ny'
                        }
                        className="flex cursor-pointer items-center gap-1 rounded px-2 py-1 text-[11px] font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                      >
                        <KeyRound size={12} aria-hidden /> Ny kod
                      </button>
                    </form>

                    {/* Det egna kontot kan inte spärras — se setUserActive(). */}
                    {!isSelf && (
                      <form action={activeFormAction}>
                        <input type="hidden" name="userId" value={m.id} />
                        <input type="hidden" name="active" value={String(!m.active)} />
                        <button
                          type="submit"
                          title={m.active ? 'Spärra åtkomst' : 'Återaktivera'}
                          className="flex cursor-pointer items-center gap-1 rounded px-2 py-1 text-[11px] font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                        >
                          {m.active ? <UserX size={12} aria-hidden /> : <UserCheck size={12} aria-hidden />}
                          {m.active ? 'Spärra' : 'Aktivera'}
                        </button>
                      </form>
                    )}
                  </div>
                </div>
                );
              })}
            </div>
          )}

          {reissueState.error && <p role="alert" className="mt-2 text-sm text-red-600">{reissueState.error}</p>}
          {activeState.error && <p role="alert" className="mt-2 text-sm text-red-600">{activeState.error}</p>}
          {renameState.error && <p role="alert" className="mt-2 text-sm text-red-600">{renameState.error}</p>}
        </section>

        {/* ── Flytta person ── */}
        {members.length > 0 && (
          <section className="rounded-md border border-slate-200 bg-white p-4 sm:p-5">
            <h3 className="mb-1 text-sm font-bold text-slate-900">Flytta person</h3>
            <p className="mb-3 text-[13px] leading-relaxed text-slate-500">
              Personen behåller sin kod och hela sin historik. Tidigare svar räknas
              dock in i den nya enhetens statistik — systemet håller inte reda på var
              någon befann sig en viss dag.
            </p>
            <form action={moveFormAction} className="flex flex-wrap items-end gap-2">
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold text-slate-500">Person</span>
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
                <span className="text-[11px] font-semibold text-slate-500">Till enhet</span>
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
            {moveState.error && <p role="alert" className="mt-2 text-sm text-red-600">{moveState.error}</p>}
            {moveState.moved && (
              <p className="mt-2 text-sm text-emerald-700">Flyttad till {moveState.moved}.</p>
            )}
          </section>
        )}

        {/* ── Radera hälsodata ── */}
        {members.length > 0 && (
          <section className="rounded-md border border-red-200 bg-red-50/40 p-4 sm:p-5">
            <h3 className="mb-1 text-sm font-bold text-red-900">Radera hälsodata</h3>
            <p className="mb-3 text-[13px] leading-relaxed text-red-800">
              Rätten att bli raderad enligt GDPR artikel 17. Personens incheckningar
              tas bort permanent. Kontot och enhetstillhörigheten behålls, så att
              svarsfrekvensen fortfarande räknas rätt. Går inte att ångra.
            </p>
            <form
              action={eraseFormAction}
              onSubmit={(e) => {
                if (
                  !confirm(
                    'Radera den här personens samtliga incheckningar?\n\n' +
                      'Det går inte att ångra. Uppgifterna finns därefter bara kvar i ' +
                      'eventuella säkerhetskopior.',
                  )
                ) {
                  e.preventDefault();
                }
              }}
              className="flex flex-wrap items-end gap-2"
            >
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold text-red-700">Person</span>
                <select
                  name="userId"
                  required
                  className="w-48 max-w-full rounded border-[1.5px] border-red-200 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-red-600"
                >
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                      {dupeLabels.has(m.label) ? ` (#${m.id})` : ''}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="submit"
                disabled={erasing}
                className="flex cursor-pointer items-center gap-1.5 rounded-md border-[1.5px] border-red-300 px-3.5 py-2 text-sm font-semibold text-red-700 hover:border-red-600 hover:bg-red-100 disabled:opacity-50"
              >
                <Trash2 size={14} aria-hidden />
                {erasing ? 'Raderar…' : 'Radera svaren'}
              </button>
            </form>
            {eraseState.error && <p role="alert" className="mt-2 text-sm text-red-600">{eraseState.error}</p>}
            {eraseState.erased !== undefined && (
              <p className="mt-2 text-sm text-red-900">
                {eraseState.erased} {eraseState.erased === 1 ? 'incheckning' : 'incheckningar'} raderade.
              </p>
            )}
          </section>
        )}

        <p className="text-center text-xs leading-relaxed text-slate-400">
          Administratörsrollen har ingen åtkomst till hälsodata. Att lägga upp enheter
          och dela ut koder kräver inte att man kan läsa någons svar.
        </p>
      </div>
    </div>
  );
}
