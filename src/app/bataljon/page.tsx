import LeaderPageShell from '@/components/leader/LeaderPageShell';

export const dynamic = 'force-dynamic';

export default async function BataljonPage(props: {
  searchParams: Promise<{ period?: string }>;
}) {
  return (
    <LeaderPageShell
      role="bataljon"
      levelLabel="Bataljonsnivå"
      childLabel="kompanier"
      searchParams={props.searchParams}
    />
  );
}
