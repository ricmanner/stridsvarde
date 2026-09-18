import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';

import { getSessionUser } from '@/lib/auth/session';
import { homeFor } from '@/lib/roles';

export const dynamic = 'force-dynamic';

export default async function IngenBehorighetPage() {
  const user = await getSessionUser();

  return (
    <main id="innehall" className="flex min-h-dvh items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm text-center">
        <ShieldAlert size={36} className="mx-auto text-slate-300" strokeWidth={1.5} aria-hidden />
        <h1 className="mt-5 text-xl font-bold text-slate-900">Ingen behörighet</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">
          Din roll har inte tillgång till den här sidan. Om du tror att det är fel,
          kontakta ditt befäl.
        </p>

        <Link
          href={user ? homeFor(user.role) : '/'}
          className="mt-7 inline-block rounded-md bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
        >
          {user ? 'Till min startsida' : 'Till inloggningen'}
        </Link>
      </div>
    </main>
  );
}
