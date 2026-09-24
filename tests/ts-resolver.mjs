/**
 * Gör appens TypeScript-moduler importerbara i tester.
 *
 * TypeScript tillåter importer utan filändelse (`'../../data'`) och
 * alias (`'@/lib/...'`). Node kräver fullständiga sökvägar. Den här
 * resolvern översätter mellan dem.
 *
 * Poängen är att testerna ska köra EXAKT samma kod som appen. Alternativet
 * vore att kopiera in SQL-frågorna i testet, och då testar man en kopia som
 * kan glida isär från verkligheten — vilket är precis det man ville undvika.
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const SRC = path.resolve(import.meta.dirname, '..', 'src');

/** Prövar .ts, .tsx och /index.ts för en sökväg utan ändelse. */
function resolveFile(base) {
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts')]) {
    if (existsSync(candidate) && !existsSync(path.join(candidate, '.'))) {
      if (candidate.endsWith('.ts') || candidate.endsWith('.tsx')) return candidate;
    }
    if (existsSync(candidate) && candidate.endsWith('.ts')) return candidate;
  }
  for (const candidate of [`${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts')]) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

export async function resolve(specifier, context, next) {
  /*
   * 'server-only' kastar avsiktligt när den importeras utanför en
   * serverkomponent. Next.js byter ut den mot en tom modul i serverbygget;
   * testerna kör samma kod och måste göra likadant, annars går ingen
   * serverkodsmodul att importera alls.
   */
  if (specifier === 'server-only' || specifier === 'client-only') {
    const empty = path.join(SRC, '..', 'node_modules', specifier, 'empty.js');
    if (existsSync(empty)) return { url: pathToFileURL(empty).href, shortCircuit: true };
  }

  /*
   * next/headers finns bara inne i en förfrågan. Testerna kör koden utanför
   * en, så modulen byts mot en attrapp — annars går ingen modul som läser
   * rubriker eller kakor att importera alls.
   */
  if (specifier === 'next/headers') {
    const stub = path.join(SRC, '..', 'tests', 'attrapper', 'next-headers.mjs');
    if (existsSync(stub)) return { url: pathToFileURL(stub).href, shortCircuit: true };
  }

  /*
   * next/server går inte att importera på namn utanför Next: paketets
   * exports-karta pekar bara ut modulen för ramverkets egen laddare, och en
   * vanlig `import 'next/server'` svarar "hittar inte modulen". Filen finns i
   * paketet, så testerna pekar rakt på den.
   *
   * Utan det här går proxy.ts inte att pröva alls — och proxyn är den som
   * avgör om ett anrop över huvud taget når fram till sin rutt. Byter Next
   * sökväg vid en uppgradering faller testet med ett begripligt fel.
   */
  if (specifier === 'next/server') {
    const fil = path.join(SRC, '..', 'node_modules', 'next', 'dist', 'server', 'web', 'exports', 'index.js');
    if (existsSync(fil)) return { url: pathToFileURL(fil).href, shortCircuit: true };
  }

  // '@/lib/x' → <projekt>/src/lib/x
  if (specifier.startsWith('@/')) {
    const file = resolveFile(path.join(SRC, specifier.slice(2)));
    if (file) return { url: pathToFileURL(file).href, shortCircuit: true };
  }

  // Relativa importer utan filändelse
  if (specifier.startsWith('.') && context.parentURL?.startsWith('file:')) {
    const parentDir = path.dirname(new URL(context.parentURL).pathname);
    const file = resolveFile(path.resolve(parentDir, specifier));
    if (file) return { url: pathToFileURL(file).href, shortCircuit: true };
  }

  return next(specifier, context);
}
