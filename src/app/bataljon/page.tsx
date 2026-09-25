import LeaderPageShell from '@/components/leader/LeaderPageShell';
import { nivåRubrik } from '@/lib/unit-names';

export const dynamic = 'force-dynamic';

export default async function BataljonPage(props: {
  searchParams: Promise<{ period?: string }>;
}) {
  return (
    <LeaderPageShell
      role="bataljon"
      levelLabel={nivåRubrik('bataljon')}
      childLabel="kompanier"
      childKind="kompani"
      searchParams={props.searchParams}
    />
  );
}
