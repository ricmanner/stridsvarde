# Nästa steg

Kort överlämning mellan arbetspass. `README.md` beskriver appen, `CLAUDE.md`
reglerna som styr arbetet — den här filen säger bara **var vi står just nu**.

Senast uppdaterad: 24 september 2026.

## Läget

**Nattkörningen är byggd men inte bevisad.** Koden är committad på
`v2-produktion`, 144 enhetstester och 25 webbläsartester är gröna, och
hemligheten ligger i Vercel. Två saker återstår: en push, och att en natt
faktiskt passerar så att `/status` visar en körning ingen människa startat.
**Innan det har hänt vet vi inte att klockan går** — det var hela lärdomen
från GitHubs schema.

Demon är återställd och står i visningsskick: räknaren på 2459 incheckningar,
och de åtta P1G1-kontona har dagen öppen.

Richard har skickat länken till en liten grupp kollegor för att testa. Han
skrev ett eget meddelande till dem; underlaget finns i
`underlag/meddelande-till-gruppen.md`.

### Gjort den 20–24 september

- **Hela appen genomgången i drift den 24 september.** Varje vy och varje
  knapp som går att trycka på, som alla fem roller, mot den driftsatta demon.
  Allt fungerade. Det som prövades: incheckningen med reglagets tangentbord,
  ändring från sammanfattningen, sparandet, återkopplingens båda flikar,
  stödblocket vid röda värden, samtalsbegäran och kvittot, korrigering av
  dagens rapport, alla tre befälsnivåerna med tre flikar och tre perioder,
  jämförelsevyn med val av underenhet, båda CSV-exporterna, utskriftsrapporten,
  kvittering av notiser, hela administrationen (skapa enhet, skapa personer,
  kodlapp, byta namn på person och enhet, ny kod, spärra, aktivera, flytta,
  radera hälsodata, radera enhet med namnbekräftelse), statussidan,
  felsidan, `/ingen-behorighet` och felmeddelandet vid fel kod.

  Bevisat på köpet: en ny kod fungerar direkt, en utfärdad kod slutar gälla
  när en ny utfärdas, kodlappen går inte att få tillbaka efter att den
  stängts, ett publicerat demokonto visar **Låst — demonstrationens ingång**
  i stället för knappar, administratören nekas befälsvyerna, och exporterna
  innehåller inga enskilda namn. Felloggen var tom efteråt: ingenting kastade
  under hela genomgången. Allt som skapades raderades, och demon står på
  samma siffror som innan — 40 enheter, 216 värnpliktiga, 13 befäl, 0 spärrade.

  **Mobilbredd 390 px** prövad på inloggning, admin, status och befälsvyns tre
  flikar: inget vågrätt spill. De breda tabellerna rullar inuti sin egen ruta,
  vilket är meningen.

  Tre saker att veta, ingen av dem ett fel:

  1. **"Underlag saknas" går inte att visa i demon som den står.** Texten
     kräver en enhet med färre än fyra svarande i perioden, och demons grupper
     har åtta var med hög svarsfrekvens. Jag fick skapa en egen grupp med två
     personer för att se den. `underlag/juryfragor.md` tar upp den i listan
     över vad som ska visas — antingen behöver demon en liten enhet, eller så
     bör den punkten skrivas om.
  2. **Kvittot på en samtalsbegäran står kvar hela dagen**, med flit (se
     `aktivSamtalsbegaran()`). Följden är att den som bett om samtal på
     morgonen inte kan be igen samma dag via appen — varken till samma befäl
     eller till nästa nivå. Numren till stödlinjerna står kvar. Om det är rätt
     avvägning är en fråga för dig, inte för koden.
  3. **Demon har just nu ingen öppen samtalsbegäran.** Det fanns ingen när
     jag började heller; den jag skapade under genomgången kvitterade jag för
     att prova krysset. Vill du ha en liggande inför en visning skapar jag en
     på en minut.

### Svarstider i drift, uppmätta 24 september

Referens att jämföra mot när något känns segt. Uppmätt från en laptop i
Sverige mot demon, flera anrop per väg.

| Väg | Svarstid |
|---|---|
| Värnpliktigas incheckningssida | 140–180 ms |
| Hälsokontrollen `/api/halsa` | 175–390 ms |
| Plutonchefens vy, 7 dagar | 200–350 ms |
| Bataljonschefens vy, 21 dagar — appens tyngsta fråga | 250–320 ms |
| CSV-export, 21 dagar | 195–245 ms |
| Inloggning (tre skrivningar till databasen) | ~780 ms |
| Spara en incheckning, inklusive omdirigering och återkopplingssidan | ~950 ms |
| Rundturen, hela appen som fem konton | 46 s |
| Första anropet efter en driftsättning (kallstart) | ~1,5 s |

