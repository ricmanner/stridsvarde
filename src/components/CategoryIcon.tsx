import { Activity, Brain, Moon, Users, Utensils, Zap } from 'lucide-react';

/**
 * Ikonen för en kategori, på ett ställe.
 *
 * Samma karta låg i tre kopior — i incheckningen, i återkopplingen och i
 * befälsvyn — med olika storlek som enda skillnad. En ny kategori i
 * CATEGORIES hade behövt läggas till på alla tre, och den som glömde en fick
 * ett tomt hål i just den vyn.
 */
const IKONER = { Activity, Brain, Users, Moon, Utensils, Zap } as const;

export default function CategoryIcon({
  namn,
  size = 16,
}: {
  /** `icon`-fältet från CATEGORIES i lib/data.ts. */
  namn: string;
  size?: number;
}) {
  const Ikon = IKONER[namn as keyof typeof IKONER];
  if (!Ikon) return null;
  return <Ikon size={size} strokeWidth={1.5} aria-hidden />;
}
