import AppHeader from '@/components/AppHeader';
import NotificationBanner from '@/components/NotificationBanner';
import { requireRole } from '@/lib/auth/guard';

import BataljonDashboard from './BataljonClient';

export const dynamic = 'force-dynamic';

export default async function BataljonPage() {
  const session = await requireRole('bataljon');

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader unit={session.unitName} label={session.label} role={session.role} />
      <NotificationBanner userId={session.id} />
      <BataljonDashboard unit={session.unitName} />
    </div>
  );
}