Sparandet självt ligger kring 0,35 s; resten av den knappa sekunden är
nätet, omdirigeringen och återkopplingssidans egna frågor.

- **Enheter går att byta namn.** Fanns inte tidigare: ett felstavat enhetsnamn
  gick bara att rätta genom att radera enheten och skapa den på nytt, och
  raderingen tar personer och rapporter med sig. Fältet sitter i adminvyn på
  varje enhet. Trädet hänger ihop genom id, aldrig genom namn, så
  underenheter, personer och rapporter är orörda — det är bevisat i
  `tests/byt-enhetsnamn.test.mjs` och prövat i webbläsaren hela vägen upp till
  kompanichefens jämförelsevy. Behövs framför allt vid en överlämning: roten
  heter "Bataljonen" tills någon döper om den.

  Det nya fältet heter **"Enhetens namn"** och inte bara "Namn", eftersom
  fältet för ny underenhet redan heter så och två likadana etiketter i samma
  vy inte går att skilja åt för den som lyssnar. Två e2e-tester använde
  `getByLabel('Namn')`, som söker på delsträng, och behövde `exact: true`.

- **Demodatan flyttas fram av sig själv varje natt.** Rutten
  `/api/demo-tidslinje` gör samma sak som knappen på `/status`, och Vercels
  schemaläggning knackar på den 02:00 UTC — 04:00 svensk sommartid, med upp
  till en timmes spridning. Tre lås: rätt hemlighet (`CRON_SECRET`, jämförd
  tidssäkert), bara i demoläge, och **avstängd om hemligheten saknas** i
  stället för att falla öppen. Varje körning skriver en rad i `audit_log`
  med tom avsändare — även de nätter inget behövde flyttas, för annars går
  "klockan ringde, allt var aktuellt" inte att skilja från "klockan ringde
  aldrig". Statussidan visar den raden, och varnar om den blir äldre än 26
  timmar.

  **Nattkörningen räcker inte under en visningsdag, och knappen räcker inte
  heller.** De åtta P1G1-kontona öppnas bara av en framflyttning som
  faktiskt flyttar något. Har historiken redan flyttats till idag är
  `plan.dagar` noll, och då returnerar `applyDemoTimeline()` direkt utan att
  öppna kontona — dessutom visas knappen inte alls, eftersom rutan då säger
  att demodatan är aktuell. Tar kontona slut mitt på dagen finns i dag bara
  `Återställ demon`, som bygger om allt och loggar ut dig. Se punkt 1 under
  "Att ta härnäst"; det upptäcktes av rundturen den 24 september, inte av
  ett test.

  `CRON_SECRET` ligger i Vercel för produktion, märkt som känslig: den går
  inte att läsa tillbaka, och behöver inte det — Vercel skickar den själv.
  Ska rutten knuffas igång för hand görs det med `vercel crons`, inte med
  curl.

  **Så stänger du av den igen.** Tre nivåer, från snabbast till mest
  fullständig:

  1. **Ta bort hemligheten** — `vercel env rm CRON_SECRET production` och
     driftsätt om. Klockan ringer vidare men får nej (503), demodatan slutar
     flyttas, och statussidan säger att framflyttningen är avstängd. Koden
     står kvar, så att sätta tillbaka är att lägga in hemligheten igen. Det
     här är vägen mitt under en visningsdag.
  2. **Ta bort klockan** — stryk `crons` ur `vercel.json` och driftsätt om.
     Obs: en *Instant Rollback* i Vercel räcker INTE. Enligt Vercels egen
     dokumentation uppdateras aktiva cron-jobb inte vid en rollback, utan
     fortsätter ringa tills de tas bort med en ny driftsättning eller stängs
     av i projektets inställningar.
  3. **Ta bort allt** — `git revert --no-edit 7807735 43f7e42 ffa857f
     379241b`. Prövat den 24 september: trädet blir då identiskt med läget
     före arbetet, och de 133 tester som fanns då är gröna. Glöm inte
     hemligheten i steg 1 — den ligger utanför förrådet och försvinner inte
     med koden.

  Två saker går inte att ångra, och ingen av dem är en skada: datum som
  redan hunnit flyttas i demodatan stannar där de hamnat (det är samma sak
  knappen gör, och `Återställ demon` bygger upp allt från grunden om det
  behövs), och raderna i `audit_log` står kvar som historik.

