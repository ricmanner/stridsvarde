'use client';

import { useActionState, useState } from 'react';
import { KeyRound, Plus, UserCheck, UserX } from 'lucide-react';

import {
  createUnitAction,
  createUsersAction,
  reissueCodeAction,
  toggleUserActiveAction,
  type CodeState,
  type UnitState,
} from '@/app/actions/admin';
import type { AdminUser } from '@/lib/db/queries/admin';
import { ROLE_LABEL, type Role } from '@/lib/roles';

import CodeSheet from './CodeSheet';

interface Props {
  unit: { id: number; name: string; kind: string; kindLabel: string };
  members: AdminUser[];
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

export default function UnitDetail({ unit, members }: Props) {
  const [unitState, unitFormAction, creatingUnit] = useActionState<UnitState, FormData>(createUnitAction, {});
  const [codeState, codeFormAction, creatingUsers] = useActionState<CodeState, FormData>(createUsersAction, {});
  const [reissueState, reissueFormAction] = useActionState<CodeState, FormData>(reissueCodeAction, {});
  const [dismissed, setDismissed] = useState(0);

  const soldiers = members.filter((m) => m.role === 'soldat');
  const leaders = members.filter((m) => m.role !== 'soldat');

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
          <h3 className="mb-2 text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">
            Personer i enheten ({members.length})
          </h3>

          {members.length === 0 ? (
            <p className="rounded-md border border-slate-200 bg-white px-4 py-5 text-center text-[13px] text-slate-400">
              Inga personer här ännu.
            </p>
          ) : (
            <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
              {[...leaders, ...soldiers].map((m, i) => (
                <div
                  key={m.id}
                  className={`flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 ${
                    i > 0 ? 'border-t border-slate-100' : ''
                  } ${m.active ? '' : 'bg-slate-50'}`}
                >
                  <span className={`text-sm ${m.active ? 'text-slate-700' : 'text-slate-400 line-through'}`}>
                    {m.label}
                  </span>
                  {m.role !== 'soldat' && (
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                      {ROLE_LABEL[m.role]}
                    </span>
                  )}
                  <span className="text-[11px] text-slate-400">
                    {m.lastLoginAt ? `senast inloggad ${m.lastLoginAt.slice(0, 10)}` : 'aldrig inloggad'}
                  </span>

                  <div className="ml-auto flex items-center gap-1">
                    <form action={reissueFormAction}>
                      <input type="hidden" name="userId" value={m.id} />
                      <button
                        type="submit"
                        title="Spärra nuvarande kod och utfärda en ny"
                        className="flex cursor-pointer items-center gap-1 rounded px-2 py-1 text-[11px] font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                      >
                        <KeyRound size={12} aria-hidden /> Ny kod
                      </button>
                    </form>
                    <form action={toggleUserActiveAction}>
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
                  </div>
                </div>
              ))}
            </div>
          )}

          {reissueState.error && <p role="alert" className="mt-2 text-sm text-red-600">{reissueState.error}</p>}
        </section>

        <p className="text-center text-xs leading-relaxed text-slate-400">
          Administratörsrollen har ingen åtkomst till hälsodata. Att lägga upp enheter
          och dela ut koder kräver inte att man kan läsa någons svar.
        </p>
      </div>
    </div>
  );
}
