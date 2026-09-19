# Nästa steg

Kort överlämning mellan arbetspass. `README.md` beskriver appen, `CLAUDE.md`
reglerna som styr arbetet — den här filen säger bara **var vi står just nu**.

Senast uppdaterad: 19 september 2026, sent på kvällen.

## Läget

Demon på <https://fm-psvi-v2.vercel.app> kör senaste koden. **127 enhetstester
och 22 webbläsartester** är gröna, och GitHub kör dem vid varje push tillsammans
med typkontroll, lint och bygge.

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

1. **Nätverksfelen.** Det finns **ingen tidsgräns någonstans i appen** — bara
   ett `busy_timeout` på databasen. Hänger Turso hänger begäran: den
   värnpliktige trycker "Bekräfta och skicka", knappen säger "Sparar…" och gör
   det för alltid. Ingen felruta, ingen möjlighet att försöka igen. Börja med
   incheckningen: en tidsgräns på ungefär tio sekunder och ett ärligt besked.
   **Prova genom att strypa nätet, inte genom att läsa koden.**
   Laddningstillstånd (`loading.tsx` saknas helt) hör ihop med samma fråga och
   bör göras i samma svep.
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

Utanför listan, när tillfälle ges: tillgängligheten är grön i axe på sex vyer i
tre skärmbredder, men bör granskas av en människa med skärmläsare. Ett verktyg
fångar bara ungefär en tredjedel av kraven.

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
