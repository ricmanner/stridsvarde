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
  const { generateSoldierAdvice, getSoldierTips } = await import('../src/lib/advice.ts');

  // Alla kategorier exakt lika. Utan prioritering avgjorde objektets
  // nyckelordning, och soldaten möttes av råd om fysisk vila trots att den
  // psykiska hälsan var precis lika kritisk.
  const tips = getSoldierTips(alla(2));
  assert.equal(tips[0].category, 'psykisk', 'psykisk hälsa ska vara första kortet vid lika värden');

  const text = generateSoldierAdvice(alla(2));
  assert.ok(
    text.includes('mentala hälsa'),
    'huvudbudskapet ska handla om psykisk hälsa, inte om att vila från träning',
  );
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

test('flera röda värden ger tips om de röda, i allvarlighetsordning', async () => {
  const { getSoldierTips } = await import('../src/lib/advice.ts');

  const tips = getSoldierTips({ fysisk: 7, psykisk: 3, social: 7, somn: 2, kost: 3, energi: 6 });
  const kategorier = tips.map((t) => t.category);

  assert.equal(tips.length, 2);
  assert.ok(kategorier.includes('somn'), 'lägsta värdet (sömn 2) ska vara med');
  assert.ok(
    !kategorier.includes('social') && !kategorier.includes('fysisk'),
    'gröna kategorier ska aldrig ge tips',
  );
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
