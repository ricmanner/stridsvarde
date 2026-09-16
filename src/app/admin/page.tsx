import { Building2, ShieldCheck, UserX, Users } from 'lucide-react';

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

import UnitDetail from './UnitDetail';
import UnitTree from './UnitTree';

export const dynamic = 'force-dynamic';

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ unit?: string }>;
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
  const requested = Number((await searchParams).unit);
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

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">
        <div className="no-print mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard icon={<Building2 size={15} />} label="Enheter" value={stats.units} />
          <StatCard icon={<Users size={15} />} label="Värnpliktiga" value={stats.soldiers} />
          <StatCard icon={<ShieldCheck size={15} />} label="Befäl" value={stats.leaders} />
          <StatCard icon={<UserX size={15} />} label="Spärrade" value={stats.inactive} />
        </div>

        {/* Lagringstid — beslutet är Försvarsmaktens, inte appens. */}
        <div className="no-print mb-6 rounded-md border border-slate-200 bg-white px-4 py-3">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">
              Gallring av hälsodata
            </span>
            {retention.enabled ? (
              <span className="text-sm text-slate-700">
                Aktiv — sparas i {retention.days} dagar.
                {retention.affected > 0 && ` ${retention.affected} poster raderas vid nästa start.`}
              </span>
            ) : (
              <span className="text-sm text-slate-700">
                Avstängd — incheckningar sparas tills vidare.
              </span>
            )}
            {retention.oldest && (
              <span className="text-xs text-slate-400">äldsta uppgift: {retention.oldest}</span>
            )}
          </div>
          {!retention.enabled && (
            <p className="mt-1 text-xs leading-relaxed text-slate-400">
              GDPR tillåter inte att hälsodata sparas längre än nödvändigt. Lagringstiden
              sätts med RETENTION_DAYS och bör beslutas av Försvarsmaktens dataskyddsombud.
            </p>
          )}
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
          {/* ── Enhetsträd ── */}
          <section className="no-print">
            {/* Överflödig på mobil — där står vald enhet i väljarens huvud. */}
            <h2 className="mb-2 hidden text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500 lg:block">
              Organisation
            </h2>
            <UnitTree tree={tree} selectedId={selectedId} />
          </section>

          {/* ── Vald enhet ── */}
          <section>
            {selected ? (
              <UnitDetail
                unit={{
                  id: selected.id,
                  name: selected.name,
                  kind: selected.kind,
                  kindLabel: KIND_LABEL[selected.kind],
                }}
                members={members}
                currentUserId={session.id}
                moveTargets={moveTargets}
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
      <div className="mb-1 flex items-center gap-1.5 text-slate-400">
        {icon}
        <span className="text-[10px] font-bold uppercase tracking-[0.08em]">{label}</span>
      </div>
      <span className="text-xl font-bold tabular-nums text-slate-900">{value}</span>
    </div>
  );
}
