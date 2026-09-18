# FM – PSVI

Personligt stridsvärdeindex: en prototyp där en värnpliktig rapporterar sitt
mående en gång om dagen, och befäl ser lägets utveckling för sin enhet —
aldrig för en enskild person.

Sex frågor på skalan 1–10 (fysisk form, psykiskt mående, social trivsel, sömn,
kost, energi). Den värnpliktige ser sina egna siffror och får råd. Befäl ser
snitt, trender och jämförelser mellan sina underenheter, med en tröskel som
gör enskilda svar omöjliga att räkna ut.

> **Prototyp, inte en produkt.** Demodatan är påhittad och inloggningskoderna
> står på inloggningssidan. Här finns inga verkliga personer och inga verkliga
> hälsouppgifter.

## Reglerna som styr koden

Tre regler förklarar det mesta av utformningen. Bryts de är det inte en
smaksak, utan en defekt:

1. **Hälsodata aggregeras i databasen, inte i servern.** Enskilda rader lämnar
   aldrig databasen till någon annan än den som själv skrivit dem
   (`src/lib/db/queries/checkins.ts`). Filtreras de bort redan i frågan kan de
   inte läcka genom en loggrad, ett felmeddelande eller en RSC-payload.
2. **K-anonymiteten ligger i SELECT-satsen.** Servern skickar `null`, inte ett
   värde som gränssnittet låter bli att rita. Tröskeln är fyra svarande *och*
   fyra medlemmar (`src/lib/privacy.ts`).
3. **Enheten kommer ur sessionen, aldrig ur adressfältet.** Ett befäl kan inte
   byta ett id i URL:en och läsa en annan plutons data — angreppsytan finns
   inte (`src/components/leader/LeaderPageShell.tsx`).

Dessutom: `proxy.ts` är en bekvämlighet, inte ett skydd. Varje verklig
kontroll står intill datan, i `requireRole()` överst i varje sida och varje
server action. Ett test underkänner varje ny sida som saknar den
(`tests/skydd.test.mjs`).

## Komma igång

Kräver Node 24 eller senare.

```bash
npm install
cp .env.example .env          # och fyll i AUTH_PEPPER, se nedan
npm run db:setup              # migrationer + demodata
npm run dev                   # http://localhost:3000
```

`npm run db:setup` skriver ut demokoderna i terminalen. De står också på
inloggningssidan när `PSVI_ENVIRONMENT=demo`.

Utelåst som administratör? `npm run aterstall-admin` ger en ny adminkod.

## Miljövariabler

| Variabel | Krävs | Betydelse |
|---|---|---|
| `AUTH_PEPPER` | ja i produktion | Hemlig nyckel som blandas in i kodhasharna. Minst 32 tecken: `openssl rand -hex 32`. Byts den fungerar inga befintliga koder. |
| `DATABASE_URL` | mot fjärrdatabas | `libsql://…` för Turso. Utelämnas den används en lokal fil. |
| `DATABASE_AUTH_TOKEN` | mot fjärrdatabas | Token till Turso. |
| `DATABASE_PATH` | nej | Sökväg till den lokala filen. Standard `./data/psvi.db`. |
| `PSVI_ENVIRONMENT` | ja | `demo` eller `pilot`. I `demo` visas demokoderna, och de fem publicerade kontona skyddas mot att förstöras. |
| `SEED_DEMO_DATA` | nej | `true` skapar demoorganisationen. Servern vägrar starta med `true` i skarp drift. |
| `RETENTION_DAYS` | nej | Antal dagar hälsodata sparas. **Tom = ingen gallring.** Ska beslutas av dataskyddsombud före skarp drift. |
| `MIN_RESPONDERS` | nej | Tröskeln för k-anonymitet. Standard 4, går inte att sätta under 3. |

## Kommandon

```bash
npm run dev                        # utvecklingsserver
npm run build && npm start         # skarpt bygge
npm test                           # 98 tester, Nodes egen testkörare
npm run typecheck                  # tsc --noEmit
npx eslint src tests scripts       # lint
npm run rundtur                    # klickar igenom appen som alla fem demokonton
npm run db:setup                   # migrationer och seed
npm run demo:uppdatera -- --utfor  # flyttar demodatan så historiken slutar idag
```

**`npm run rundtur`** startar en webbläsare, loggar in som varje demokonto,
öppnar varje sida och flik, och larmar om något går sönder — en tom vy, ett fel
i webbläsaren, en enskild persons benämning i en befälsvy. Kör den före varje
uppvisning. Mot en annan adress: `npm run rundtur -- http://localhost:3000`.

## Så hänger koden ihop

```
src/app/            sidor (alla force-dynamic) och server actions
  actions/          allt som skriver — varje funktion börjar med requireRole()
  api/export/       CSV för befäl: aggregat, och bara den egna enheten
  api/halsa/        öppen hälsokontroll: lever appen och databasen?
src/components/     gränssnitt; leader/ är gemensamt för alla tre befälsnivåer
src/lib/
  auth/             koder (HMAC med peppar), sessioner, spärr mot gissning
  db/queries/       all SQL. admin.ts rör aldrig check_ins
  db/schema.ts      tabellerna. Migrationer i drizzle/
  privacy.ts        k-anonymitetens tröskel och de tillåtna perioderna
tests/              98 tester mot en riktig databas byggd ur migrationerna
scripts/            engångs- och driftskommandon
```

Tre befälsnivåer delar en enda vy: `/pluton`, `/kompani` och `/bataljon` är
tunna skal runt samma komponent, och samma rekursiva fråga svarar oavsett nivå
i organisationen.

## Databasen

SQLite via libSQL — en lokal fil vid utveckling, Turso i drift. Schemat ändras
i `src/lib/db/schema.ts`, därefter:

```bash
npx drizzle-kit generate     # skapar migrationen i drizzle/
npm run db:setup             # kör den lokalt
```

Mot en delad databas körs migrationer **inte** vid serverstart. Det är ett
medvetet val: schemat ska ändras som ett beslut, inte som en bieffekt av att
en funktion råkade kallstarta. Kör `npm run db:setup` med rätt `DATABASE_URL`
före driftsättning.

## Drift

Vercel bygger och driftsätter grenen `v2-produktion` automatiskt. Vid varje
push kör GitHub typkontroll, lint, tester och bygge
(`.github/workflows/kontroll.yml`), och var femtonde minut frågar en vaktpost
om appen lever (`vakt.yml`). Fel som servern fångar hamnar i appens egen
databas och visas för administratören på `/status` — ingenting skickas till
någon utomstående tjänst.

## Vad som återstår

De viktigaste kvarvarande punkterna: tillgänglighet (WCAG 2.1 AA är ett
lagkrav för offentlig verksamhet), automatiska tester för gränssnittet,
prestanda vid verklig storlek — demon har 216 värnpliktiga, ett förband har
tusentals — och ett beslut om `RETENTION_DAYS`.
