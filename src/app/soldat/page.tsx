import { redirect } from 'next/navigation';

import AppHeader from '@/components/AppHeader';
import { requireRole } from '@/lib/auth/guard';
import type { Category } from '@/lib/data';
import { longDateLabel, serviceDate } from '@/lib/date';
import { getTodayCheckIn } from '@/lib/db/queries/checkins';

import SoldatCheckin from './CheckinWizard';

export const dynamic = 'force-dynamic';

export default async function SoldatPage({
  searchParams,
}: {
  searchParams: Promise<{ redigera?: string }>;
}) {
  const session = await requireRole('soldat');
  const { redigera } = await searchParams;

  // Kontrolleras mot databasen, inte mot webbläsarens localStorage — och mot
  // svenskt datum, så att en incheckning kl 23:30 hamnar på rätt dag.
  const today = await getTodayCheckIn(session.id);

  // Har man redan rapporterat skickas man vidare, om man inte uttryckligen
  // valt att korrigera. Databasen gör en upsert på (soldat, dag), så en
  // korrigering skriver över dagens svar i stället för att lägga till ett nytt.
  const editing = Boolean(today) && redigera === '1';
  if (today && !editing) redirect('/soldat/dashboard');

  const initial: Record<Category, number> | undefined = today
    ? {
        fysisk: today.fysisk,
        psykisk: today.psykisk,
        social: today.social,
        somn: today.somn,
        kost: today.kost,
        energi: today.energi,
      }
    : undefined;

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader unit={session.unitName} label={session.label} role={session.role} />
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col">
        <SoldatCheckin
          initial={initial}
          editing={editing}
          dateLabel={longDateLabel(serviceDate())}
        />
      </div>
    </div>
  );
}