- **Tidsgränser i incheckningen.** 10 sekunder på servern, 15 i webbläsaren,
  båda i `src/lib/tidsgrans.ts`. Går tiden ut får den värnpliktige ett besked,
  knappen släpps, svaren ligger kvar och ett nytt tryck går fram. Uppmätt i
  drift: sparandet tar 0,35 s, alltså tjugoåtta gångers marginal.
- **Laddningsvyer** på varje sida (`src/components/Laddar.tsx`), plus
  `useLinkStatus` på befälets periodknappar — de täcks inte av `loading.tsx`.
- **Rutan om gallring på adminsidan omskriven.** Richard, som är just den
  administratör vyn skrivs för, förstod varken "gallring" eller "avstängd".
  Rubriken behåller fackordet, men meningen under förklarar sig själv.
- **Juryunderlaget flyttat in i förrådet** som `underlag/juryfragor.md`.
  `README.md` beskriver nu mappen `underlag/`, som tidigare var odokumenterad.
- **Två felaktiga påståenden i dokumentationen rättade:** README påstod en
  brist som var åtgärdad, NÄSTA-STEG en kontroll som inte kördes.

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

1. **De åtta demokontona går inte att öppna mitt på dagen.** Ett beslut, inte
   ett fel: incheckningen är det första man vill visa, och kontona tar slut
   när flera provar. Tre vägar, med för och emot:

   - **Låt framflyttningen öppna kontona även när den inte flyttar något.**
     Ett steg flyttas ut ur `applyDemoTimeline()`:s tidiga retur. Minst kod,
     och gör påståendet i tabellen längre ned sant igen. Emot: funktionen gör
     då två saker, och den som läser namnet gissar bara den ena.
   - **En egen knapp på `/status`: "Öppna demokontona igen".** Tydligast för
     den som står mitt i en visning, och syns alltid i demoläge. Emot: en
     knapp till på en sida som redan har tre.
   - **Låt det vara.** `Återställ demon` fungerar, men bygger om allt och
     loggar ut dig — mitt under en visning är det inte ett alternativ.

   Min rekommendation är den andra: den som behöver den här knappen står
   framför en publik och ska inte behöva veta vad "flytta fram" betyder.
   Frågan är din.

2. **Resten av nätverksfelen.** Incheckningen är klar, men den var bara den
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
3. **De två besluten inför skarp drift**, som är verksamhetens och inte
   utvecklarens: lagringstid (`RETENTION_DAYS`) och säkerhetskopior av
   Turso-databasen. Underlag finns skrivet — fråga Richard efter det.
   Säkerhetskopiorna är den mer akuta av de två: appens egen kopiering fungerar
   bara mot en lokal fil, så den driftsatta demon förlitar sig helt på Turso.
   Turso kopierar alltid, automatiskt och utan att gå att stänga av — det som
   skiljer är **hur långt bakåt**, och det avgörs av abonnemanget: 24 timmar
   på gratisplanen, 10 dagar på Developer, 30 på Scaler, 90 på Pro. Frågan är
   alltså inte om det är påslaget utan vilken plan kontot har, och i vilken
   region databasen ligger. Värt att veta i förväg: en återställning skapar en
   **ny** databas, så adressen i Vercel måste pekas om efteråt.
4. **Designfrågor som väntar på ett samtal**, inte på kod: reglaget i
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
- **På en långsam telefon saknar sidan kortvarigt sin titel.** Vid en
  navigering inne i appen sätts dokumentets titel av webbläsaren efter att
  sidan bytts, inte av servern. Uppmätt med processorn bromsad tjugo gånger:
  titeln är tom i knappt fyra tiondelar av en sekund efter inloggning. Vid en
  vanlig omladdning finns den direkt. En skärmläsare kan alltså hinna säga
  "namnlös sida" i det fönstret. Det är Next egen hantering och inte något
  appen sätter, så det går inte att rätta här — men det hör hemma i en
  tillgänglighetsredogörelse, och det var det som fällde GitHubs kontroll den
  21 september.
- **Ingen människa med skärmläsare har provat appen.** Ett verktyg fångar bara
  ungefär en tredjedel av kraven, och graferna berättar i dag vad de heter men
  inte vad de visar.

## Före en visning

