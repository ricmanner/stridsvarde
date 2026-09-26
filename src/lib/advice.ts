import { CATEGORIES, type Category, getStatus, type Status } from './data';

/*
 * Vad ett värde BETYDER — inte vad man ska göra åt det.
 *
 * Tidigare fanns en prosatext per kategori som också delade ut råd, samtidigt
 * som tipspunkterna gjorde detsamma. Elva av tolv kombinationer upprepade sig
 * därför, och för energi på gul nivå sa alla tre punkterna exakt det stycket
 * ovanför redan sagt. Två textblock hade samma uppgift.
 *
 * Nu har de olika: den här texten förklarar läget, punkterna nedan säger vad
 * man gör. Därför står det inga uppmaningar här — de hör hemma i punkterna.
 */
const categoryContext: Record<Category, { yellow: string; red: string }> = {
  fysisk: {
    yellow: 'Belastningen är hög i förhållande till din återhämtning. Kroppen hinner inte ikapp mellan passen.',
    red: 'Kroppen signalerar att något behöver åtgärdas. Kör du vidare som vanligt riskerar du en skada som tar veckor i stället för dagar.',
  },
  psykisk: {
    yellow: 'Mental belastning smyger sig på. Den är betydligt lättare att vända nu än om några veckor.',
    red: 'Det här är en nivå där du behöver stöd från någon annan. Det är inte svaghet — det är så det fungerar för alla.',
  },
  social: {
    yellow: 'Att känna sig lite utanför är vanligare än nästan alla tror. De flesta i din grupp har haft samma känsla utan att säga det.',
    red: 'Att inte trivas i gruppen tär på allt annat: sömnen, orken, motivationen. Det är inget du ska behöva lösa på egen hand.',
  },
  somn: {
    yellow: 'Sömnen räcker inte till för den belastning du har just nu.',
    red: 'Sömnbrist på den här nivån försämrar omdöme och reaktionsförmåga mätbart, och ökar risken för olyckor i tjänst.',
  },
  kost: {
    yellow: 'Du får i dig mindre än kroppen gör av med.',
    red: 'Otillräckligt matintag slår mot allt på en gång: ork, fokus och återhämtning. Under tjänst är det ingen detalj.',
  },
  energi: {
    yellow: 'Energin ligger under din normala nivå.',
    red: 'Så här låg energi är nästan alltid ett symtom på något annat — sömn, mat, sjukdom eller stress.',
  },
};

// Short, specific action tips for the tip cards
const actionTips: Record<Category, Record<Status, string[]>> = {
  fysisk: {
    green: ['Stretcha 5–10 min efter varje pass', 'Drick 2–3 liter vatten om dagen'],
    yellow: ['Sänk intensiteten i nästa träningspass', 'Gör 5 min rörlighetsträning i kväll', 'Välj vila framför extra rep om du är osäker'],
    red: ['Vila från tung belastning idag', 'Kontakta kompaniets sjukvårdare', 'Informera din gruppchef om besvären'],
  },
  psykisk: {
    green: ['Ta 2 min djupandning om stressen ökar', 'Håll kontakten med kamrater — det skyddar'],
    yellow: ['Prata med en kamrat du litar på idag', 'Fysisk aktivitet hjälper mot stress — ta en promenad', 'Sätt av 10 min tid för dig själv i kväll'],
    red: ['Prata med ditt befäl eller en kurator idag', 'Du behöver inte berätta allt — bara att du behöver stöd', 'Kontakta krisstöd om det känns akut'],
  },
  social: {
    green: ['Bjud in någon som verkar utanför till nästa aktivitet', 'Engagemang i gruppen stärker din egen hälsa'],
    yellow: ['Ät middag med en kamrat idag', 'Ta initiativet — de flesta väntar på att någon ska ta det', 'Delta i gruppaktiviteter även om du inte är sugen'],
    red: ['Berätta för ditt befäl hur du har det', 'Det är befälets ansvar att säkerställa trivsel — du gör rätt som säger till', 'Välj en person du litar på och prata'],
  },
  somn: {
    green: ['Undvik skärmar 30 min innan sänggående', 'Håll samma sovtider även på lediga dagar'],
    yellow: ['Inget koffein efter kl 14', 'Mörklägg logementet så mycket som möjligt', 'Sätt undan mobilen en timme innan läggdags'],
    red: ['Informera ditt befäl om sömnproblemen', 'Undvik koffein helt de närmaste dagarna', 'Be om hjälp med eventuella störningar i sovmiljön'],
  },
  kost: {
    green: ['Ät inom 30 min efter träning för snabbare återhämtning', 'Variera kostens sammansättning under dagen'],
    yellow: ['Hoppa inte över frukost — det kostar för mycket senare', 'Ät minst 3 ordentliga mål om dagen', 'Ha alltid ett litet mellanmål tillgängligt'],
    red: ['Berätta för ditt befäl om kostproblemen', 'Ät vad du kan, när du kan — något är bättre än inget', 'Kontrollera att du inte missar måltider p.g.a. schema'],
  },
  energi: {
    green: ['Håll koll på vätskeintaget under hela dagen', 'Kort promenad i friska luften ökar energin snabbt'],
    yellow: ['Drick ett stort glas vatten nu', 'Ät ett litet mellanmål inom nästa timme', 'Ta en 5–10 min promenad utomhus'],
    red: ['Vila — tvinga inte kroppen idag', 'Berätta för din gruppchef om du mår dåligt', 'Ät och drick regelbundet även om du inte är hungrig'],
  },
};

