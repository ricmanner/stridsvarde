/**
 * Tester för rådgivningen till soldaten.
 *
 * Det som prövas här är inte formuleringar utan prioritering: att det som kan
 * skada mest hamnar först, och att inget oväsentligt får stå bredvid något
 * akut. Formuleringarna får ändras fritt — ordningen får inte.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import './setup.mjs';

const alla = (v) => ({ fysisk: v, psykisk: v, social: v, somn: v, kost: v, energi: v });

test('psykisk hälsa går först när flera värden är lika låga', async () => {
  const { getSoldierTips } = await import('../src/lib/advice.ts');

  // Alla kategorier exakt lika. Utan prioritering avgjorde objektets
  // nyckelordning, och soldaten möttes av råd om fysisk vila trots att den
  // psykiska hälsan var precis lika kritisk.
  const tips = getSoldierTips(alla(2));

  assert.equal(tips[0].category, 'psykisk', 'psykisk hälsa ska vara första kortet vid lika värden');
  assert.ok(
    tips[0].why.length > 0,
    'kortet ska förklara vad värdet betyder, inte bara lista åtgärder',
  );
});

test('förklaring och åtgärder säger inte samma sak', async () => {
  const { getSoldierTips } = await import('../src/lib/advice.ts');

  /*
   * Tidigare fanns en prosatext och en punktlista som båda delade ut råd.
   * Elva av tolv kombinationer upprepade sig — en soldat med lågt socialt
   * värde läste "berätta för ditt befäl" två gånger i rad, och för energi på
   * gul nivå sa alla tre punkterna exakt det stycket ovanför redan sagt.
   */
  const bra = { fysisk: 8, psykisk: 8, social: 8, somn: 8, kost: 8, energi: 8 };
  const nyckelord =
    /\b(befäl|kurator|vila|koffein|frukost|vatten|promenad|mellanmål|kamrat|sjukvårdsutbildad|skärmar)\b/g;

  for (const cat of ['fysisk', 'psykisk', 'social', 'somn', 'kost', 'energi']) {
    for (const värde of [5, 2]) {
      const tip = getSoldierTips({ ...bra, [cat]: värde })[0];
      const why = tip.why.toLowerCase();

      for (const punkt of tip.tips) {
        const ord = punkt.toLowerCase().match(nyckelord) ?? [];
        const upprepning = ord.find((o) => why.includes(o));
        assert.ok(
          !upprepning,
          `${cat} (${värde}): punkten "${punkt}" upprepar förklaringen (ordet "${upprepning}"). ` +
            'Förklaringen ska säga vad värdet betyder, punkterna vad man gör.',
        );
      }
    }
  }
});

test('vid röda värden visas inga tips om gula områden', async () => {
  const { getSoldierTips } = await import('../src/lib/advice.ts');

  // Psykisk kris (1) plus ett gult socialt värde (4). Tidigare fylldes andra
  // kortet med sociala tips — "bjud en kamrat på middag" bredvid rådet att
  // söka hjälp för psykisk ohälsa.
  const tips = getSoldierTips({ fysisk: 7, psykisk: 1, social: 4, somn: 5, kost: 6, energi: 5 });

  assert.equal(tips.length, 1, 'endast det röda värdet ska ge tips');
  assert.equal(tips[0].category, 'psykisk');
});

test('varje rött värde får ett eget kort — inget utelämnas', async () => {
  const { getSoldierTips } = await import('../src/lib/advice.ts');

  /*
   * Korten var tidigare begränsade till två. En soldat som rapporterat rött
   * på fem kategorier fick då se två av dem, och appen teg om resten — trots
   * att soldaten själv nyss angett dem. Det som är kritiskt ska aldrig tystas
   * bort av ett tak.
   */
  const scores = { fysisk: 2, psykisk: 3, social: 2, somn: 1, kost: 3, energi: 7 };
  const röda = ['fysisk', 'psykisk', 'social', 'somn', 'kost'];

  const tips = getSoldierTips(scores);
  const kategorier = tips.map((t) => t.category);

  assert.equal(tips.length, röda.length, 'alla fem röda ska ge varsitt kort');
  for (const r of röda) {
    assert.ok(kategorier.includes(r), `${r} är rött och måste visas`);
  }
  assert.ok(!kategorier.includes('energi'), 'gröna kategorier ska aldrig ge tips');

  /*
   * Ordningen: lägst värde först, och vid lika värden det som kan skada mest.
   *   somn 1          → lägst
   *   fysisk 2, social 2 → lika; fysisk väger tyngre
   *   psykisk 3, kost 3  → lika; psykisk väger tyngre
   */
  assert.deepEqual(kategorier, ['somn', 'fysisk', 'social', 'psykisk', 'kost']);
});

