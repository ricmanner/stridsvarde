@AGENTS.md

# FM – PSVI

Prototyp där värnpliktiga rapporterar sitt mående dagligen och befäl ser
utvecklingen för sin enhet — aldrig för en enskild person.

Läs `README.md` för arkitektur, kommandon och miljövariabler, och
`NÄSTA-STEG.md` för var arbetet står just nu och vad som redan visat sig vara
en återvändsgränd.

**Gren: `v2-produktion`. Allt arbete sker här, i den här mappen
(`~/Code/stridsvarde-v2`), som är ett eget förråd.** En push dit driftsätts av
Vercel till <https://fm-psvi-v2.vercel.app> på 30–60 sekunder. Startas en
session i någon annan mapp går pushen inte igenom — se Driftsättning nedan.

## Så vill Richard arbeta

Han är **inte teknisk**. Förklara på enkel svenska: vad något betyder, vad det
får för följd, och vad valet står mellan. Undvik facktermer, eller förklara dem
på en rad. Han läser gärna siffror och tabeller.

Det glider lättast iväg när något gått sönder. **Börja då med vad det betyder
för honom** — är appen trasig, märker användarna något, är det åtgärdat — och
håll mekanismen till ett par meningar efteråt. Detaljerna hör hemma i
commit-texten, som skrivs för nästa utvecklare.

- **Planera före större ändringar.** Lägg fram förslaget och vänta på ja.
- **Committa efter varje steg**, inte allt på slutet.
- **Visa resultatet innan du pushar, och pusha först när han sagt till.**
  Han säger "pusha" när han vill ha ut det.
- **Verifiera på riktigt, inte bara med tester.** Starta appen, klicka igenom
  det du ändrat, och visa vad du såg. Flera fel i den här kodbasen har bara
  visat sig vid en verklig körning.
- **Vid design- eller avvägningsfrågor: lägg fram alternativ med för och emot,
  och en rekommendation.** Besluta inte åt honom.
- **Säg vad något är värt.** Han frågar ofta hur viktigt något är. Svara med en
  jämförelse mot det andra som står på listan, och **säg när något inte är värt
  att göra** — det svaret är lika användbart som ett förslag.
- **Håll en liten rättning liten.** Vill den växa till en omskrivning: säg det
  först och låt honom välja den lilla. En stavningsrättning som blev en
  refaktorisering kostade en halv session utan att någon bett om det.
- **Bygg så att det går att stänga av igen, och skriv ner hur.** Han frågar om
  nytt arbete går att ta bort. Prova återställningen på en egen gren innan du
  påstår att den fungerar, och lägg vägen tillbaka i `NÄSTA-STEG.md` — även det
  som ligger utanför förrådet, som en hemlighet i Vercel.
- **Ta emot invändningar — och mät om, försvara inte.** Han har flera gånger
  haft rätt mot ett förslag. Går invändningen att pröva: pröva den, och lägg
  fram talen. "En telefon har inga piltangenter" ledde till en mätning som
  visade att felet gällde zoom på en dator, inte telefoner — och att
  formuleringen var fel, inte rättningen.
- **Vid en genomgång: lämna listan först, koden sedan.** Ber han om en
  granskning vill han ha fynden med en värdering av vad var och en är värd, och
  väljer själv vad som ska rättas. Han delar gärna arbetet i paket och tar ett
  i taget.
- **Skilj på vad som gör appen bättre och vad som gör en visning enklare.** Han
  frågar rakt ut om något är "bara en liten struntsak". Svara lika rakt, och
  säg vilket av de två det är.
- **Radera ingenting som är hans utan att fråga** — mappar, filer, grenar. Han
  behåller hellre något i onödan än ångrar en radering.
- **Föreslå inte det som redan är gjort.** Läs `NÄSTA-STEG.md` först — och
  **titta i `underlag/`** innan du skriver något som ska läsas av andra
  (meddelande till gruppen, manus, juryfrågor). Det har två gånger varit nära
  att en andra version skrivits bredvid en befintlig som var bättre. Ber han om
  synpunkter på en text han själv skrivit: **kontrollera sakuppgifterna mot
  koden** — det är där värdet ligger, inte i språket.

## Gränser som inte får överskridas

