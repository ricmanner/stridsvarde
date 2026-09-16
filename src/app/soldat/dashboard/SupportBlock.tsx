'use client';

import { useActionState } from 'react';
import { Check, LifeBuoy, Phone } from 'lucide-react';

import { requestTalkAction, type TalkState } from '@/app/actions/support';
import { NATIONAL_CONTACTS, UNIT_CONTACTS } from '@/lib/support';

/**
 * Visas när soldaten har minst ett rött värde.
 *
 * Systemet larmar aldrig självt om en enskild individ — befälsvyerna visar
 * bara aggregat. Det betyder att någon som mår riktigt dåligt annars inte
 * syns för någon som kan hjälpa. Den här knappen är den vägen, och det är
 * soldaten själv som öppnar den.
 */
export default function SupportBlock() {
  const [state, formAction, pending] = useActionState<TalkState, FormData>(
    requestTalkAction,
    {},
  );

  const contacts = [...UNIT_CONTACTS, ...NATIONAL_CONTACTS];

  return (
    <div className="mb-4 rounded-md border border-slate-300 bg-white p-5">
      <div className="mb-3 flex items-center gap-2">
        <LifeBuoy size={16} className="text-slate-700" aria-hidden />
        <h2 className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-700">
          Du behöver inte lösa det här själv
        </h2>
      </div>

      <p className="mb-4 text-sm leading-relaxed text-slate-600">
        Några av dina värden är låga. Det är vanligare än du tror, och det finns
        folk vars uppgift det är att hjälpa till.
      </p>

      {/* Kontaktvägar som fungerar utan att gå via appen alls. */}
      <ul className="mb-5 divide-y divide-slate-100 rounded border border-slate-200">
        {contacts.map((c) => (
          <li key={c.name} className="flex items-center justify-between gap-3 px-3 py-2.5">
            <div className="min-w-0">
              <p
                className={`text-sm ${c.urgent ? 'font-semibold text-slate-900' : 'text-slate-700'}`}
              >
                {c.name}
              </p>
              <p className="text-xs text-slate-500">{c.detail}</p>
            </div>
            {c.phone && (
              <a
                href={`tel:${c.phone.replace(/\s/g, '')}`}
                className="flex shrink-0 items-center gap-1.5 rounded bg-slate-100 px-2.5 py-1.5 font-mono text-sm text-slate-900 transition-colors hover:bg-slate-200"
              >
                <Phone size={12} aria-hidden />
                {c.phone}
              </a>
            )}
          </li>
        ))}
      </ul>

      {state.sent ? (
        <div className="flex items-start gap-2 rounded border border-emerald-200 bg-emerald-50 px-3 py-3">
          <Check size={15} className="mt-0.5 shrink-0 text-emerald-700" aria-hidden />
          <p className="text-sm text-emerald-800">
            Ditt befäl har fått veta att du vill prata. Dina svar i appen har{' '}
            <strong>inte</strong> delats — bara att du sökt kontakt.
          </p>
        </div>
      ) : (
        <form action={formAction}>
          <p className="mb-2 text-xs text-slate-500">
            Vill du hellre att någon hör av sig till dig? Välj vem:
          </p>

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="submit"
              name="level"
              value="pluton"
              disabled={pending}
              className="flex-1 rounded-md bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:bg-slate-300"
            >
              {pending ? 'Skickar…' : 'Mitt plutonsbefäl'}
            </button>
            <button
              type="submit"
              name="level"
              value="kompani"
              disabled={pending}
              className="flex-1 rounded-md border-[1.5px] border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-900 disabled:opacity-50"
            >
              Kompanichefen
            </button>
          </div>

          <p className="mt-2.5 text-xs leading-relaxed text-slate-500">
            Befälet får bara veta att du vill prata — aldrig vad du svarat.
          </p>

          {state.error && (
            <p role="alert" className="mt-2 text-sm text-red-600">
              {state.error}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
