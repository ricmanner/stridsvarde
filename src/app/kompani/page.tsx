import LeaderPageShell from '@/components/leader/LeaderPageShell';

export const dynamic = 'force-dynamic';

export default async function KompaniPage(props: {
  searchParams: Promise<{ period?: string }>;
}) {
  return (
    <LeaderPageShell
      role="kompani"
      levelLabel="Kompaninivå"
      childLabel="plutoner"
      searchParams={props.searchParams}
    />
  );
}