- **Rör aldrig `main`.** Det är prototypen från hackathonet i våras, och den
  bygger <https://fmpsvi.netlify.app> direkt ur GitHub. Den står kvar orörd med
  flit: kollegor ska kunna jämföra den med v2. Förrådet har exakt två grenar —
  `main` och `v2-produktion` — och allt arbete sker på den senare. (`pilot`
  finns bara lokalt i den gamla mappen och pekar på samma commit som `main`.)
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
- **Gör en filändring per kommando.** Buntas flera `assert`-skyddade
  ersättningar i ett skript avbryts allt före skrivningen när en av dem inte
  matchar, och de andra tappas tyst. Det kostade tre omtag av samma rättning
  den 25 september.
- Svenska i kod, kommentarer, gränssnitt och tester. Engelska i commit-texter.

## Under hackathonet

*Tidsbegränsat avsnitt — ta bort det när hackathonet är över.*

Appen visas för befäl och fysioterapeuter som kommer att be om ändringar på
plats, ibland motstridiga: en vill ta bort samtalsknappen, nästa vill ha kvar
den. Då gäller tre saker utöver det vanliga.

- **Göm hellre än ta bort.** Stäng av funktionen, radera den inte. Att sätta
  tillbaka blir då sekunder i stället för en halvtimme — koden går alltid att
  hämta ur historiken, men att väva in den i något som hunnit ändras är arbete.
- **Rör aldrig databasens struktur under dagen.** Kod går alltid att få
  tillbaka; raderade uppgifter gör det inte. Sluta använda en kolumn om det
  behövs, men radera den inte.
- **Bygg inte motstridiga önskemål två gånger.** Att ett befäl och en
  fysioterapeut tycker olika om samma funktion är dagens resultat, inte ett
  problem att lösa på plats. Skriv ner vem som ville vad och varför, och låt
  Richard bestämma efteråt. En ostadig demo hjälper ingen.

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
npm test && npm run typecheck && npx eslint src tests scripts e2e && npm run build
lsof -ti:3100 | xargs kill   # en server som ligger kvar ger gamla resultat
npm run e2e         # 25 tester i webbläsare, inklusive tillgänglighet (axe)
npm run rundtur     # klickar igenom appen som alla fem demokonton
```

### Driftsättning

Allt arbete sker på **`v2-produktion`**. En push dit driftsätts automatiskt av
Vercel till <https://fm-psvi-v2.vercel.app> — ett bygge tar ungefär 30–60
sekunder. GitHub kör samma kontroller, men först efter pushen, så kör dem
själv innan.

**Sessionen måste starta i den här mappen.** En push till ett förråd utanför
sessionens arbetsmapp stoppas som otillåten publicering, och då måste Richard
antingen tillåta den eller köra den själv — det kostade en omväg den 25
september. I VS Code: Arkiv → Öppna mapp → `~/Code/stridsvarde-v2`. `/clear`
byter inte mapp; det är mappen som är öppen som avgör.

Kontrollera att rätt version ligger uppe med:

```bash
vercel ls --meta githubCommitSha=$(git rev-parse HEAD)
```

Gissa aldrig genom att hämta en sida och leta efter text — se
återvändsgränderna i `NÄSTA-STEG.md`. Avsluta med `npm run rundtur`, som går
mot den driftsatta demon som standard.

**Kontrollera att GitHubs körning blev grön efter pushen, utgå inte från det.**
Den föll två gånger den 21 september på tidsberoenden som aldrig syns lokalt,
och Vercel driftsätter ändå — så appen kan vara ute medan kontrollen är röd.
Går den inte att läsa utan behörighet finns felet i klartext här:

```bash
curl -s "https://api.github.com/repos/ricmanner/stridsvarde/commits/$(git rev-parse HEAD)/check-runs"
# ta id:t för "webblasare" och hämta /check-runs/<id>/annotations
```

Utöver koden ligger fem miljövariabler och hemligheten `CRON_SECRET` i Vercel,
satta enbart för produktion. `CRON_SECRET` driver nattkörningen som håller
demodatan aktuell — beskriven i `NÄSTA-STEG.md`, inklusive hur den stängs av.

## Databasen

Schemat ändras i `src/lib/db/schema.ts`, sedan `npx drizzle-kit generate` och
`npm run db:setup`. Mot den delade databasen körs migrationer **inte** vid
serverstart: administratören uppdaterar schemat från `/status`. Läggs en
migration till måste `SCHEMA_DDL` i `src/lib/db/queries/health.ts` följa med —
ett test jämför dem.
