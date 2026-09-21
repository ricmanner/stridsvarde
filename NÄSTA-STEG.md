# Nästa steg

Kort överlämning mellan arbetspass. `README.md` beskriver appen, `CLAUDE.md`
reglerna som styr arbetet — den här filen säger bara **var vi står just nu**.

Senast uppdaterad: 20 september 2026.

## Läget

**132 enhetstester och 25 webbläsartester** är gröna, och GitHub kör dem vid
varje push tillsammans med typkontroll, lint och bygge. Demon på
<https://fm-psvi-v2.vercel.app> kör koden fram till den 19 september —
nätverksarbetet nedan är gjort men **ännu inte pushat**.

Den 20 september fick appen sina första tidsgränser. Tidigare fanns ingen
bortre gräns någonstans: hängde databasen hängde begäran, och den värnpliktige
såg "Sparar…" för alltid.

- **Incheckningen** har nu 10 sekunder på servern och 15 i webbläsaren, båda
  definierade i `src/lib/tidsgrans.ts`. Går tiden ut får den värnpliktige ett
  besked, knappen släpps, svaren ligger kvar och ett nytt tryck går fram.
- **Laddningsvyer** finns på varje sida (`src/components/Laddar.tsx`), och
  befälets periodknappar säger till när de arbetar.

Allt prövat mot ett på riktigt strypt nät i en mobilskärm, inte bara i test.

Den 19 september gjordes fyra genomgångar — säkerhet, robusthet, användbarhet
och design. **Allt som klassades som kritiskt eller högt är åtgärdat.** I korthet:

- **Säkerhet:** Next uppgraderad förbi en kritisk sårbarhet, sårbarheter 13 → 4
  (noll kritiska eller höga), säkerhetsrubriker med CSP och `frame-ancestors`,
  databasadressen inte längre synlig för den som loggar in med demons
  publicerade admin-kod, felmeddelanden stannar i loggen.
- **Robusthet:** en värnpliktig som bett om samtal en andra gång samma dag
  tappades tyst — rättat. Larmfel och klientfel loggas nu.
- **Användbarhet:** återkopplingen vid låga värden kortades från fyra
  mobilskärmar till knappt tre, och kvittot på en samtalsbegäran står kvar
  efter omladdning.
- **Design:** en bekräftelseruta överallt i stället för tre olika, väntetext på
  alla knappar, och typskalan gick från femton storlekar till sex.

`/status` har nu tre knappar för administratören: uppdatera schemat, flytta
fram demodatan och återställa demon.

## Att ta härnäst

1. **Resten av nätverksfelen.** Incheckningen är klar, men den var bara den
   första av flera skrivvägar. Utan tidsgräns står ännu inloggningen
   (`actions/auth.ts`), samtalsbegäran, och administratörens åtgärder: skapa
   och radera enheter, utfärda koder.

   Mönstret finns färdigt i `medTidsgräns()`. Det som återstår är att välja
   rätt gräns per väg och skriva ett test som först faller. **Men en
   raderingsväg tål inte att köras två gånger** på det sätt incheckningen gör
   — läs kommentaren i `src/lib/tidsgrans.ts` innan den används där.

   **`logError()` kan själv hänga.** Den sväljer fel, men en try/catch
   hjälper inte mot något som aldrig svarar, och den skriver till samma
   databas som just visat sig hänga. Incheckningen går runt det genom att
   logga i `after()`, alltså efter att svaret gått iväg. En egen kort
   tidsgräns inuti `logError` vore en bättre lösning för hela appen.
2. **De två besluten inför skarp drift**, som är verksamhetens och inte
   utvecklarens: lagringstid (`RETENTION_DAYS`) och säkerhetskopior av
   Turso-databasen. Underlag finns skrivet — fråga Richard efter det.
   Säkerhetskopiorna är den mer akuta av de två: appens egen kopiering fungerar
   bara mot en lokal fil, så den driftsatta demon förlitar sig helt på Turso,
   och **ingen har kontrollerat att det är påslaget**.
