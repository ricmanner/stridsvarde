# Nästa steg

Kort överlämning mellan arbetspass. `README.md` beskriver appen, `CLAUDE.md`
reglerna som styr arbetet — den här filen säger bara **var vi står just nu**.

Senast uppdaterad: 19 september 2026.

## Läget

Demon på <https://fm-psvi-v2.vercel.app> kör senaste koden. 104 enhetstester
och 20 webbläsartester är gröna, och GitHub kör dem vid varje push tillsammans
med typkontroll, lint och bygge.

Av genomgången den 18 september är nio av tio punkter gjorda. Hela appen är nu
skriven i Tailwind: den värnpliktiges återkoppling var den sista vyn kvar, och
av 47 inline-objekt återstår fyra som alla räknas fram ur ett värde. Den enda
kvarvarande punkten står nedan.

## Att ta härnäst

1. **Besluten inför skarp drift**, som inte är tekniska utan verksamhetens:
   lagringstid (`RETENTION_DAYS`), säkerhetskopior av Turso-databasen, och
   säkerhetsrubriker (CSP) i `next.config.ts`.

Utanför listan, när tillfälle ges: tillgängligheten är åtgärdad i första
omgången men bör granskas av en människa med skärmläsare. Ett verktyg fångar
bara ungefär en tredjedel av kraven.

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

- **Tryck på "Uppdatera schemat" på `/status`** när du är inloggad som
  administratör i demon. Databasen saknar indexet `check_ins_date_user` tills
  dess. Det märks först vid verklig datamängd, så det är inte bråttom.

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
