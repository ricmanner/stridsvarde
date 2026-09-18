@AGENTS.md

# FM – PSVI

Prototyp där värnpliktiga rapporterar sitt mående dagligen och befäl ser
utvecklingen för sin enhet — aldrig för en enskild person. Läs `README.md`
först; den beskriver arkitektur, kommandon och miljövariabler.

## Gränser som inte får överskridas

- **Rör aldrig grenarna `main` eller `pilot`.** `main` är prototypen från i
  våras och bygger den gamla demon på Netlify; `pilot` utvecklas separat. Allt
  arbete sker på `v2-produktion`.
- **Hälsodata aggregeras i SQL, aldrig i servern.** Enskilda incheckningar
  lämnar databasen bara till den som själv skrivit dem
  (`src/lib/db/queries/checkins.ts`). `queries/admin.ts` rör aldrig
  `check_ins`.
- **K-anonymiteten ligger i SELECT-satsen**, inte i gränssnittet
  (`src/lib/privacy.ts`). Servern skickar `null` — aldrig ett värde som vyn
  sedan låter bli att rita.
- **Enheten kommer ur sessionen, aldrig ur adressfältet**
  (`src/components/leader/LeaderPageShell.tsx`).
- **Demons fem publicerade konton** (`src/lib/demo.ts`) får inte spärras,
  raderas, få ny kod eller få sin historik nollad i demoläge. Koderna står på
  inloggningssidan, så vem som helst kan logga in som administratör.

## Arbetssätt

- **Varje rättning ska ha ett test som först faller mot den gamla koden.**
  Kör testet, se det falla, rätta, se det passera. Ett test som aldrig varit
  rött bevisar ingenting.
- **Mät innan du optimerar.** Två av tre farhågor i den senaste genomgången
  var fel, och en "förbättring" visade sig vara 2,4 gånger långsammare.
- **Skriv kommentarer som förklarar varför**, särskilt när en lösning ser
  omständlig ut. Koden är full av sådana — de finns där för att spara nästa
  person felsökningstid.
- Svenska i kod, kommentarer, gränssnitt och tester. Engelska i commit-texter.

## Regler som kostat tid att lära sig

- **Ett tal och dess färg får aldrig säga emot varandra.** Aggregaten räknas
  med full precision; `roundScore()` i `lib/data.ts` avrundar en gång, och
  `getStatus()` bedömer det avrundade talet. Avrundas det två gånger visas
  6,25 som 6,3, och ett snitt strax under 4 kan få rött märke intill en fyra.
- **Statusfärgerna finns i två uppsättningar.** `statusColor()` för ytor
  (prickar, staplar, band) som behöver 3:1, `statusTextColor()` för text som
  behöver 4,5:1. Använd fel och sidan underkänns av axe.
- **Grönt, gult och rött betyder status — aldrig kategori.** Kategorier ritas
  i neutralt bläck eller blå accent (`components/charts/chart-theme.ts`).
- **Radering av hälsodata sker i samma transaktion som raderingen av kontot
  eller enheten.** Kontrollerna körs före. Avbryts något däremellan ska inget
  vara borta.
- **Utfärdade koder visas exakt en gång.** Logiken för kodlappen ligger i
  `lib/kodlapp.ts` och jämför koderna, inte deras längd. Ett fel här låser ute
  en värnpliktig permanent.
- **Mät innan du optimerar.** Två av tre farhågor i genomgången var fel, och
  en "förbättring" av befälsöversikten var 2,4 gånger långsammare.

## Fallgropar i webbläsartesterna (e2e/)

- Enhetsnamn måste vara unika inom föräldern, och databasen lever kvar mellan
  körningar — använd `Date.now().toString(36)` i namnet.
- Klick i enhetsträdet ritar om högra spalten. Vänta på `unit=`-adressen och
  på rubriken innan du skriver i ett fält, annars försvinner texten.
- Formulären fungerar innan sidan blivit interaktiv, men då visas inget
  bekräftelsemeddelande. Kontrollera resultatet, inte meddelandet.
- Byt aldrig kod på demons värnpliktiga i ett test: deras inloggning slutar
  fungera för alla andra tester. Skapa egna personer.

## Innan något driftsätts

```bash
npm test && npm run typecheck && npx eslint src tests scripts && npm run build
npm run e2e         # 20 tester i webbläsare, inklusive tillgänglighet (axe)
npm run rundtur     # klickar igenom appen som alla fem demokonton
```

En push till `v2-produktion` driftsätts automatiskt av Vercel. GitHub kör
samma kontroller, men först efter pushen — så kör dem själv innan.

## Databasen

Schemat ändras i `src/lib/db/schema.ts`, sedan `npx drizzle-kit generate` och
`npm run db:setup`. Mot den delade databasen körs migrationer **inte** vid
serverstart: administratören uppdaterar schemat från `/status`. Läggs en
migration till måste `SCHEMA_DDL` i `src/lib/db/queries/health.ts` följa med —
ett test jämför dem.
