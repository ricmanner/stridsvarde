import { Category, getStatus, Status } from './data';

// Main advice per category — full sentence, context-aware
const soldierAdvice: Record<Category, Record<Status, string>> = {
  fysisk: {
    green: 'Din kropp håller sig bra. Kom ihåg att stretcha 5–10 minuter efter träning och dricka minst 2 liter vatten per dag.',
    yellow: 'Du känner av viss fysisk belastning. Ta det lugnare med intensiteten, prioritera rörlighetsövningar och ge kroppen tid att återhämta sig mellan passen.',
    red: 'Du mår fysiskt dåligt och kroppen signalerar att något behöver åtgärdas. Vila från tung belastning och kontakta sjukvårdsutbildad i kompaniet — tidig åtgärd förhindrar längre bortfall.',
  },
  psykisk: {
    green: 'Du hanterar belastningen bra mentalt. Regelbundna rutiner, rörelse och kontakt med kamrater håller huvudet i trim — fortsätt med det.',
    yellow: 'Du visar tecken på mental stress. Prata med en kamrat du litar på, ta korta pauser under dagen och håll sömnrutinerna stabila. Det räcker långt.',
    red: 'Din mentala hälsa behöver stöd nu. Det är styrka att söka hjälp — prata med befäl eller kompaniets kurator. Du behöver inte bära detta ensam.',
  },
  social: {
    green: 'Du trivs bra i gruppen. Din närvaro och engagemang smittar av sig — fortsätt vara en del av gemenskapen.',
    yellow: 'Du verkar ha det lite svårt socialt just nu. Ta initiativet och bjud in en kamrat till middagen eller en kortare aktivitet — det brukar lossna snabbt.',
    red: 'Du mår dåligt i gruppen och det påverkar dig. Berätta för ditt befäl — de kan hjälpa dig utan att det behöver bli en stor grej.',
  },
  somn: {
    green: 'Du sover bra och det syns på prestationen. Håll skärmar borta 30 minuter innan läggdags och behåll samma sovtider även på lediga dagar.',
    yellow: 'Din sömn är inte optimal. Undvik koffein efter kl 14, mörklägg sovrummet och försök lägga dig samma tid varje kväll. Tre nätter med bättre sömn gör stor skillnad.',
    red: 'Du sover mycket dåligt och det är allvarligt — sömnbrist ökar skaderisken och försämrar beslutförmågan kraftigt. Informera ditt befäl så att ni kan hitta en lösning.',
  },
  kost: {
    green: 'Du äter bra och ger kroppen rätt bränsle. Ät ett litet kolhydratrikt mellanmål inom 30 minuter efter tung träning för snabbare återhämtning.',
    yellow: 'Din kost kan förbättras. Hoppa inte över frukost eller lunch — det slår direkt på energi och koncentration under resten av dagen.',
    red: 'Du äter otillräckligt och det påverkar allt: energi, fokus och skadeprevention. Berätta för befäl om det finns praktiska hinder — tillräckligt matintag är inte valfritt under tjänst.',
  },
  energi: {
    green: 'Du har god energi. Håll koll på vätskeintaget — dehydrering är den vanligaste och enklaste orsaken till energitapp under tjänst.',
    yellow: 'Din energi är lägre än normalt. Drick mer vatten, ät ett litet mellanmål och ta en kort 5–10 minuters promenad om du kan — det hjälper mer än du tror.',
    red: 'Du har extremt låg energi vilket kan vara tecken på sjukdom, överträning eller sömnbrist. Vila och berätta för din lagledare om det inte förbättras.',
  },
};