3. **Designfrågor som väntar på ett samtal**, inte på kod: reglaget i
   incheckningen börjar på 5, så den som bara trycker "Nästa" skickar in sex
   femmor som ser ut som svar. Att tvinga fram en rörelse straffar den som
   verkligen menar 5 — Richard har avfärdat både det och att hoppa över frågor.
   Frågan är öppen.

Utanför listan, när tillfälle ges — två saker om tillgängligheten, och var
gränsen för vad vi vet faktiskt går:

- **Axe är grön på sex vyer, men bara i datorbredd.** `playwright.config.ts`
  har ett enda projekt, `devices['Desktop Chrome']`, och ingen testfil sätter
  egen fönsterstorlek. Mobilen är prövad för hand. Att lägga till telefonbredd
  i kontrollerna är en rimlig uppgift — men räkna med att den hittar fel som
  då ska rättas, så ta den inte strax före en visning.
- **Ingen människa med skärmläsare har provat appen.** Ett verktyg fångar bara
  ungefär en tredjedel av kraven, och graferna berättar i dag vad de heter men
  inte vad de visar.

## Före en visning

- **Tryck på "Återställ demon" på `/status`** om någon hunnit radera eller
  ändra något. Den bygger upp allt från grunden — raderade enheter kommer
  tillbaka — och sätter historiken så att den slutar idag. Kräver att ordet
  ÅTERSTÄLL skrivs, och loggar ut dig. Koderna är desamma efteråt.
- **Tryck på "Flytta fram demodatan"** om inget är trasigt utan datan bara
  hunnit bli gammal. Den flyttar datum och rör inget annat, alltså behålls
  det någon lagt till i demon. Demodatan står still medan kalendern går: efter en
  vecka är befälsvyns förvalda period tom, efter tre veckor visar varje vy
  "Underlag saknas". Rutan räknar ut läget själv och knappen syns bara när det
  finns något att göra. Lokalt går samma sak via `npm run demo:uppdatera`.
- Kör därefter `npm run rundtur`. Den tar en minut och går igenom appen som
  alla fem demokonton.

**Färsk demodata och många lediga incheckningar går inte att få samtidigt.**
Det är en avvägning, inte ett fel, och den avgör vilken knapp du ska trycka på:

| Demodatans läge | Incheckningen | Befälsvyn |
|---|---|---|
| Nyss framflyttad | Bara de åtta P1G1-kontona är lediga | Ser rätt ut |
| En dag gammal eller mer | Alla 216 värnpliktiga kan checka in | Säger **0 % svarat idag** |

Inför en visning vill du ha det övre läget — en befälsvy som står på noll ser
trasig ut på en storskärm. Flytta fram datan på morgonen, och igen om de åtta
kontona tar slut under dagen; framflyttningen öppnar samma åtta på nytt.

Räkna inte med 82 % för idag efter en framflyttning. Grupp 1 lämnas tom med
flit, så Pluton 1 landar kring hälften — det är meningen, och det är vad som
gör siffran realistisk i stället för att stå på 100 %.

## Kräver dig, inte utvecklaren

- **Kontrollera säkerhetskopiorna hos Turso.** Är automatisk återställning
  påslagen, hur många dagar bakåt räcker den, och i vilket land lagras
  kopiorna? Utan de tre svaren går beslutet om säkerhetskopior inte att fatta,
  och frågan går inte att besvara från en terminal: databasnycklarna är märkta
  som känsliga.
- **Lagringstiden** behöver ett svar från Försvarsmaktens dataskyddsombud.
  Mekaniken är färdig och medvetet avstängd — svaret blir en siffra i
  inställningarna.

Schemat i den delade databasen är komplett sedan den 19 september; knappen
"Uppdatera schemat" på `/status` visas bara när något saknas.

## Återvändsgränder — prova inte om igen

Sådant som såg ut som förbättringar och inte var det. Varje rad kostade tid.

- **Grönt lokalt betyder inte grönt hos GitHub.** `e2e/natverksfel.spec.ts`
  passerade tjugofem lokala körningar och en CI-körning, och föll sedan på
  nästa push — som bara innehöll textändringar. GitHubs maskin är långsammare,
  och två saker tål ingen marginal: ett test som väntar ut en riktig tidsgräns
  (här 15 sekunder) ligger nära taket på 45, och ett klick som förstör sitt
  eget element behöver `noWaitAfter`. Utan den tror Playwright att klicket
  missade och försöker igen mot ett element som hunnit bytas ut. Faller ett
  test bara hos GitHub: misstänk tid och kapplöpningar, inte logik.
