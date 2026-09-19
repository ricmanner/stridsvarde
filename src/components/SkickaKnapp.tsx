'use client';

import { useFormStatus } from 'react-dom';

/**
 * Skicka-knapp som spärrar sig själv och säger till medan den arbetar.
 *
 * För formulär som går rakt till en Server Action utan useActionState — de
 * har inget `pending` att läsa, och knapparna på statussidan stod därför helt
 * utan svar. Den som tryckte visste inte om det tagit, och en av dem bygger om
 * hela demon.
 *
 * useFormStatus läser tillståndet från formuläret ovanför, och kräver därför
 * att knappen är en egen komponent — det är hela skälet till att den här
 * filen finns.
 */
export default function SkickaKnapp({
  children,
  vantetext,
  className,
}: {
  children: React.ReactNode;
  /** Vad knappen säger medan den arbetar. */
  vantetext: string;
  className?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? vantetext : children}
    </button>
  );
}
