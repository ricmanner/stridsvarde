import AppHeader from '@/components/AppHeader';
import NotificationBanner from '@/components/NotificationBanner';
import { requireRole } from '@/lib/auth/guard';

import PlutonDashboard from './PlutonClient';

export const dynamic = 'force-dynamic';

export default async function PlutonPage() {
  // Kontrolleras på servern. Att skriva /pluton i adressfältet som soldat
  // räcker inte längre — sidan renderas aldrig.
  const session = await requireRole('pluton');

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader unit={session.unitName} label={session.label} role={session.role} />
      <NotificationBanner userId={session.id} />
      <PlutonDashboard unit={session.unitName} />
    </div>
  );
}
