import { redirect } from 'next/navigation';

import AppHeader from '@/components/AppHeader';
import { requireRole } from '@/lib/auth/guard';
import { getTodayCheckIn } from '@/lib/db/queries/checkins';

import SoldatCheckin from './CheckinWizard';

export const dynamic = 'force-dynamic';

export default async function SoldatPage() {
  const session = await requireRole('soldat');

  // Kontrolleras mot databasen, inte mot webbläsarens localStorage — och mot
  // svenskt datum, så att en incheckning kl 23:30 hamnar på rätt dag.
  const today = await getTodayCheckIn(session.id);
  if (today) redirect('/soldat/dashboard');

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader unit={session.unitName} label={session.label} role={session.role} />
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col">
        <SoldatCheckin />
      </div>
    </div>
  );
}
