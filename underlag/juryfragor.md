# FM–PSVI inför juryn

**Skrivet för:** Richard, att läsa igenom före hackathonet.
Juryn är försvarsmaktsbefäl och fysioterapeuter — inga tekniker.

## Varför det här finns

Appen ska visas upp för en jury som inte kommer att fråga om kod. De kommer att
fråga vem som ser vad, om det här är övervakning, om det ser bra ut, och vad
appen faktiskt klarar. Det här dokumentet går igenom vad som imponerar, vad som
är oklart, och ger färdiga svar på de frågor som sannolikt kommer.

Skrivet den 20 september 2026 efter en genomgång av hela kodbasen. Varje
påstående om vad appen gör och inte gör är kontrollerat mot koden den dagen —
kontrollera om igen om något känns förlegat, särskilt listan över brister.

Granskningen ledde också till två rättelser i `README.md` och `NÄSTA-STEG.md`,
som påstod en brist som var åtgärdad och en kontroll som inte kördes. Båda är
gjorda; det är därför de inte står kvar här.

Se även `meddelande-till-gruppen.md` i samma mapp, som säger samma sak fast
till kollegor i stället för till en jury.

---

## Det som kommer att imponera

**1. Integriteten är inbyggd, inte inställd.**
Det här är appens starkaste kort, och det tål att sägas rakt ut: skyddet ligger
i hur uppgifterna hämtas ur databasen, inte i vad skärmen väljer att rita.
Siffror som inte får visas *lämnar aldrig databasen*. En glömd rad i
gränssnittet kan därför inte läcka dem.

**2. "Underlag saknas" — aldrig en nolla.**
När för få har svarat visas en förklaring, inte en nolla och inte ett tomt fält.
Skälet är bra: en nolla skulle läsas som "alla mår bottendåligt", vilket är den
farligaste tänkbara feltolkningen.

**3. Larmen gäller enheter, aldrig personer.**
Systemet larmar aldrig om en enskild soldat. Det skulle göra verktyget till
övervakning — och vore dessutom motsägelsefullt, eftersom befälsvyn medvetet
döljer just det.

**4. Den enda gången ett namn når ett befäl är när soldaten själv trycker på en
knapp.** Och då följer inga siffror med. Befälet får veta att någon vill prata,
aldrig vad personen svarat.

**5. Stödkontakterna är omtänkta, inte påklistrade.**
Tidigare fick alla med minst ett rött värde samma lista — den som sovit och ätit
dåligt möttes av Självmordslinjen och aldrig av Försvarshälsan. Nu anpassas
*ordningen*, men ingenting tas bort. 112 och Självmordslinjen står alltid kvar.

**6. Appen säger själv att dess gränser är preliminära.**
Att en prototyp öppet skriver "Gränserna är preliminära och ska fastställas
tillsammans med Försvarshälsan" kommer att tas emot väl av just den här juryn.

**7. Obelagd statistik är borttagen.**
Tidigare versioner innehöll siffror som "minskar avbrott med upp till 40
procent". De togs bort för att de inte gick att belägga.

**8. Jämförelsevyn svarar på befälets faktiska fråga.**
Inte "hur mår enheten" utan "var brister det" — Grupp 3, sömn. Det står direkt i
rutnätet i stället för att behöva letas fram ur en graf.

**9. Tillgänglighet är taget på allvar.**
Skattningsreglaget är ett riktigt reglage som går att styra med tangentbord —
tidigare kunde den som inte kunde använda pekskärm med precision helt enkelt
inte checka in. Färg är aldrig ensam bärare: det står GRÖN, GUL eller RÖD i
klartext.

---

## Det som är oklart, och som de kommer att haja till över

**1. Vad står det för namn på en soldat i systemet?**
Appen har inga fält för namn eller personnummer. Men det finns ett fritt
"benämning"-fält som den som administrerar fyller i. Skrivs ett efternamn där
blir det en personuppgift; skrivs ett tjänstenummer eller "3. grp plats 7"
löser det samma problem med mindre uppgifter. **Det är ett beslut du behöver ha
ett svar på**, för det är den fråga som avgör hur känslig databasen är.

**2. Den värnpliktige får ingen brasklapp.**
Befälsvyn säger att gränserna är preliminära. Soldatens vy gör det inte. Där
står "kritisk nivå" och "Personlig vägledning" utan någon reservation om att
appen inte är vård och inte ställer diagnos. Det är appens tydligaste
snedfördelning, och fysioterapeuterna lär märka den.

