/**
 * Visas medan en sida hämtas.
 *
 * Appen hade ingen laddningsvy alls. Byter ett befäl period räknas aggregaten
 * om över hela underenhetsträdet, och under tiden stod den gamla sidan kvar
 * oförändrad — samma siffror, samma period markerad. Den rimliga slutsatsen
 * är att klicket inte tog, så man klickar igen, och varje klick startar en ny
 * omräkning som gör väntan längre.
 *
 * `role="status"` och inte `role="alert"`: det här är ingen larmsituation
 * utan ett lugnt besked, och en skärmläsare ska läsa upp det när den är klar
 * med det den håller på med. Rollen har underförstått `aria-live="polite"`.
 *
 * Snurran stannar för den som bett systemet om mindre rörelse — texten säger
 * ändå vad som händer, så ingen information går förlorad.
 */
export default function Laddar({ text = 'Hämtar…' }: { text?: string }) {
  return (
    <div
      role="status"
      className="flex min-h-[60dvh] flex-col items-center justify-center gap-3 px-6 text-center"
    >
      <span
        aria-hidden
        className="size-6 rounded-full border-[2.5px] border-slate-200 border-t-slate-900 motion-safe:animate-spin"
      />
      <p className="text-sm text-slate-500">{text}</p>
    </div>
  );
}
