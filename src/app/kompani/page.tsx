import LeaderPageShell from '@/components/leader/LeaderPageShell';
import { nivåRubrik } from '@/lib/unit-names';

export const dynamic = 'force-dynamic';

export default async function KompaniPage(props: {
  searchParams: Promise<{ period?: string }>;
}) {
  return (
    <LeaderPageShell
      role="kompani"
      levelLabel={nivåRubrik('kompani')}
      childLabel="plutoner"
      childKind="pluton"
      searchParams={props.searchParams}
    />
  );
}