**3. Reglaget börjar på 5.**
Den som bara trycker "Nästa" sex gånger skickar in sex femmor som ser ut som
riktiga svar. Frågan är öppen — både att tvinga fram en rörelse och att tillåta
överhoppade frågor är avfärdade. **Det här är den fråga fysioterapeuterna mest
sannolikt ställer, och du har inget färdigt svar.** Förslag på svar finns nedan.

**4. Ingen blir påmind om att checka in.**
Ingen notis, inget SMS, ingen påminnelse alls. Hela nyttan bygger på daglig
rapportering, och appen har ingen mekanism för att få den att ske. Det är den
största tysta luckan.

**5. Försvarshälsan står utan telefonnummer.**
Medvetet — numret skiljer mellan förband och får inte gissas. Men i demon ser
det ut som en lucka. Säg det själv innan någon frågar.

**6. Uppgifterna raderas aldrig än.**
Gallringen är byggd men avstängd. Hur länge hälsodata får sparas är ett beslut
för Försvarsmaktens dataskyddsombud, inte för utvecklaren.

**7. I demoläget står administratörskoden på inloggningssidan.**
Med flit, så att vem som helst ska kunna prova. Förklara det innan någon i
juryn upptäcker det och drar fel slutsats.

---

## Juryns frågor, med svar

### Om integritet och vem som ser vad

**"Kan jag som plutonchef se hur en enskild soldat mår?"**
> Nej. Du ser gruppens snitt, aldrig en enskild persons svar. Det är inte en
> inställning som kan slås av — enskilda svar hämtas aldrig ur databasen till
> något befäl. Den enda som ser en enskild rapport är personen själv.

**"Om bara tre i gruppen har svarat — ser jag deras svar då?"**
> Nej. Det krävs minst fyra svar *och* minst fyra personer i enheten. Annars står
> det "Underlag saknas — 3 av 8 har rapporterat". Kravet på fyra *medlemmar*
> finns för att en grupp på tre röjer varje individ även om alla svarat.

**"Men om alla fyra svarat och tre är gröna och en är röd — då vet jag ju att
någon mår dåligt?"**
> Ja, det stämmer, och det ska sägas rakt ut. Du vet att någon i gruppen mår
> dåligt. Du vet inte vem. Det är en inbyggd följd av att visa gruppdata över
> huvud taget — och det är också hela poängen: du ska få veta att gruppen
> behöver något, utan att få veta vem som sagt vad. Vill man ha ett starkare
> skydd höjer man tröskeln från fyra till till exempel sex, men då blir många
> små grupper helt osynliga.

**"Kan jag titta på en annan plutons siffror?"**
> Nej. Vilken enhet du ser avgörs av din inloggning, inte av vad som står i
> adressfältet. Det finns ingenting att ändra på.

**"Om en soldat ber om att få prata — får jag veta vad hen svarat?"**
> Nej. Du får veta att personen vill prata, och vilken enhet hen tillhör.
> Inga siffror, ingen kategori, ingenting om måendet. Soldaten ser samma
> besked på sin sida: "Befälet får bara veta att du vill prata — aldrig vad du
> svarat."

**"Är det här övervakning av mina soldater?"**
> Nej, och det är byggt för att inte kunna bli det. Systemet skickar aldrig ett
> larm om en enskild person — bara om en enhet. Ett befäl kan inte gå in och
> titta på en viss soldat, för den vyn finns inte. Det enda som passerar
> gränsen gör det för att soldaten själv tryckt på en knapp.

**"Vem kan se allt? Administratören?"**
> Nej. Administratören lägger upp enheter och delar ut inloggningskoder och når
> aldrig hälsouppgifter. Det är en strukturell gräns: den delen av systemet är
> inte kopplad till hälsotabellen över huvud taget.

**"Vad sparas om mig? Namn, personnummer, telefonnummer?"**
> Inget av det. Det finns inga sådana fält. Det som sparas är en benämning som
> förbandet väljer, vilken enhet du tillhör, och dina dagliga svar. Din
> inloggningskod sparas inte i klartext — bara ett oläsbart avtryck av den, så
> en stulen databas ger ingen tillgång till appen.
>
> *(Var beredd på följdfrågan: vad ska stå i benämningen? Säg att det är
> Försvarsmaktens beslut, och att ett tjänstenummer räcker för att lösa
> uppgiften.)*