- **Läs aldrig adressen direkt efter `page.goto()`.** Skickar servern vidare —
  som `/soldat` gör när dagen redan är besvarad — hinner omdirigeringen inte
  alltid fram innan `goto()` återvänder. Adressen ser då ut att vara den man
  bad om, fel gren tas, och testet letar efter något på en sida som visar
  något annat. Vänta på `networkidle` först. Det här kostade tre separata
  felsökningar på en dag innan orsaken var densamma varje gång.
- **Ett e2e-test som skriver måste gå att köra om.** Tryck inte ett fast antal
  steg på ett reglage: vid en rättelse står det redan på gårdagens värde, och
  samma tryck ger ett annat tal. Gå till ett känt läge först (Home) och räkna
  därifrån. Annars går testet bara att köra en gång per konto och dag, och då
  går det inte att bevisa att det slutat vara nyckfullt.
- **Publicera inte fler demokoder på inloggningssidan.** Sidan förklarar redan
  serien P1G1-01 till 08 och säger varför den medvetet inte räknar upp vilka
  som är lediga: det ändras så fort någon provar demon, och en sida som lovar
  fel sak är sämre än en som säger hur det fungerar. Listan styr dessutom
  skyddet — att publicera en kod är samma sak som att göra kontot omöjligt att
  spärra, radera eller byta kod på, och då försvinner det som övningsmål för
  den som vill prova administrationen.
- **En förhandsgren på Vercel fungerar inte som projektet står.** Alla fem
  miljövariabler är satta enbart för produktion, så en ny gren får varken
  databasadress eller peppar: den faller tillbaka på en lokal fil som töms
  mellan anropen, och vägrar starta utan nyckel. Baksidan är förutsägbar —
  framsidan är att en experimentgren därför inte *kan* skada demons data.
  Behövs en riktig parallellmiljö krävs en egen Turso-databas och egna
  variabler för den miljön, inte bara en gren.
- **En server som ligger kvar på port 3100 gör webbläsartesterna
  lögnaktiga.** Playwright är satt att återanvända en befintlig server
  (`reuseExistingServer`), så bygget körs inte om och testerna mäter gammal
  kod. En nyskapad `loading.tsx` fanns inte i bygget på tre körningar i rad,
  och appen fick skulden. Kör `lsof -ti:3100 | xargs kill` när ett resultat
  ser omöjligt ut.
- **`useActionState` KÖAR anrop.** Ett nytt försök medan det första hänger
  lämnar aldrig webbläsaren — knappen ser levande ut och gör ingenting, vilket
  är värre än en låst knapp, eftersom den värnpliktige går därifrån i tron att
  rapporten är skickad. Lösningen är att montera om komponenten som äger
  kroken (`Skickaformular` i `CheckinWizard.tsx`), inte att släppa knappen.
- **`page.unroute(matchare, handlare)` matchar på funktionens identitet.** En
  ny men likadan pilfunktion tar inte bort någonting, och avlyssningen ligger
  kvar tyst. Använd `page.unrouteAll()`.
- **En `loading.tsx` i roten gör ingenting när man byter sida inne i appen.**
  Den visas bara när roten själv monteras. Varje sida behöver en egen.
- **En laddningsvy visas bara om länken hunnit förhämtas.** Next förhämtar en
  länk när den syns på skärmen; har det inte skett är navigeringen i stället
  BLOCKERAD tills svaret kommer, och skärmen står still på den gamla sidan.
  Det är därför periodknapparna och rapportlänken har `useLinkStatus` — den
  luckan går inte att täcka med `loading.tsx`. I test: `toBeVisible()` räcker
  inte, elementet måste rullas fram med `scrollIntoViewIfNeeded()`.
- **Stryp inte förhämtningen när du provar en laddningsvy.** Bromsas även den
  blockeras navigeringen och ingenting syns — det ser ut som att laddningsvyn
  är trasig fast den fungerar. Bromsa bara begäran utan rubriken
  `next-router-prefetch`.

