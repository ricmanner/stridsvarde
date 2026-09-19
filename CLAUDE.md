@AGENTS.md

# FM – PSVI

Prototyp där värnpliktiga rapporterar sitt mående dagligen och befäl ser
utvecklingen för sin enhet — aldrig för en enskild person.

Läs `README.md` för arkitektur, kommandon och miljövariabler, och
`NÄSTA-STEG.md` för var arbetet står just nu och vad som redan visat sig vara
en återvändsgränd.

## Så vill Richard arbeta

Han är **inte teknisk**. Förklara på enkel svenska: vad något betyder, vad det
får för följd, och vad valet står mellan. Undvik facktermer, eller förklara dem
på en rad. Han läser gärna siffror och tabeller.

- **Planera före större ändringar.** Lägg fram förslaget och vänta på ja.
- **Committa efter varje steg**, inte allt på slutet.
- **Visa resultatet innan du pushar, och pusha först när han sagt till.**
  Han säger "pusha" när han vill ha ut det.
- **Verifiera på riktigt, inte bara med tester.** Starta appen, klicka igenom
  det du ändrat, och visa vad du såg. Flera fel i den här kodbasen har bara
  visat sig vid en verklig körning.
- **Vid design- eller avvägningsfrågor: lägg fram alternativ med för och emot,
  och en rekommendation.** Besluta inte åt honom.
- **Ta emot invändningar.** Han har flera gånger haft rätt mot ett förslag —
  backa då hellre än att försvara det.
- **Föreslå inte det som redan är gjort.** Läs `NÄSTA-STEG.md` först.

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

## Typskalan

Sex storlekar, definierade i `src/app/globals.css`. Fem är Tailwinds egna;
`text-etikett` (11 px) är den enda egna, för de versala småetiketterna —
Tailwind har ingenting under 12. Skriv aldrig `text-[Npx]`: det var så det
blev femton storlekar, varav två skrevs på vardera två sätt.

Två storlekar står utanför med flit och ska inte återanvändas: 36 px i
utskriftsrapporten och 64 px på incheckningens siffra.

## Fallgropar i webbläsartesterna (e2e/)

- Enhetsnamn måste vara unika inom föräldern, och databasen lever kvar mellan
  körningar — använd `Date.now().toString(36)` i namnet.
- Klick i enhetsträdet ritar om högra spalten. Vänta på `unit=`-adressen och
  på rubriken innan du skriver i ett fält, annars försvinner texten.
- Formulären fungerar innan sidan blivit interaktiv, men då visas inget
  bekräftelsemeddelande. Kontrollera resultatet, inte meddelandet.
- Byt aldrig kod på demons värnpliktiga i ett test: deras inloggning slutar
  fungera för alla andra tester. Skapa egna personer.
- `getByRole('alert')` träffar två element: ditt eget och Next egen tomma
  ruta för sidbyten. Leta efter texten i stället.

## Innan något driftsätts

```bash
npm test && npm run typecheck && npx eslint src tests scripts && npm run build
npm run e2e         # 20 tester i webbläsare, inklusive tillgänglighet (axe)
npm run rundtur     # klickar igenom appen som alla fem demokonton
```

### Driftsättning

Allt arbete sker på **`v2-produktion`**. En push dit driftsätts automatiskt av
Vercel till <https://fm-psvi-v2.vercel.app> — ett bygge tar ungefär 30–60
sekunder. GitHub kör samma kontroller, men först efter pushen, så kör dem
själv innan.

Kontrollera att rätt version ligger uppe med:

```bash
vercel ls --meta githubCommitSha=$(git rev-parse HEAD)
```

Gissa aldrig genom att hämta en sida och leta efter text — se
återvändsgränderna i `NÄSTA-STEG.md`. Avsluta med `npm run rundtur`, som går
mot den driftsatta demon som standard.

## Databasen

Schemat ändras i `src/lib/db/schema.ts`, sedan `npx drizzle-kit generate` och
`npm run db:setup`. Mot den delade databasen körs migrationer **inte** vid
serverstart: administratören uppdaterar schemat från `/status`. Läggs en
migration till måste `SCHEMA_DDL` i `src/lib/db/queries/health.ts` följa med —
ett test jämför dem.