**"Hur loggar man in? Med BankID?"**
> Nej, med en engångsutdelad kod på papper från befälet. Ingen e-post, inget
> lösenord, inget personnummer. Koden visas exakt en gång när den skapas — den
> går inte att läsa ut ur systemet i efterhand.

**"Hur länge sparas uppgifterna?"**
> Just nu tills vidare, och det är medvetet. Funktionen att radera automatiskt
> är byggd men avstängd, för att tyst börja radera hälsodata vore värre än att
> spara den. Hur länge de får sparas är en fråga för Försvarsmaktens
> dataskyddsombud — svaret blir en siffra i inställningarna.

**"Kan en soldat få sina uppgifter raderade?"**
> Ja, men i dag går det via administratören, inte med en knapp i appen.
> Rättigheten finns och funktionen fungerar — vägen dit är bara manuell. Det är
> en sak som bör byggas före skarp drift.

**"Skickas något till Google, Microsoft eller någon annan?"**
> Nej. Ingenting lämnar systemet till någon utomstående tjänst. Även
> felmeddelanden stannar i appens egen databas.

### Om utseende och användbarhet

**"Varför ser den inte ut som Försvarsmakten?"**
> Den har medvetet ingen grafisk profil ännu. Det är en prototyp, och en
> visuell identitet läggs på sist — den är billig att byta, till skillnad från
> hur uppgifterna hanteras. Det som är gjort är strukturen: sex textstorlekar
> i stället för femton, ett färgsystem där varje färg betyder en sak.

**"Vad betyder grönt, gult och rött?"**
> Grönt är 7 och uppåt, gult 4 till 7, rött under 4, på en skala från 1 till 10.
> Färgerna betyder alltid status och aldrig kategori — en kategori ritas i
> neutralt bläck, så att ingen läser en grön linje som "bra" oavsett vad den
> visar. Det står dessutom GRÖN, GUL eller RÖD i text bredvid, så den som är
> färgblind eller tittar på en dålig projektor ser samma sak.

**"Fungerar den i mobilen?"**
> Ja. Soldatens vy är byggd för telefon i första hand — det är där den ska
> användas. Befälsvyn är byggd för större skärm, och i jämförelsetabellen får
> man svepa i sidled på en telefon. Det är ett medvetet val: ett befäl
> analyserar sällan på mobilen.

**"Kan någon med nedsatt syn använda den?"**
> Till stor del. Appen är granskad mot den europeiska tillgänglighetsstandarden
> och godkänd på alla vyer, allt går att sköta med tangentbord, och zoom är
> inte blockerad. Men ett verktyg fångar bara ungefär en tredjedel av kraven —
> **ingen människa med skärmläsare har testat den än**, och graferna berättar
> i dag bara vad de heter, inte vad de visar. Det är nästa steg.

**"Är diagrammen begripliga?"**
> Trendkurvan och rutnätet med sex små kurvor är gjorda för att vara det —
> rutnätet visar att det är *sömnen* som dragit ner, inte allt. Spindeldiagrammet
> är svårare att läsa, och det ska erkännas: ytan växer snabbare än värdet, så
> en skillnad ser större ut än den är. Det finns kvar på önskemål från en
> fysioterapeut, och det är en av sakerna vi gärna vill ha juryns syn på.

### Om funktioner — vad man kan och inte kan

**"Vad händer om soldaterna slutar svara?"**
> Befälet får en notis när en enhet legat under 50 procents svarsfrekvens.
> Men appen påminner inte de värnpliktiga själva — det finns ingen notis,
> inget SMS. Det är den största luckan i dag, och den vi helst vill ha hjälp
> att tänka kring: vad är rätt sätt att påminna utan att det blir tjat eller
> tvång?

**"Hur vet ni att någon svarar ärligt?"**
> Det vet vi inte, och appen kan inte veta det. Det enda vi kan göra är att ta
> bort skälen att ljuga: ingen chef ser ditt enskilda svar, ingen kan peka ut
> dig, och det finns ingen påföljd. Erfarenheten från liknande verktyg är att
> ärligheten står och faller med om folk tror på just det — därför är
> integriteten inte bara ett juridiskt krav här, den är funktionen.

**"Reglaget börjar på mitten. Svarar inte alla bara fem rakt igenom?"**
> Det är en risk, och frågan är öppen. Vi har avfärdat två lösningar: att tvinga
> fram en rörelse straffar den som verkligen menar 5, och att tillåta
> överhoppade frågor ger sämre underlag. Ett tredje alternativ vore att börja
> tomt och kräva ett aktivt val — det är just en sådan fråga vi vill ställa
> till er, eftersom ni vet hur en artonåring faktiskt fyller i ett formulär
> klockan sex på morgonen.

