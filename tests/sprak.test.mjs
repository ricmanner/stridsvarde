/**
 * Språket i gränssnittet.
 *
 * Två fel som fanns i adminvyn och som testerna nedan låser:
 *
 *  1. Nivåordet byggdes mekaniskt av enhetens sort plus "snivå". Det blir
 *     rätt för bataljon och pluton men fel för de andra två — "kompanisnivå"
 *     i stället för kompaninivå, "gruppsnivå" i stället för gruppnivå. Värst
 *     var att appen därmed motsade sig själv: kompanichefens egen vy har
 *     rubriken "Kompaninivå".
 *  2. Raderingsrutan satte komma före "och" i en uppräkning, och med både
 *     underenheter och personer blev det två "och" tätt intill varandra.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

import './setup.mjs';

test('nivåordet stavas som i befälsvyernas egna rubriker', async () => {
  const { NIVÅORD, nivåRubrik } = await import('../src/lib/unit-names.ts');

  assert.equal(NIVÅORD.bataljon, 'bataljonsnivå');
  assert.equal(NIVÅORD.kompani, 'kompaninivå', 'kompani böjs utan foge-s');
  assert.equal(NIVÅORD.pluton, 'plutonsnivå');
  assert.equal(NIVÅORD.grupp, 'gruppnivå', 'grupp böjs utan foge-s');

  assert.equal(nivåRubrik('kompani'), 'Kompaninivå');

  /*
   * Rubrikerna i befälsvyerna ska komma ur samma ord. Stod de kvar som egna
   * strängar kunde de glida isär igen — och det var just isärglidningen som
   * gjorde felet synligt: rubriken sa "Kompaninivå" medan adminvyn sa
   * "kompanisnivå" om samma enhet.
   */
  for (const [sort, fil] of [
    ['bataljon', 'src/app/bataljon/page.tsx'],
    ['kompani', 'src/app/kompani/page.tsx'],
    ['pluton', 'src/app/pluton/page.tsx'],
  ]) {
    const kod = readFileSync(fil, 'utf8');
    assert.ok(
      !/levelLabel="/.test(kod),
      `${fil} har rubriken som egen sträng — den ska hämtas ur NIVÅORD`,
    );
    assert.match(kod, new RegExp(`nivåRubrik\\('${sort}'\\)`), `${fil} ska använda nivåRubrik()`);
  }
});