- **Tryck på "Återställ demon" på `/status`** om någon hunnit radera eller
  ändra något. Den bygger upp allt från grunden — raderade enheter kommer
  tillbaka — och sätter historiken så att den slutar idag. Kräver att ordet
  ÅTERSTÄLL skrivs, och loggar ut dig. Koderna är desamma efteråt.
- **Tryck på "Flytta fram demodatan"** om inget är trasigt utan datan bara
  hunnit bli gammal. Nattkörningen gör det åt dig varje natt. Knappen syns
  bara när datan hunnit bli minst två dagar gammal — **tar de åtta lediga
  incheckningarna slut mitt under en visningsdag hjälper varken klockan
  eller knappen**, utan bara `Återställ demon`. Se punkt 1 under "Att ta
  härnäst". Den flyttar datum och rör inget annat, alltså behålls
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

- **Kontrollera säkerhetskopiorna hos Turso.** Automatisk återställning är
  alltid påslagen; vilket abonnemang kontot har avgör hur långt bakåt den
  räcker, och regionen avgör i vilket land kopiorna ligger. Båda står i
  Tursos egen kontrollpanel och tar tio minuter att läsa av. Frågan går inte
  att besvara från en terminal: databasnycklarna är märkta som känsliga.
- **Lagringstiden** behöver ett svar från Försvarsmaktens dataskyddsombud.
  Mekaniken är färdig och medvetet avstängd — svaret blir en siffra i
  inställningarna.

Schemat i den delade databasen är komplett sedan den 19 september; knappen
"Uppdatera schemat" på `/status` visas bara när något saknas.

## Om appen ska lämnas över tom

Läget finns redan inbyggt och kräver ingen ny kod: `SEED_DEMO_DATA=false`
tillsammans med `PSVI_ENVIRONMENT=pilot`. Vid första start skapas då exakt två
saker — en enhet högst upp som heter "Bataljonen", och ett administratörskonto
— och inget mer. Administratören loggar in och bygger kompanier, plutoner,
grupper och personer i gränssnittet.

**Konvertera inte demon. Starta en ny databas.** Demodatan ligger redan i den
nuvarande, och det finns ingen "töm allt"-funktion utanför demoläget:
återställningen vägrar med flit att köras mot skarp drift, eftersom den
raderar hälsodata.

### Administratörskoden visas en gång, i serverloggen

Det här är det som kan gå fel, så här är vad det betyder i praktiken.

Koden till det första administratörskontot slumpas fram vid första start och
skrivs ut **i serverns egen utskrift** — inte i appen, inte i ett mejl, inte
någonstans där den går att hämta i efterhand. Kör du lokalt står den i
terminalfönstret. Ligger appen på Vercel står den i projektets **Logs**, i
körningen för den allra första driftsättningen.

Den lagras bara som hash i databasen, precis som alla andra koder. Missas den
finns `npm run aterstall-admin`, men det kommandot kräver databasens nycklar,
och de är märkta som känsliga och går inte att hämta ner. Alltså: **läs av
koden direkt vid första start, innan du gör något annat.**

### Öppna frågor som inte är kodfrågor

- **En rot per installation.** Det går inte att skapa en andra enhet högst
  upp; varje ny enhet måste ha en förälder. Två bataljoner betyder alltså två
  installationer med var sin databas — vilket samtidigt är den enklaste
  garantin för att bataljonschef 1 aldrig ser bataljonschef 2:s data.
- **Vem lägger upp värnpliktiga?** Idag kan bara administratören det. Om det
  i praktiken är plutonchefen som vet vilka som finns i gruppen behöver den
  behörigheten flyttas eller delas. Inte utrett.

## Återvändsgränder — prova inte om igen

Sådant som såg ut som förbättringar och inte var det. Varje rad kostade tid.

- **En schemalagd körning möts av proxyn, inte av sin rutt.** Proxyn skickar
  varje adress utan sessionskaka vidare till inloggningen, och en klocka har
  aldrig någon kaka. Vercel följer inte omdirigeringar utan bockar av jobbet
  som utfört — nattkörningen hade alltså stått som lyckad varje natt utan att
  flytta en rad. Exakt samma fel hade hälsokontrollen en gång, och varningen
  om det står tre rader ovanför raden som behövde ändras i `src/proxy.ts`.
  Ingen av gångerna hittades det genom att läsa koden: enhetstesterna var
  gröna och ett riktigt anrop mot en körande app svarade 307. **Nya
  API-rutter som anropas av något annat än en inloggad människa måste in i
  `PUBLIC_PATHS`** — och bära sitt eget lås.

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