export interface SoldierTip {
  category: Category;
  title: string;
  /** Vad värdet betyder. Ingen uppmaning — den ligger i `tips`. */
  why: string;
  /** Konkreta saker att göra. */
  tips: string[];
}

/**
 * Kategorinamnen kommer ur CATEGORIES, inte ur en egen lista.
 *
 * Här stod tidigare en andra uppsättning — "Fysisk hälsa" mot frågans "Fysisk
 * form", "Kost" mot "Kost och näring". Tipskortet och frågan det handlade om
 * hette alltså olika på samma sida, och ett nytt namn på en kategori hade
 * behövt ändras på två ställen för att inte glida isär.
 */
const catLabel = Object.fromEntries(
  CATEGORIES.map((c) => [c.key, c.label]),
) as Record<Category, string>;

/**
 * Ordning när flera kategorier har samma värde.
 *
 * Utan den avgjorde objektets nyckelordning vilken kategori som blev
 * huvudbudskap. En soldat som svarade 2 på allt — inklusive psykisk hälsa —
 * möttes då av råd om att vila från tung belastning, medan den psykiska
 * krisen hamnade längre ned. Vid lika värden ska det som kan skada mest väga
 * tyngst, inte det som råkar stå först i koden.
 */
const SEVERITY: Category[] = ['psykisk', 'fysisk', 'somn', 'social', 'energi', 'kost'];

function byUrgency(scores: Record<Category, number>): [Category, number][] {
  return (Object.entries(scores) as [Category, number][]).sort(
    (a, b) => a[1] - b[1] || SEVERITY.indexOf(a[0]) - SEVERITY.indexOf(b[0]),
  );
}

/**
 * Tipskort för det som behöver åtgärdas.
 *
 * Finns röda värden visas ENBART röda. Tidigare fylldes listan ut med näst
 * sämsta kategori oavsett nivå, vilket gav en soldat i psykisk kris ett kort
 * om att bjuda en kamrat på middag bredvid rådet att söka hjälp. Det drar ned
 * allvaret i det som faktiskt är akut.
 */
/**
 * Tak för hur många GULA områden som ger kort.
 *
 * Gäller bara gult. Är något rött visas samtliga röda — se nedan.
 */
const MAX_YELLOW_TIPS = 2;

/**
 * Vilka kategorier som blir kort.
 *
 * Delas av tipskorten och sammanfattningen. Räknade de var för sig kunde de
 * säga emot varandra — och gjorde det: sammanfattningen påstod "ett värde"
 * medan två kort visades.
 *
 * ALLA röda visas. Ett tak hade inneburit att appen tyst utelämnat något
 * kritiskt som soldaten själv rapporterat, och en soldat som svarat rött på
 * sömn ska inte behöva undra varför sömnen inte nämns. Korten kommer i
 * allvarlighetsordning, så det som väger tyngst står först även när listan
 * blir lång.
 *
 * Gult tak kvar: där handlar det om att inte dränka en i övrigt välmående
 * soldat i småsaker.
 */
function relevantCategories(scores: Record<Category, number>): [Category, number][] {
  const sorted = byUrgency(scores);
  const red = sorted.filter(([, score]) => getStatus(score) === 'red');

  if (red.length > 0) return red;
  return sorted.filter(([, s]) => s < 7).slice(0, MAX_YELLOW_TIPS);
}

