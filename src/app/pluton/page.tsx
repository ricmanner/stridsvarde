import LeaderPageShell from '@/components/leader/LeaderPageShell';

export const dynamic = 'force-dynamic';

export default async function PlutonPage(props: {
  searchParams: Promise<{ period?: string }>;
}) {
  return (
    <LeaderPageShell
      role="pluton"
      levelLabel="Plutonsnivå"
      childLabel="grupper"
      searchParams={props.searchParams}
    />
  );
}