test('ingen bygger nivåordet med "snivå" längre', async () => {
  /*
   * Regelfelet, inte bara de två stavfelen: så länge någon klistrar på
   * "snivå" efter enhetens sort kommer nästa nivå som läggs till att bli fel
   * igen. Den här kontrollen läser koden, för det är formen som är felet.
   */
  const filer = [
    'src/app/admin/UnitDetail.tsx',
    'src/lib/db/queries/admin.ts',
    'src/components/leader/LeaderPageShell.tsx',
  ];

  for (const fil of filer) {
    const kod = readFileSync(fil, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    assert.ok(
      !/\}snivå|['"`]snivå/.test(kod),
      `${fil} bygger fortfarande nivåordet av sort + "snivå"`,
    );
  }
});

test('en uppräkning får komma mellan leden och "och" före det sista', async () => {
  const { uppräkning } = await import('../src/lib/format.ts');

  // Fallet som stod i raderingsrutan: "2 personer, och alla deras rapporter".
  assert.equal(uppräkning(['2 personer', 'alla deras rapporter']), '2 personer och alla deras rapporter');

  // Och fallet med tre led, som gav två "och" efter varandra.
  assert.equal(
    uppräkning(['1 underenhet', '2 personer', 'alla deras rapporter']),
    '1 underenhet, 2 personer och alla deras rapporter',
  );

  assert.equal(uppräkning(['1 underenhet']), '1 underenhet');
  assert.equal(uppräkning([]), '');
});

/*
 * Genus: kompani är ett neutrum bland tre utrum.
 *
 * Samma sorts fel som "kompanisnivå", och av samma orsak: en mening byggdes
 * av enhetens sort plus ett böjt ord. Det blev "Ny kompani", "Jämför en
 * kompani" och "Kompaniet är tom. Den tas bort permanent." — tre ställen där
 * bataljonschefen och administratören möttes av fel svenska. Formerna står nu
 * i ordformer(), som NIVÅORD, och kontrollerna nedan läser koden eftersom det
 * är formen som är felet.
 */
test('enhetssorternas böjda ordformer står på ett ställe', async () => {
  const { ordformer } = await import('../src/lib/unit-names.ts');

  assert.equal(ordformer('kompani').artikel, 'ett', 'ett kompani');
  assert.equal(ordformer('bataljon').artikel, 'en');
  assert.equal(ordformer('pluton').artikel, 'en');
  assert.equal(ordformer('grupp').artikel, 'en');

  assert.equal(ordformer('kompani').ny, 'Nytt', 'Nytt kompani');
  assert.equal(ordformer('pluton').ny, 'Ny');

  assert.equal(ordformer('kompani').tom, 'tomt', 'kompaniet är tomt');
  assert.equal(ordformer('grupp').tom, 'tom');

  assert.equal(ordformer('kompani').pronomen, 'det', 'allt som ligger under det');
  assert.equal(ordformer('pluton').pronomen, 'den');
});

test('ingen bygger en mening av enhetens sort plus ett böjt ord', () => {
  const utanKommentarer = (fil) =>
    readFileSync(fil, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

  const detalj = utanKommentarer('src/app/admin/UnitDetail.tsx');
  assert.ok(!/Ny \{childKind\}/.test(detalj), 'rubriken för ny underenhet böjer inte "ny" efter sorten');
  assert.match(detalj, /ordformer\(/, 'UnitDetail ska hämta formerna ur ordformer()');

  const radering = utanKommentarer('src/app/admin/UnitDeleteSection.tsx');
  assert.ok(!/preview\.name\} är tom\b/.test(radering), '"2. Kompaniet är tom" böjer fel');
  assert.ok(!/under den/.test(radering), '"under den" gäller inte ett kompani');
  assert.match(radering, /ordformer\(/, 'raderingsrutan ska hämta formerna ur ordformer()');

  const sida = utanKommentarer('src/app/admin/page.tsx');
  assert.ok(
    !/låg under den/.test(sida),
    'beskedet efter en radering säger "allt som låg under den" om ett kompani också',
  );

  const befalsvy = utanKommentarer('src/components/leader/LeaderDashboard.tsx');
  assert.ok(!/Jämför en \{/.test(befalsvy), 'artikeln får inte stå fast — ett kompani, en pluton');
});

test('adminvyns antal böjs med antal(), inte med ett fast plural', () => {
  const utanKommentarer = (fil) =>
    readFileSync(fil, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

  const detalj = utanKommentarer('src/app/admin/UnitDetail.tsx');
  assert.ok(!/'incheckningar'\} raderade/.test(detalj), 'raderade incheckningar böjs efter talet');
  assert.ok(!/rapporter raderade`/.test(detalj), 'raderade rapporter böjs efter talet');

  const sida = utanKommentarer('src/app/admin/page.tsx');
  assert.ok(!/poster är äldre/.test(sida), 'gallringsrutan böjs efter talet');

  for (const [fil, kod] of [['UnitDetail.tsx', detalj], ['page.tsx', sida]]) {
    assert.match(kod, /antal\(/, `${fil} ska använda antal() ur lib/format.ts`);
  }
});

/*
 * Resten av böjningsfelen i gränssnittet.
 *
 * Tre av dem är obestämd form där svenskan kräver bestämd, och ett är ett
 * verb som saknade sitt s: framflyttningen kör inte, den körs.
 */
test('böjningen stämmer i den värnpliktiges vy och i incheckningen', async () => {
  const { CATEGORIES } = await import('../src/lib/data.ts');

  const somn = CATEGORIES.find((c) => c.key === 'somn');
  assert.equal(somn.question, 'Hur sov du i natt?', 'natten som gick är "i natt", inte "igår natt"');
  for (const c of CATEGORIES) {
    assert.ok(!/igår natt/.test(c.question), `${c.key} säger fortfarande "igår natt"`);
  }

  const vy = readFileSync('src/app/soldat/dashboard/DashboardClient.tsx', 'utf8');
  assert.ok(!/>Senaste värde</.test(vy), 'efter en superlativ står substantivet i bestämd form');
  assert.match(vy, />Senaste värdet</, 'Senaste värdet');
});

test('statussidan säger att framflyttningen körs, inte att den kör', async () => {
  const { beskrivNattkorning } = await import('../src/lib/db/demo-timeline.ts');

  const aldrig = beskrivNattkorning({ hemlighetSatt: true, senaste: null });
  assert.match(aldrig.text, /har inte körts/, 'framflyttningen körs av klockan, den kör inte själv');
  assert.ok(!/har inte kört ännu/.test(aldrig.text));
});

test('nattkörningens egen rad böjer dagarna efter talet', async () => {
  const kod = readFileSync('src/lib/db/demo-timeline.ts', 'utf8');
  assert.ok(
    !/\$\{dagar\} dagar fram/.test(kod),
    'en natt som flyttar en dag loggade "historiken flyttad 1 dagar fram" — och raden visas på statussidan',
  );
});

/*
 * Orden i råden till den värnpliktige.
 *
 * Råden läses av någon som just rapporterat låga värden, och de ska låta som
 * förbandet talar. "Lagledare" är idrottsspråk — befälet i en grupp är
 * gruppchefen. En värnpliktig sover i logementet, inte i sovrummet. Och
 * "bjuda en kamrat till middagen" är restaurang; i matsalen äter man middag
 * tillsammans.
 */
test('råden till den värnpliktige använder förbandets ord', async () => {
  const kod = readFileSync('src/lib/advice.ts', 'utf8');

  assert.ok(!/lagledare/.test(kod), 'gruppchef, inte lagledare');
  assert.ok(!/sovrummet/.test(kod), 'logementet, inte sovrummet');
  assert.ok(!/sjukvårdsutbildad/.test(kod), 'kompaniets sjukvårdare är den som finns på plats');
  assert.ok(!/Bjud en kamrat till middagen/.test(kod), 'man äter middag med en kamrat');
  assert.ok(!/symptom/.test(kod), 'symtom är den svenska formen');

  /*
   * Och befälet ska alltid ha sitt "ditt", som överallt annars i appen.
   * "Informera befäl om sömnproblemen" läser som en instruktion ur en
   * handbok, inte som ett råd till en person.
   */
  const { getSoldierTips } = await import('../src/lib/advice.ts');
  const bra = { fysisk: 8, psykisk: 8, social: 8, somn: 8, kost: 8, energi: 8 };

  for (const cat of ['fysisk', 'psykisk', 'social', 'somn', 'kost', 'energi']) {
    for (const värde of [8, 5, 2]) {
      for (const tip of getSoldierTips({ ...bra, [cat]: värde })) {
        for (const punkt of tip.tips) {
          if (!/befäl/.test(punkt)) continue;
          assert.match(punkt, /ditt befäl|befälets/, `"${punkt}" saknar sitt "ditt"`);
        }
      }
    }
  }
});

/** Filens text utan kommentarer — det är bara det som visas som granskas. */
function synligText(fil) {
  return readFileSync(fil, 'utf8')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

/*
 * Samma sak, samma ord.
 *
 * Inget av det här är ett fel i sig — det är appen som säger olika om samma
 * sak på olika ställen, vilket är värre framför någon som inte känner
 * systemet.
 */
test('rollen heter plutonchef, som i lib/roles.ts', () => {
  for (const fil of ['src/app/page.tsx', 'src/app/soldat/dashboard/SupportBlock.tsx']) {
    assert.ok(!/plutonsbefäl/.test(synligText(fil)), `${fil} säger plutonsbefäl`);
  }
});

test('de som rapporterar heter värnpliktiga, inte soldater', () => {
  const kod = synligText('src/lib/db/queries/admin.ts');
  assert.ok(!/Soldater placeras/.test(kod), 'felmeddelandet säger Soldater');
});

test('data räknas som ett ord, inte flera', () => {
  // Fem ställen säger "sammanställd data" och "all data är påhittad". Ett sa
  // "befälet ser inga data" — samma ord, andra numerus.
  const kod = synligText('src/app/soldat/dashboard/DashboardClient.tsx');
  assert.ok(!/inga data/.test(kod), '"inga data" mot "ingen data" på fem andra ställen');
});

test('gränssnittet är på svenska, också på statussidan', () => {
  const kod = synligText('src/app/status/page.tsx');
  assert.ok(!/Foreign keys/.test(kod), 'appens enda engelska etikett');
});

test('adminvyn kallar det en värnpliktig lämnar in för incheckning', () => {
  /*
   * Två rutor intill varandra sa "alla deras rapporter" och "samtliga
   * incheckningar" om exakt samma uppgifter. Adminvyn använder nu ett ord,
   * samma som statussidan räknar. Den värnpliktiges egen vy får fortsätta
   * säga rapport om dagens rapportering — där är det hennes eget ord.
   */
  for (const fil of ['src/app/admin/UnitDetail.tsx', 'src/app/admin/UnitDeleteSection.tsx']) {
    assert.ok(!/rapport/i.test(synligText(fil)), `${fil} säger fortfarande rapport`);
  }
});

test('en kategori har ett namn, hämtat ur CATEGORIES', async () => {
  const { CATEGORIES } = await import('../src/lib/data.ts');
  const { getSoldierTips } = await import('../src/lib/advice.ts');

  // Lågt på allt: då ger varje kategori ett kort, och alla titlar går att läsa.
  const lagt = { fysisk: 2, psykisk: 2, social: 2, somn: 2, kost: 2, energi: 2 };
  const titlar = new Map(getSoldierTips(lagt).map((t) => [t.category, t.title]));

  for (const cat of CATEGORIES) {
    assert.equal(titlar.get(cat.key), cat.label, `${cat.key}: tipskortet ska heta som frågan`);
  }
});

test('alla procenttal går genom procent() i lib/format.ts', () => {
  const fall = [
    ['src/app/soldat/CheckinWizard.tsx', /\* 100\)\}%/],
    ['src/app/soldat/dashboard/DashboardClient.tsx', /value=\{`\$\{freq\.pct\}%`\}/],
    ['src/components/leader/LeaderDashboard.tsx', /today\.pct\}%/],
    ['src/app/rapport/page.tsx', /pct\} %/],
  ];

  for (const [fil, hopklistrat] of fall) {
    const kod = synligText(fil);
    assert.ok(!hopklistrat.test(kod), `${fil} skriver procenttecknet för hand`);
    assert.match(kod, /procent\(/, `${fil} ska använda procent()`);
  }

  // Tabellen i befälsvyn räknar fram sin egen andel och hade samma fel.
  assert.ok(
    !/: 0\}%/.test(synligText('src/components/leader/LeaderDashboard.tsx')),
    'tabellcellen skriver procenttecknet för hand',
  );
});

/*
 * Skrivregler i det som visas.
 *
 * Små tal skrivs med bokstäver i löpande text, förkortningar undviks när
 * ordet är kort ändå, och "innan" binder en sats medan "före" tar ett
 * substantiv: före sänggåendet, inte innan sänggående.
 */
test('skrivreglerna följs i råden och i incheckningen', () => {
  const rad = synligText('src/lib/advice.ts');
  assert.ok(!/\bkl \d/.test(rad), 'klockan skrivs ut');
  assert.ok(!/p\.g\.a\./.test(rad), 'skriv "på grund av"');
  assert.ok(!/innan sänggående|innan läggdags/.test(rad), '"före" tar ett substantiv');
  assert.ok(!/\b\d+ min\b/.test(rad), 'minuter skrivs ut');
  assert.ok(!/minst 3 |Ta 2 |Sätt av 10 /.test(rad), 'små tal med bokstäver');

  const inch = synligText('src/app/soldat/CheckinWizard.tsx');
  assert.ok(!/Besvara 6 frågor|ungefär 2 minuter/.test(inch), 'små tal med bokstäver');

  const login = synligText('src/app/page.tsx');
  assert.ok(!/koden redan rapporterat/.test(login), 'en kod rapporterar inte, en människa gör det');

  const trad = synligText('src/app/admin/UnitTree.tsx');
  assert.ok(!/vpl\.|bef\./.test(trad), 'vpl och bef skrivs utan punkt');
});

test('fliken heter Historik, och perioden är bestämd', () => {
  const vy = synligText('src/app/soldat/dashboard/DashboardClient.tsx');

  assert.ok(!/etikett: 'Historia'/.test(vy), 'Historia är ett skolämne');
  assert.match(vy, /etikett: 'Historik'/);
  assert.ok(!/— senaste 14 dagarna/.test(vy), 'de senaste 14 dagarna, som grafens egen text');
});

/*
 * Färgorden böjs efter antalet.
 *
 * Befälsvyns sammanfattningsrad hade plural inskrivet — "● 1 Gröna ● 22 Gula
 * ● 1 Röda" — och fördelningen under varje kategori likaså: "46 gröna, 96
 * gula, 1 röda". Ettan är inget undantagsfall; en pluton med en enda röd
 * värnpliktig är det vanliga, och det är just den raden ett befäl tittar på.
 *
 * Samma sort som de fyra pluralfelen den 26 september. De hittades genom att
 * läsa JSX-texter; de här stod som `label="Gröna"` och gick därför igenom.
 */
test('färgorden i befälsvyn böjs efter antalet', async () => {
  const { statusOrd } = await import('../src/lib/data.ts');

  assert.equal(statusOrd('green', 1), 'grön');
  assert.equal(statusOrd('green', 2), 'gröna');
  assert.equal(statusOrd('yellow', 1), 'gul');
  assert.equal(statusOrd('yellow', 7), 'gula');
  assert.equal(statusOrd('red', 1), 'röd');
  assert.equal(statusOrd('red', 3), 'röda');

  // Noll tar plural på svenska: "0 röda", som i "0 uppgifter".
  assert.equal(statusOrd('red', 0), 'röda');

  const kod = synligText('src/components/leader/LeaderDashboard.tsx');
  assert.ok(!/label="Gröna"/.test(kod), 'sammanfattningsraden har plural inskrivet');
  assert.ok(!/>gröna</.test(kod), 'fördelningsraden har plural inskrivet');
});

/*
 * Fördelningen under varje kategori säger att den räknar svar.
 *
 * Raden överst räknar personer — var och en en gång, efter sitt eget snitt.
 * Raden under varje kategori räknar svar, och samma person svarar upp till
 * sju gånger på sju dagar. Utan ordet stod "60 röda" under Sömn i en pluton
 * på 40, och "1 Röd" överst på samma skärm. Talen var rätta; läsaren kunde
 * inte veta att de räknade olika saker.
 *
 * "Svar" är neutrum: ett grönt svar, två gröna svar.
 */
test('fördelningen under varje kategori säger att den räknar svar', async () => {
  const { statusSvar } = await import('../src/lib/data.ts');

  assert.equal(statusSvar('green', 1), 'grönt svar');
  assert.equal(statusSvar('green', 32), 'gröna svar');
  assert.equal(statusSvar('yellow', 1), 'gult svar');
  assert.equal(statusSvar('yellow', 60), 'gula svar');
  assert.equal(statusSvar('red', 1), 'rött svar');
  assert.equal(statusSvar('red', 0), 'röda svar');

  const kod = synligText('src/components/leader/LeaderDashboard.tsx');
  assert.match(kod, /statusSvar\('green', d\.green\)/, 'fördelningsraden säger inte vad den räknar');
  assert.ok(!/statusOrd\('green', d\.green\)/.test(kod), 'fördelningsraden använder personordet');
});