// Short, specific action tips for the tip cards
const actionTips: Record<Category, Record<Status, string[]>> = {
  fysisk: {
    green: ['Stretcha 5–10 min efter varje pass', 'Drick 2–3 liter vatten om dagen'],
    yellow: ['Sänk intensiteten i nästa träningspass', 'Gör 5 min rörlighetsträning i kväll', 'Välj vila framför extra rep om du är osäker'],
    red: ['Vila från tung belastning idag', 'Kontakta sjukvårdsutbildad i kompaniet', 'Informera din lagledare om besvären'],
  },
  psykisk: {
    green: ['Ta 2 min djupandning om stressen ökar', 'Håll kontakten med kamrater — det skyddar'],
    yellow: ['Prata med en kamrat du litar på idag', 'Fysisk aktivitet hjälper mot stress — ta en promenad', 'Sätt av 10 min tid för dig själv i kväll'],
    red: ['Prata med befäl eller kurator idag', 'Du behöver inte berätta allt — bara att du behöver stöd', 'Kontakta krisstöd om det känns akut'],
  },
  social: {
    green: ['Bjud in någon som verkar utanför till nästa aktivitet', 'Engagemang i gruppen stärker din egen hälsa'],
    yellow: ['Bjud en kamrat till middagen idag', 'Ta initiativet — de flesta väntar på att någon ska ta det', 'Delta i gruppaktiviteter även om du inte är sugen'],
    red: ['Berätta för befäl hur du har det', 'Det är befälets ansvar att säkerställa trivsel — du gör rätt som säger till', 'Välj en person du litar på och prata'],
  },
  somn: {
    green: ['Undvik skärmar 30 min innan sänggående', 'Håll samma sovtider även på lediga dagar'],
    yellow: ['Inget koffein efter kl 14', 'Mörklägg sovrummet så mycket som möjligt', 'Sätt undan mobilen en timme innan läggdags'],
    red: ['Informera befäl om sömnproblemen', 'Undvik koffein helt de närmaste dagarna', 'Be om hjälp med eventuella störningar i sovmiljön'],
  },
  kost: {
    green: ['Ät inom 30 min efter träning för snabbare återhämtning', 'Variera kostens sammansättning under dagen'],
    yellow: ['Hoppa inte över frukost — det kostar för mycket senare', 'Ät minst 3 ordentliga mål om dagen', 'Ha alltid ett litet mellanmål tillgängligt'],
    red: ['Berätta för befäl om kostproblemen', 'Ät vad du kan, när du kan — något är bättre än inget', 'Kontrollera att du inte missar måltider p.g.a. schema'],
  },
  energi: {
    green: ['Håll koll på vätskeintaget under hela dagen', 'Kort promenad i friska luften ökar energin snabbt'],
    yellow: ['Drick ett stort glas vatten nu', 'Ät ett litet mellanmål inom nästa timme', 'Ta en 5–10 min promenad utomhus'],
    red: ['Vila — tvinga inte kroppen idag', 'Berätta för lagledaren om du mår dåligt', 'Ät och drick regelbundet även om du inte är hungrig'],
  },
};

export interface SoldierTip {
  category: Category;
  title: string;
  tips: string[];
}

const catLabel: Record<Category, string> = {
  fysisk: 'Fysisk hälsa',
  psykisk: 'Psykisk hälsa',
  social: 'Social hälsa',
  somn: 'Sömn',
  kost: 'Kost',
  energi: 'Energi',
};

export function getSoldierTips(scores: Record<Category, number>): SoldierTip[] {
  const entries = (Object.entries(scores) as [Category, number][])
    .sort((a, b) => a[1] - b[1])
    .filter(([, score]) => score < 7)
    .slice(0, 2);

  return entries.map(([cat, score]) => ({
    category: cat,
    title: catLabel[cat],
    tips: actionTips[cat][getStatus(score)],
  }));
}

export function generateSoldierAdvice(scores: Record<Category, number>): string {
  const overall = Object.values(scores).reduce((a, b) => a + b, 0) / Object.values(scores).length;
  const entries = (Object.entries(scores) as [Category, number][]).sort((a, b) => a[1] - b[1]);
  const [worstCat, worstScore] = entries[0];
  const status = getStatus(worstScore);

  let intro = '';
  if (overall >= 7) intro = 'Du rapporterar ett bra mående idag. ';
  else if (overall >= 5) intro = 'Ditt mående är varierat — fokusera på ditt svagaste område. ';
  else intro = 'Du mår tufft på flera fronter. Kom ihåg att det är okej att söka hjälp. ';

  return `${intro}${soldierAdvice[worstCat][status]}`;
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
  const redCount = Object.values(avgScores).filter(v => v < 4).length;

  if (redCount >= 2) {
    return `Enheten ligger på kritisk nivå i ${redCount} kategorier. Det är ett tydligt tecken på att belastningen behöver ses över. Rekommendation: genomför enskilda samtal inom 48 timmar och justera träningsbelastningen tills värdena vänder.`;
  }
  if (overall >= 7) {
    return `Enheten rapporterar genomgående god hälsa. Fortsätt prioritera återhämtning och sammanhållning — det är de faktorer som är lättast att tappa när tempot ökar.`;
  }
  return `Enheten visar varierat mående utan kritiska nivåer. Håll koll på de kategorier som ligger gult och fånga upp dem tidigt, innan de utvecklas åt fel håll.`;
}
