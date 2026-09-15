import AppHeader from '@/components/AppHeader';
import NotificationBanner from '@/components/NotificationBanner';
import { requireRole } from '@/lib/auth/guard';

import KompaniDashboard from './KompaniClient';

export const dynamic = 'force-dynamic';

export default async function KompaniPage() {
  const session = await requireRole('kompani');

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader unit={session.unitName} label={session.label} role={session.role} />
      <NotificationBanner userId={session.id} />
      <KompaniDashboard unit={session.unitName} />
    </div>
  );
}
