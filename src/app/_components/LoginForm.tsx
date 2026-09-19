'use client';

import { useActionState } from 'react';
import { AlertCircle } from 'lucide-react';

import { loginAction, type LoginState } from '@/app/actions/auth';

export default function LoginForm({ expired, aterstalld }: { expired: boolean; aterstalld?: boolean }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, {});

  return (
    <form action={action}>
      {aterstalld && !state.error && (
        <div className="mb-5 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3">
          <p className="text-sm text-emerald-800">
            Demon är återställd. Logga in igen med en av koderna nedan.
          </p>
        </div>
      )}

      {expired && !aterstalld && !state.error && (
        <div className="mb-5 rounded-md border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm text-amber-800">
            Din session har gått ut. Logga in igen.
          </p>
        </div>
      )}

      <div className="mb-6">
        <label
          htmlFor="code"
          className="mb-2 block text-etikett font-bold uppercase tracking-[0.08em] text-slate-600"
        >
          Inloggningskod
        </label>
        <input
          id="code"
          name="code"
          className="code-input w-full rounded-md border-[1.5px] border-slate-200 bg-white px-4 py-3.5 text-slate-900 outline-none focus:border-slate-900"
          type="text"
          placeholder="ABCDE-FGHJK"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="characters"
          spellCheck={false}
          required
          aria-describedby={state.error ? 'code-error' : undefined}
          aria-invalid={Boolean(state.error)}
        />

        {state.error && (
          <div
            id="code-error"
            role="alert"
            className="mt-2 flex items-center gap-1.5 text-sm text-red-700"
          >
            <AlertCircle size={14} aria-hidden />
            <span>{state.error}</span>
          </div>
        )}
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-slate-900 px-4 py-3.5 text-sm font-semibold tracking-wide text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        {pending ? 'Loggar in…' : 'Logga in'}
      </button>
    </form>
  );
}
