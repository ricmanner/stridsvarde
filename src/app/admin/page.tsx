import { Building2, ShieldCheck, UserX, Users } from 'lucide-react';

import Link from 'next/link';

import AppHeader from '@/components/AppHeader';
import { requireRole } from '@/lib/auth/guard';
import {
  KIND_FOR_ROLE,
  KIND_LABEL,
  getAdminStats,
  getUnitTree,
  getUsersInUnit,
  type TreeNode,
} from '@/lib/db/queries/admin';
import { retentionStatus } from '@/lib/db/retention';
import { fullDateLabel } from '@/lib/date';
import { antal } from '@/lib/format';

import UnitDetail from './UnitDetail';
import UnitTree from './UnitTree';

export const dynamic = 'force-dynamic';

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ unit?: string; raderad?: string }>;
}) {
  const session = await requireRole('admin');

  /*
   * En våg, inte fyra.
   *
   * Varje fråga mot en fjärrdatabas är ett eget anrop över nätet. Sidan
   * gjorde nio frågor i fyra led efter varandra; nu fyra frågor samtidigt.
   *
   * Två av dem behövdes inte alls. Enhetens namn och nivå fanns redan i
   * trädet, och sökvägarna till flyttmålen går att räkna fram ur parentId —
   * de hämtades med en egen rekursiv fråga för uppgifter vi redan hade.
   *
   * Medlemmarna hämtas på den enhet som står i adressen, utan att först
   * vänta på trädet för att kontrollera att den finns. Är den påhittad
   * kostar det en extra fråga; i det normala fallet — någon klickar i
   * listan — sparar det ett helt led.
   */
  const { unit: unitParam, raderad } = await searchParams;
  const requested = Number(unitParam);
  const wanted = Number.isInteger(requested) && requested > 0 ? requested : null;

  const [tree, stats, retention, membersOfWanted] = await Promise.all([
    getUnitTree(),
    getAdminStats(),
    retentionStatus(),
    wanted === null ? Promise.resolve(null) : getUsersInUnit(wanted),
  ]);

  const selected = tree.find((n) => n.id === wanted) ?? tree[0] ?? null;
  const selectedId = selected?.id;

  const members = !selected
    ? []
    : selected.id === wanted && membersOfWanted !== null
      ? membersOfWanted
      : await getUsersInUnit(selected.id);

  /*
   * Målenheter för förflyttning. Rollen i enheten avgör vilka nivåer som är
   * giltiga — en plutonchef kan inte placeras på en grupp. Har enheten både
   * värnpliktiga och befäl listas unionen, och servern avvisar ändå ett
   * omöjligt val i moveUser().
   */
  const byId = new Map(tree.map((n) => [n.id, n]));

  /** Hela vägen ned, så att två "Grupp 1" går att skilja åt. */
  const pathOf = (node: TreeNode): string => {
    const delar = [node.name];
    for (let id = node.parentId; id !== null; ) {
      const upp = byId.get(id);
      if (!upp) break;
      delar.unshift(upp.name);
      id = upp.parentId;
    }
    return delar.join(' › ');
  };

  const kinds = new Set(members.flatMap((m) => KIND_FOR_ROLE[m.role]));
  const moveTargets = tree
    .filter((n) => kinds.has(n.kind))
    .map((n) => ({ id: n.id, name: n.name, kind: n.kind, path: pathOf(n) }));

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader unit="Administration" label={session.label} role={session.role} />

      <main id="innehall" className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">
        {/* Sidan hade ingen rubrik alls i strukturen — den började på en h2. */}
        <h1 className="sr-only">Administration</h1>
        <div className="no-print mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard icon={<Building2 size={15} />} label="Enheter" value={stats.units} />
          <StatCard icon={<Users size={15} />} label="Värnpliktiga" value={stats.soldiers} />
          <StatCard icon={<ShieldCheck size={15} />} label="Befäl" value={stats.leaders} />
          <StatCard icon={<UserX size={15} />} label="Spärrade" value={stats.inactive} />
        </div>

        {/* Lagringstid — beslutet är Försvarsmaktens, inte appens. */}
        <div className="no-print mb-6 rounded-md border border-slate-200 bg-white px-4 py-3">
          {/*
            Rubriken behåller fackordet "gallring" — det är arkivlagens term
            och den en registrator känner igen. Men meningen under förklarar
            sig själv, så rutan går att förstå utan ordet. Richard, som är
            just den administratör vyn skrivs för, kände inte igen varken
            "gallring" eller "avstängd" när de stod som etiketter utan
            förklaring.

            Staplat i stället för på en rad: tre fragment i tre storlekar som
            radbröts mot varandra gav ingen läsordning alls.
          */}
          <p className="text-etikett font-bold uppercase tracking-[0.08em] text-slate-500">
            Gallring av hälsodata
          </p>
          <p className="mt-1 text-sm text-slate-900">
            {retention.enabled
              ? `Uppgifter raderas automatiskt när de är äldre än ${retention.days} dagar.`
              : 'Gamla uppgifter raderas inte — allt sparas tills vidare.'}
          </p>
          {retention.enabled && retention.affected > 0 && (
            <p className="mt-1 text-xs text-slate-500">
              {antal(retention.affected, 'uppgift är', 'uppgifter är')} äldre än så och
              raderas inom kort.
            </p>
          )}
          {retention.oldest && (
            <p className="mt-1 text-xs text-slate-500">
              Äldsta uppgiften i databasen: {fullDateLabel(retention.oldest)}.
            </p>
          )}
          {!retention.enabled && (
            // Textbredd, inte rutbredd: rutan följer nyckeltalskorten ovanför
            // och blir mycket bred på en storskärm. En mening som löper över
            // hela den bredden tappar man bort sig i.
            <p className="mt-2 max-w-2xl text-xs leading-relaxed text-slate-500">
              Hur länge uppgifterna får sparas ska beslutas av Försvarsmaktens
              dataskyddsombud — GDPR tillåter inte att hälsodata sparas längre än
              nödvändigt.
            </p>
          )}
          {/*
            Statussidan gick bara att nå genom att kunna adressen utantill.
            Den visar databasens läge, fel som servern fångat, och knappen som
            lägger till tabeller och index som saknas.
          */}
          <p className="mt-2 text-xs">
            <Link href="/status" className="font-semibold text-slate-700 underline underline-offset-2 hover:text-slate-900">
              Systemstatus och databas
            </Link>
          </p>
        </div>

        {raderad && (
          <p role="status" className="no-print mb-4 rounded-md border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
            <strong>{raderad}</strong> raderades, med allt som låg under den.
          </p>
        )}

        <div className="grid gap-5 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
          {/* ── Enhetsträd ── */}
          <section className="no-print">
            {/* Överflödig på mobil — där står vald enhet i väljarens huvud. */}
            <h2 className="mb-2 hidden text-etikett font-bold uppercase tracking-[0.1em] text-slate-500 lg:block">
              Organisation
            </h2>
            <UnitTree tree={tree} selectedId={selectedId} />
          </section>

          {/* ── Vald enhet ── */}
          <section>
            {selected ? (
              <UnitDetail
                /* Nyckeln nollställer formulärens läge när man byter enhet —
                   annars ligger en påbörjad radering kvar på nästa enhet. */
                key={selected.id}
                unit={{
                  id: selected.id,
                  name: selected.name,
                  kind: selected.kind,
                  kindLabel: KIND_LABEL[selected.kind],
                }}
                members={members}
                currentUserId={session.id}
                moveTargets={moveTargets}
                childNames={tree.filter((n) => n.parentId === selected.id).map((n) => n.name)}
              />
            ) : (
              <p className="text-sm text-slate-500">Ingen enhet vald.</p>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-md border border-slate-200 bg-white px-4 py-3">
      <div className="mb-1 flex items-center gap-1.5 text-slate-500">
        {icon}
        <span className="text-etikett font-bold uppercase tracking-[0.08em]">{label}</span>
      </div>
      <span className="text-xl font-bold tabular-nums text-slate-900">{value}</span>
    </div>
  );
}