**"Kan man rätta ett svar man tryckt fel på?"**
> Ja, samma dag. Den gamla rapporten skrivs över, den dubbleras inte.

**"Var kommer gränsen mellan gult och rött ifrån?"**
> Den är satt i prototypen och har ingen vetenskaplig grund. Det står öppet i
> appen: "Gränserna är preliminära och ska fastställas tillsammans med
> Försvarshälsan." Att fastställa dem är fysioterapeuternas och Försvarshälsans
> uppgift, inte utvecklarens — och det är det värdefullaste ni kan bidra med.

**"Ställer appen diagnoser?"**
> Nej, och den är medvetet formulerad för att inte göra det. Råden är
> normaliserande snarare än medicinska: "Det är inte svaghet — det är så det
> fungerar för alla." Obelagd statistik har plockats bort.
>
> Två formuleringar ligger ändå nära ett medicinskt påstående — en om att
> sömnbrist försämrar omdöme och reaktionsförmåga, och en där ordet "symptom"
> används. Vi vill gärna att ni läser igenom just dem.

**"Vad händer när någon svarar att de mår riktigt dåligt?"**
> Då visas stödkontakter överst, före allt annat: 112, Självmordslinjen 90101,
> 1177 och Jourhavande medmänniska, som klickbara telefonnummer. Ordningen
> anpassas efter vad som är rött, men ingenting tas bort. Dessutom kan soldaten
> be sitt befäl höra av sig, utan att något om måendet följer med.
>
> Försvarshälsan står med i listan men utan telefonnummer — numret skiljer
> mellan förband, och vi vill hellre ha en lucka än ett gissat nummer. Det
> fylls i per förband.

**"Fungerar den utan täckning, ute i fält?"**
> Nej. Utan uppkoppling går det inte att rapportera. Appen säger numera ifrån
> ordentligt i stället för att hänga sig, och svaren ligger kvar så man kan
> trycka igen när täckningen kommer tillbaka — men den sparar inte lokalt och
> skickar senare. Det är en känd begränsning.

**"Är det en app man laddar ner?"**
> Nej, det är en webbsida man öppnar i telefonen. Det gör att den fungerar på
> både iPhone och Android utan installation, och att uppdateringar slår igenom
> direkt.

**"Finns den på andra språk?"**
> Nej, bara svenska i dag.

**"Vad ser en bataljonschef som inte en plutonchef ser?"**
> Samma sorts vy, på sin egen nivå. Plutonchefen jämför sina grupper,
> kompanichefen sina plutoner, bataljonschefen sina kompanier. Ingen ser uppåt
> eller i sidled — bara nedåt i sin egen del av organisationen.

**"Kan man få ut siffrorna till Excel?"**
> Ja, befäl kan exportera sin egen enhets siffror som CSV, och skriva ut en
> rapport. Även där gäller samma skydd: bara sammanställda tal, och det som är
> för tunt underlag kommer ut som tomma fält.

---

## De tre svagaste punkterna — förbered dessa särskilt

1. **Reglaget som börjar på 5.** Du har ingen lösning. Bästa hållningen är att
   lägga fram problemet som en fråga till juryn, inte att försvara nuläget.
2. **Ingen påminnelse.** Hela värdet bygger på daglig rapportering, och det
   finns inget som får den att ske. Säg det själv, före någon annan.
3. **Soldatens vy saknar brasklapp.** Befälet får veta att gränserna är
   preliminära. Den värnpliktige möts av ordet "kritisk nivå" utan reservation.

I alla tre fallen är det starkaste draget detsamma: nämn dem självmant. En jury
som hittar en brist du dolt litar inte på resten. En jury som hör dig lägga fram
den själv litar på allt annat du säger.

---

## Innan visningen

- Tryck på **"Flytta fram demodatan"** på statussidan. Demodatan står still
  medan kalendern går — efter en vecka är befälsvyns förvalda period tom.
- Kör `npm run rundtur`. Den tar en minut, loggar in som alla fem konton och
  kontrollerar bland annat att inga enskilda namn läcker i befälsvyerna.
- Förbered att visa: incheckningen, soldatens återkoppling, stödblocket vid
  röda värden, de tre befälsnivåerna, jämförelserutnätet, och en enhet där det
  står "Underlag saknas" — den sista är den bästa demonstrationen av
  integriteten som finns.
