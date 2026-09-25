import LeaderPageShell from '@/components/leader/LeaderPageShell';
import { nivåRubrik } from '@/lib/unit-names';

export const dynamic = 'force-dynamic';

export default async function PlutonPage(props: {
  searchParams: Promise<{ period?: string }>;
}) {
  return (
    <LeaderPageShell
      role="pluton"
      levelLabel={nivåRubrik('pluton')}
      childLabel="grupper"
      searchParams={props.searchParams}
    />
  );
}
