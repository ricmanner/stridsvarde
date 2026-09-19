import { BellRing, X } from 'lucide-react';

import { dismissNotificationAction } from '@/app/actions/support';
import { getUnreadNotifications } from '@/lib/db/queries/notifications';

/**
 * Visar olästa notiser för ett befäl.
 *
 * Den enda notistypen som nämner en enskild soldat är den soldaten själv
 * begärt. Alla andra larm ligger på enhetsnivå.
 */
export default async function NotificationBanner({ userId }: { userId: number }) {
  const items = await getUnreadNotifications(userId);
  if (items.length === 0) return null;

  return (
    // data-notiser: rundturens integritetskontroll hoppar över den här rutan.
    // En samtalsbegäran SKA nämna den som bett om samtalet — det är hela
    // poängen — medan samma namn i en aggregerad vy vore ett läckage.
    <div data-notiser className="no-print border-b border-amber-200 bg-amber-50 px-4 py-3 sm:px-6">
      <ul className="mx-auto flex max-w-5xl flex-col gap-2">
        {items.map((n) => (
          <li key={n.id} className="flex items-start gap-3">
            <BellRing size={15} className="mt-0.5 shrink-0 text-amber-700" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-amber-900">{n.title}</p>
              <p className="text-sm leading-relaxed text-amber-800">{n.body}</p>
            </div>
            <form action={dismissNotificationAction}>
              <input type="hidden" name="id" value={n.id} />
              <button
                type="submit"
                className="shrink-0 cursor-pointer rounded p-1 text-amber-700 transition-colors hover:bg-amber-100"
                aria-label="Kvittera notis"
              >
                <X size={15} aria-hidden />
              </button>
            </form>
          </li>
        ))}
      </ul>
    </div>
  );
}