export function getSoldierTips(scores: Record<Category, number>): SoldierTip[] {
  return relevantCategories(scores).map(([cat, score]) => {
    const status = getStatus(score);
    return {
      category: cat,
      title: catLabel[cat],
      // Grön ger aldrig tips, så bara gul och röd behöver en förklaring.
      why: status === 'red' ? categoryContext[cat].red : categoryContext[cat].yellow,
      tips: actionTips[cat][status],
    };
  });
}

/**
 * Sammanfattar helhetsbilden.
 *
 * Nämner medvetet ingen enskild kategori — den detaljen bärs av tipskorten
 * strax under, och att säga samma sak två gånger i rad får det andra kortet
 * att kännas överflödigt. Här står bara hur det ser ut totalt sett.
 */
export function generateSoldierAdvice(scores: Record<Category, number>): string {
  const values = Object.values(scores);
  const overall = values.reduce((a, b) => a + b, 0) / values.length;
  const [, worstScore] = byUrgency(scores)[0];
  const status = getStatus(worstScore);

  /*
   * Är inget ens gult finns inget att åtgärda. Tidigare plockades ändå den
   * lägsta gröna kategorin ut och kommenterades, så någon som mådde bra rakt
   * igenom fick en pekpinne om kosthållning utan att ha frågat. Beröm den som
   * sköter sig i stället — det är också vägledning.
   */
  if (status === 'green') {
    return (
      'Du rapporterar bra värden i samtliga kategorier idag. Det är inte en ' +
      'slump utan resultatet av rutiner som fungerar — sömn, mat och ' +
      'återhämtning. Håll fast vid dem, särskilt när tempot går upp.'
    );
  }

  // Antalet kort som faktiskt visas. Texten måste stämma med skärmen.
  const shown = relevantCategories(scores).length;

  if (status === 'red') {
    if (shown === 1) {
      return 'Det mesta ser rimligt ut, men ett värde ligger på en nivå som behöver åtgärdas nu. Det står nedan.';
    }
    if (shown === 2) {
      return 'Två av dina värden ligger på en nivå som behöver åtgärdas nu. Båda står nedan.';
    }
    /*
     * Vid tre eller fler nämns inget antal. Att skriva ut "fem av dina värden"
     * till någon som redan mår dåligt lägger bara på tyngd utan att hjälpa —
     * och korten nedan visar ändå exakt vilka de är.
     */
    return (
      'Du rapporterar låga värden på flera håll samtidigt. Det är för mycket ' +
      'att bära själv, och du behöver inte göra det. Allt står nedan, ordnat ' +
      'efter hur akut det är — börja med det första.'
    );
  }

  if (overall >= 6) {
    return shown === 1
      ? 'Du ligger bra överlag. Ett område släpar efter — det är värt att fånga upp innan det blir större.'
      : 'Du ligger bra överlag. Två områden släpar efter — värda att fånga upp innan de blir större.';
  }

  return shown === 1
    ? 'Ditt mående är ojämnt idag. Området nedan ligger lägst — ta det först.'
    : 'Ditt mående är ojämnt idag. Ta de två områdena nedan i tur och ordning; resten brukar följa med.';
}

/**
 * Råd till befäl, baserat enbart på enhetens egna aggregerade värden.
 *
 * Tidigare versioner innehöll siffror som "tre gånger högre risk för avbrott"
 * och "minskar avbrott med upp till 40 procent (FoT 2023)". De gick inte att
 * belägga. Att presentera obelagd statistik som beslutsunderlag för ett befäl
 * som ska fatta beslut om människor är inte försvarbart — särskilt inte i ett
 * system som ska granskas av Försvarsmakten. Råden nedan beskriver vad datan
 * visar och vad man kan göra åt det, utan att åberopa forskning vi inte har.
 */
export function generateLeaderAdvice(avgScores: Record<Category, number>): string {
  const overall = Object.values(avgScores).reduce((a, b) => a + b, 0) / Object.values(avgScores).length;
  const redCount = Object.values(avgScores).filter(v => getStatus(v) === 'red').length;

  if (redCount >= 2) {
    return `Enheten ligger på kritisk nivå i ${redCount} kategorier. Det är ett tydligt tecken på att belastningen behöver ses över. Rekommendation: genomför enskilda samtal inom 48 timmar och justera träningsbelastningen tills värdena vänder.`;
  }
  if (getStatus(overall) === 'green') {
    return `Enheten rapporterar genomgående god hälsa. Fortsätt prioritera återhämtning och sammanhållning — det är de faktorer som är lättast att tappa när tempot ökar.`;
  }
  return `Enheten visar varierat mående utan kritiska nivåer. Håll koll på de kategorier som ligger gult och fånga upp dem tidigt, innan de utvecklas åt fel håll.`;
}
