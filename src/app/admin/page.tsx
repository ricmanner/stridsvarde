import Link from 'next/link';
import { Building2, ShieldCheck, UserX, Users } from 'lucide-react';

import AppHeader from '@/components/AppHeader';
import { requireRole } from '@/lib/auth/guard';
import {
  KIND_LABEL,
  getAdminStats,
  getUnit,
  getUnitTree,
  getUsersInUnit,
} from '@/lib/db/queries/admin';

import UnitDetail from './UnitDetail';

export const dynamic = 'force-dynamic';

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ unit?: string }>;
}) {
  const session = await requireRole('admin');

  const [tree, stats] = await Promise.all([getUnitTree(), getAdminStats()]);

  const requested = Number((await searchParams).unit);
  const selectedId = tree.some((n) => n.id === requested) ? requested : tree[0]?.id;
  const selected = selectedId ? await getUnit(selectedId) : null;
  const members = selectedId ? await getUsersInUnit(selectedId) : [];

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader unit="Administration" label={session.label} role={session.role} />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">
        <div className="no-print mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard icon={<Building2 size={15} />} label="Enheter" value={stats.units} />
          <StatCard icon={<Users size={15} />} label="Soldater" value={stats.soldiers} />
          <StatCard icon={<ShieldCheck size={15} />} label="Befäl" value={stats.leaders} />
          <StatCard icon={<UserX size={15} />} label="Spärrade" value={stats.inactive} />
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
          {/* ── Enhetsträd ── */}
          <section className="no-print">
            <h2 className="mb-2 text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">
              Organisation
            </h2>
            <nav className="overflow-hidden rounded-md border border-slate-200 bg-white">
              {tree.map((node) => {
                const isSelected = node.id === selectedId;
                return (
                  <Link
                    key={node.id}
                    href={`/admin?unit=${node.id}`}
                    scroll={false}
                    className={`flex items-center gap-2 border-b border-slate-100 px-3 py-2.5 text-sm transition-colors last:border-b-0 ${
                      isSelected ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'
                    }`}
                    style={{ paddingLeft: 12 + node.depth * 16 }}
                  >
                    <span className="truncate">{node.name}</span>
                    <span
                      className={`ml-auto shrink-0 text-[11px] tabular-nums ${
                        isSelected ? 'text-slate-300' : 'text-slate-400'
                      }`}
                    >
                      {node.totalSoldiers > 0 && `${node.totalSoldiers} sold.`}
                      {node.leaders > 0 && ` · ${node.leaders} bef.`}
                    </span>
                  </Link>
                );
              })}
            </nav>
          </section>

          {/* ── Vald enhet ── */}
          <section>
            {selected ? (
              <UnitDetail
                unit={{
                  id: selected.id,
                  name: selected.name,
                  kind: selected.kind,
                  kindLabel: KIND_LABEL[selected.kind as keyof typeof KIND_LABEL],
                }}
                members={members}
                currentUserId={session.id}
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