- **En databasfråga i stället för tre i `getUnitOverview` är LÅNGSAMMARE.**
  Mätt mot 5 000 värnpliktiga och ett års historik: 2 186 ms mot 925 ms. Den
  extra beräkningen per rad kostar mer än de sparade nätverksresorna vinner.
- **Enhetsträdet på adminsidan behöver inte optimeras.** Det ser kvadratiskt
  ut i koden men tar 5 ms vid 172 enheter.
- **Extra index för raderingsvägarna behövs inte.** Att radera ett kompani
  med 1 267 personer och 321 657 rapporter tar 1,6 sekunder, i en transaktion.
- **GitHubs schemalagda arbetsflöden startar inte i det här förrådet.** Varken
  var femtonde minut eller varje timme, på ett halvt dygns försök, medan
  manuell start fungerar direkt. Allt annat är uteslutet: rätt standardgren,
  filen ligger på den, förrådet är varken kopia eller avstängt.
- **`/soldat/dashboard` går inte att nå i demon utan att först checka in.**
  Ingen av demons värnpliktiga har dagen besvarad i den driftsatta databasen,
  så adressen svarar 307 mot `/soldat`. Ett skript som hämtar den och letar
  efter något i återkopplingen får därför alltid incheckningens HTML, och
  rapporterar att en driftsättning uteblivit fast den är ute. Vill man se att
  rätt version ligger uppe: `vercel ls --meta githubCommitSha=$(git rev-parse HEAD)`
  svarar på en sekund. Rundturen går av samma skäl aldrig in i återkopplingen.
- **`innerText` på en frånkopplad klon beter sig som `textContent`.** Ett
  försök att läsa sidan utan notisrutan klonade `body` och tog bort rutan ur
  klonen. Då svepte texten in innehållet i `<script>`-taggarna, där Next lägger
  sidans data — inklusive samma notistext. Kontrollen larmade vidare, på text
  ingen kan se. Göm elementet i den levande sidan i stället.
- **Rundturens integritetskontroll larmar inte på notisrutan.** En
  samtalsbegäran nämner med flit den som bett om samtalet. Rutan är märkt med
  `data-notiser` och läses bort. Ser du ett larm om "en enskild persons
  benämning" är det något annat som läckt.
- **`readAt` på en notis betyder att befälet tryckt på krysset**, inte att hen
  läst något. Bygg inga påståenden om vad befälet gjort på det fältet.
- **Jämför aldrig sidtext skiftlägeskänsligt.** Webbläsaren återger
  versalisering från formatmallen, så en rubrik skriven "Kategorier" kommer
  tillbaka som "KATEGORIER". Två kontroller i den här sessionen sa felaktigt
  att en funktion var trasig av det skälet.
- **`npm audit fix --force` ska inte köras.** De fyra kvarvarande
  sårbarheterna är esbuild inbakat i `drizzle-kit`, ett utvecklingsberoende.
  Rättningen är en nedgradering till 0.18.1 — tretton delversioner bakåt över
  en majorgräns — och hade sannolikt slagit sönder migrationsverktyget.
- **Ett index går inte att byta ut med "Uppdatera schemat".** Knappen lägger
  bara till det som saknas (`CREATE ... IF NOT EXISTS`). Behöver ett befintligt
  index ändras måste det lösas i koden i stället — så gjordes rättningen av
  samtalsbegäran.
- **Dröjer en driftsättning — kolla <https://www.vercel-status.com/> först.**
  Den 18 september tog bygget 30–55 minuter under en störning hos Vercel,
  medan Git-integrationen fungerade. Inget var fel i projektet.
- **`vercel env pull` ger inte databasnycklarna.** De är märkta som känsliga
  och kommer tillbaka som `[SENSITIVE]`. Schemat i den delade databasen
  uppdateras därför från `/status`, inte från terminalen.

## Kom igång på två minuter

```bash
npm install && npm run db:setup && npm run dev
npm test && npm run e2e        # allt ska vara grönt innan du börjar ändra
```

Demokoderna står på inloggningssidan. Kör `/skarp` före en driftsättning och
`/rundtur` före en uppvisning.