test('psykisk hälsa vinner vid lika värden, men går inte före ett lägre', async () => {
  const { getSoldierTips } = await import('../src/lib/advice.ts');

  // Lika: psykisk ska först.
  const lika = getSoldierTips({ fysisk: 2, psykisk: 2, social: 8, somn: 8, kost: 8, energi: 8 });
  assert.equal(lika[0].category, 'psykisk');

  // Inte lika: det lägre värdet går först även om psykisk är röd.
  const olika = getSoldierTips({ fysisk: 1, psykisk: 3, social: 8, somn: 8, kost: 8, energi: 8 });
  assert.equal(olika[0].category, 'fysisk', 'allvarlighet bryter bara lika värden');
});

test('gula områden begränsas fortfarande till två', async () => {
  const { getSoldierTips } = await import('../src/lib/advice.ts');

  // Fyra gula, inget rött. Här handlar det inte om något kritiskt, och att
  // radda upp allt gör mest att man slutar läsa.
  const tips = getSoldierTips({ fysisk: 5, psykisk: 5, social: 5, somn: 5, kost: 8, energi: 8 });
  assert.equal(tips.length, 2, 'gult tak ligger kvar på två');
});

test('den som mår bra får beröm, inte en pekpinne', async () => {
  const { generateSoldierAdvice, getSoldierTips } = await import('../src/lib/advice.ts');

  // Alla värden gröna men olika. Tidigare plockades den lägsta gröna ut och
  // kommenterades, så någon som mådde bra rakt igenom fick ett råd om kost
  // som om det vore ett problem.
  const scores = { fysisk: 8, psykisk: 8, social: 9, somn: 8, kost: 7, energi: 8 };

  assert.equal(getSoldierTips(scores).length, 0, 'inget att åtgärda ska ge noll tips');

  const text = generateSoldierAdvice(scores);
  assert.ok(text.includes('samtliga kategorier'), 'ska bekräfta att allt ser bra ut');
  assert.ok(
    !text.includes('mellanmål') && !text.includes('kolhydratrikt'),
    'ska inte ge råd om den lägsta gröna kategorin som om den vore ett problem',
  );
});

test('sammanfattningen påstår aldrig ett annat antal än vad som visas', async () => {
  const { generateSoldierAdvice, getSoldierTips } = await import('../src/lib/advice.ts');

  /*
   * Felet som gav upphov till testet: texten sa "ett värde ligger på en nivå
   * som behöver åtgärdas" medan två kort visades. Summeringen och korten
   * räknade oberoende av varandra, så de kunde säga emot varandra.
   *
   * Här prövas varenda kombination av grön, gul och röd över sex kategorier —
   * 729 fall. Räcker för att fånga varje gräns.
   */
  const cats = ['fysisk', 'psykisk', 'social', 'somn', 'kost', 'energi'];
  const nivåer = [8, 5, 2]; // grön, gul, röd

  let prövade = 0;

  const gåIgenom = (i, scores) => {
    if (i === cats.length) {
      prövade++;
      const text = generateSoldierAdvice(scores);
      const antal = getSoldierTips(scores).length;

      if (/\bett värde\b|\bEtt område\b|\bOmrådet nedan\b/.test(text)) {
        assert.equal(antal, 1, `"${text}" lovar ett kort men ${antal} visas: ${JSON.stringify(scores)}`);
      }
      if (/\bTvå av dina värden\b|\bTvå områden\b|\bde två områdena\b/.test(text)) {
        assert.equal(antal, 2, `"${text}" lovar två kort men ${antal} visas: ${JSON.stringify(scores)}`);
      }
      if (text.includes('samtliga kategorier')) {
        assert.equal(antal, 0, 'beröm för allt grönt får inte visas tillsammans med tipskort');
      }
      return;
    }
    for (const v of nivåer) gåIgenom(i + 1, { ...scores, [cats[i]]: v });
  };

  gåIgenom(0, {});
  assert.equal(prövade, 3 ** 6, 'alla kombinationer ska ha prövats');
});

test('ett enskilt rött värde skiljs från en bred nedgång', async () => {
  const { generateSoldierAdvice } = await import('../src/lib/advice.ts');

  const ettRött = generateSoldierAdvice({ fysisk: 8, psykisk: 8, social: 8, somn: 2, kost: 8, energi: 8 });
  const alltRött = generateSoldierAdvice(alla(2));

  assert.notEqual(
    ettRött.slice(0, 40),
    alltRött.slice(0, 40),
    'ett dåligt område och sex dåliga områden ska inte mötas av samma inledning',
  );
  assert.ok(alltRött.includes('flera håll'), 'en bred nedgång ska bemötas som just det');
});
