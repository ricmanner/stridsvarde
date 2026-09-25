/**
 * Nattkörningen som flyttar fram demodatan av sig själv.
 *
 * Knappen på statussidan har alltid fungerat — problemet är att någon måste
 * komma ihåg att trycka. Demodatan står still medan kalendern går, och efter
 * en vecka är befälsvyns förvalda period tom. Den som öppnar länken ser en
 * app som verkar trasig.
 *
 * Dörren som klockan knackar på är öppen mot hela internet. Därför prövas
 * låsen hårdare än själva arbetet: en hemlighet som saknas ska STÄNGA dörren,
 * inte öppna den, och rutten får aldrig röra ett pilottest med riktiga
 * värnpliktiga.
 *
 * Allt ligger i ett enda test med steg i ordning, av samma skäl som
 * demo-tid.test.mjs: framflyttningen skriver om datum i hela tabellen, så två
 * tester som delade databasen skulle flytta varandras data.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { buildOrg, database } from './setup.mjs';

const ADRESS = 'https://exempel.test/api/demo-tidslinje';
const HEMLIGHET = 'en-hemlighet-lang-nog-for-att-duga-i-test';

/** Ett anrop till rutten, med eller utan auktorisationsrubrik. */
const anrop = (rubrik) =>
  new Request(ADRESS, rubrik ? { headers: { authorization: rubrik } } : undefined);

test('nattkörningens dörr släpper bara igenom rätt anrop', async (t) => {
  const { client } = await database();
  const org = await buildOrg(client);
  const soldater = [...org.soldater['Grupp A'], ...org.soldater['Grupp B']];

  const { hashCode } = await import('../src/lib/auth/codes.ts');
  const { serviceDate, serviceDateDaysAgo } = await import('../src/lib/date.ts');
  const { GET } = await import('../src/app/api/demo-tidslinje/route.ts');

  const nu = () => new Date().toISOString();
  const rad = async (sql, args = []) => (await client.execute({ sql, args })).rows;
  const antalRader = async () =>
    Number((await rad("SELECT count(*) n FROM audit_log WHERE action = 'demo.timeline.auto'"))[0].n);
  const senasteHistorikdag = async () =>
    String((await rad('SELECT max(service_date) d FROM check_ins'))[0].d);

  // Demons administratörskonto: utan det vägrar framflyttningen, eftersom
  // databasen då inte ser ut som demons.
  await rad(
    'INSERT INTO users (code_hash, label, role, unit_id, active, created_at) VALUES (?,?,?,?,1,?)',
    [hashCode('ADMIN-01'), 'Administratör', 'admin', org.bataljon, nu()],
  );

  // Fjorton dagars historik som slutar för tio dagar sedan — alltså precis
  // det läge nattkörningen finns för att rätta till.
  const SLUT = serviceDateDaysAgo(10);
  for (let i = 13; i >= 0; i--) {
    const dag = serviceDateDaysAgo(10 + i);
    for (const id of soldater) {
      await rad(
        `INSERT INTO check_ins (user_id, service_date, fysisk, psykisk, social, somn, kost, energi, created_at)
         VALUES (?,?,6,6,6,6,6,6,?)`,
        [id, dag, nu()],
      );
    }
  }

  const tidigareLage = process.env.PSVI_ENVIRONMENT;
  const tidigareHemlighet = process.env.CRON_SECRET;

  try {
    await t.test('utan hemlighet är dörren stängd, inte öppen', async () => {
      /*
       * Det farliga felet. Glöms inställningen i Vercel, eller försvinner den
       * vid en flytt, ska rutten vägra — inte stå olåst mot hela internet och
       * låta vem som helst skriva om datumen i demons hälsodata.
       */
      delete process.env.CRON_SECRET;
      process.env.PSVI_ENVIRONMENT = 'demo';

      const svar = await GET(anrop(`Bearer ${HEMLIGHET}`));
      assert.equal(svar.status, 503, 'en saknad hemlighet får aldrig ge tillträde');
      assert.equal(await senasteHistorikdag(), SLUT, 'ingenting fick flyttas');
    });

    process.env.CRON_SECRET = HEMLIGHET;

    await t.test('fel eller ingen hemlighet ger obehörig', async () => {
      for (const rubrik of [
        undefined,
        '',
        'Bearer fel-hemlighet',
        HEMLIGHET, // rätt hemlighet men utan "Bearer" — ska inte räcka
        `bearer ${HEMLIGHET}`, // fel skiftläge på prefixet
        `Bearer ${HEMLIGHET}x`,
      ]) {
        /*
         * Ett mellanslag sist prövas INTE. Webbstandarden städar bort
         * blanktecken i kanterna på ett rubrikvärde innan koden ser det, så
         * "Bearer hemlis " ÄR "Bearer hemlis" — att kräva ett nej där vore att
         * testa något som inte kan hända. Det upptäcktes genom att testet
         * först påstod motsatsen.
         */
        const svar = await GET(anrop(rubrik));
        assert.equal(svar.status, 401, `"${rubrik}" borde ha avvisats`);
      }
      assert.equal(await senasteHistorikdag(), SLUT, 'ingenting fick flyttas');
      assert.equal(await antalRader(), 0, 'ett avvisat anrop ska inte antecknas');
    });

    await t.test('rätt hemlighet räcker inte i pilotläge', async () => {
      /*
       * Andra låset. I ett pilottest är incheckningarna riktiga värnpliktigas
       * och får aldrig få nya datum, hur giltig hemligheten än är.
       */
      process.env.PSVI_ENVIRONMENT = 'pilot';

      const svar = await GET(anrop(`Bearer ${HEMLIGHET}`));
      assert.equal(svar.status, 403, 'rutten ska vägra utanför demoläge');
      assert.equal(await senasteHistorikdag(), SLUT, 'riktig hälsodata fick inte röras');

      process.env.PSVI_ENVIRONMENT = 'demo';
    });

    await t.test('rätt anrop flyttar fram datan och antecknar körningen', async () => {
      const svar = await GET(anrop(`Bearer ${HEMLIGHET}`));
      assert.equal(svar.status, 200);

      const kropp = await svar.json();
      assert.equal(kropp.flyttadeDagar, 10, 'tio dagars eftersläpning skulle tas igen');
      assert.equal(await senasteHistorikdag(), serviceDate(), 'historiken ska sluta idag');

      /*
       * Raden i granskningsloggen är hela beviset för att klockan går. Utan
       * den syns en utebliven nattkörning först när någon står framför en
       * publik — och det var precis så GitHubs schema kunde vara trasigt i
       * ett halvt dygn utan att någon visste det.
       */
      const [rader] = await rad(
        "SELECT count(*) n FROM audit_log WHERE action = 'demo.timeline.auto' AND actor_user_id IS NULL",
      );
      assert.equal(Number(rader.n), 1, 'körningen ska antecknas utan mänsklig avsändare');
    });

    await t.test('en andra körning samma dygn flyttar inget men antecknas ändå', async () => {
      /*
       * Vercel lovar inte att en klocka ringer exakt en gång — samma körning
       * kan komma två gånger. Framflyttningen tål det (har datan redan
       * flyttats idag skriver den ingenting), men anteckningen måste ske
       * ändå: annars går det inte att skilja "klockan ringde, inget behövdes"
       * från "klockan ringde aldrig", och det är just den skillnaden raden
       * finns för att visa.
       */
      const svar = await GET(anrop(`Bearer ${HEMLIGHET}`));
      assert.equal(svar.status, 200);
      assert.equal((await svar.json()).flyttadeDagar, 0, 'redan framflyttad idag');
      assert.equal(await antalRader(), 2, 'även en körning utan arbete ska synas');
    });
  } finally {
    process.env.PSVI_ENVIRONMENT = tidigareLage;
    if (tidigareHemlighet === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = tidigareHemlighet;
  }
});

test('hemligheter jämförs utan att avslöja hur långt man kommit', async () => {
  const { hemligheterLika } = await import('../src/lib/hemlighet.ts');

  assert.equal(hemligheterLika('abc', 'abc'), true);
  assert.equal(hemligheterLika('abc', 'abd'), false);

  // Olika längd får inte kasta — timingSafeEqual gör det på råa buffertar,
  // och ett kastat fel mitt i en kontroll är en kontroll som inte körs.
  assert.equal(hemligheterLika('kort', 'en mycket längre hemlighet'), false);
  assert.equal(hemligheterLika('', ''), true);
  assert.equal(hemligheterLika('', 'x'), false);
});

test('väckarklockan är inställd och pekar på rutten', async () => {
  /*
   * Rutten utan klocka är en dörr ingen knackar på. Konfigurationen ligger i
   * vercel.json och går inte att prova lokalt — den syns först i drift — så
   * det här testet vaktar åtminstone att den inte försvinner vid en
   * omskrivning av filen.
   */
  const { readFileSync } = await import('node:fs');
  const config = JSON.parse(readFileSync('vercel.json', 'utf8'));

  const jobb = (config.crons ?? []).find((c) => c.path === '/api/demo-tidslinje');
  assert.ok(jobb, 'vercel.json saknar nattkörningen');

  // En gång per dygn — allt tätare vägrar Vercel att driftsätta på det
  // abonnemang demon ligger på.
  assert.match(jobb.schedule, /^\d+ \d+ \* \* \*$/, 'schemat ska vara en gång per dygn');

  // Tiden anges i UTC. 02:00 UTC är 04:00 svensk sommartid, och Vercel kan
  // dröja upp till en timme — fortfarande mitt i natten.
  assert.equal(jobb.schedule, '0 2 * * *');
});

/**
 * Vad statussidan säger om klockan.
 *
 * Skilt från databasfrågan, som beskrivDemoTidslinje() är det — bedömningen
 * ska gå att pröva utan en databas, och texten ska stämma med vad som
 * faktiskt hänt. En sida som säger "allt är bra" om en klocka som slutat gå
 * är sämre än ingen sida alls.
 */
test('statussidan skiljer en klocka som går från en som stannat', async () => {
  const { beskrivNattkorning } = await import('../src/lib/db/demo-timeline.ts');

  const timmarSedan = (h) => new Date(Date.now() - h * 3_600_000).toISOString();

  const utanHemlighet = beskrivNattkorning({ hemlighetSatt: false, senaste: null });
  assert.equal(utanHemlighet.varning, true, 'en avstängd klocka ska synas');
  assert.match(utanHemlighet.text, /avstängd|hemlighet/i);

  const aldrigKort = beskrivNattkorning({ hemlighetSatt: true, senaste: null });
  assert.equal(aldrigKort.varning, true, 'ingen körning alls ska synas');

  // Klockan ringer 02:00 UTC men Vercel får dröja en timme, så längsta
  // normala avstånd mellan två körningar är knappt 25 timmar.
  const igar = beskrivNattkorning({
    hemlighetSatt: true,
    senaste: { tid: timmarSedan(24), detalj: 'historiken flyttad 1 dag fram' },
  });
  assert.equal(igar.varning, false, 'ett dygn sedan är precis som det ska vara');
  assert.match(igar.text, /flyttad/, 'vad körningen gjorde ska stå kvar');

  const forLange = beskrivNattkorning({
    hemlighetSatt: true,
    senaste: { tid: timmarSedan(30), detalj: 'inget att flytta' },
  });
  assert.equal(forLange.varning, true, 'en utebliven natt ska märkas');
});

/**
 * Dörren måste också gå att KNACKA på.
 *
 * Proxyn skickar varje adress utan sessionskaka vidare till inloggningen. För
 * en människa är det rätt; för en klocka är det förödande, och tyst: Vercel
 * följer inte omdirigeringar, utan betraktar svaret som färdigt och går
 * därifrån. Jobbet hade alltså stått som lyckat i loggen varje natt utan att
 * en enda rad flyttats.
 *
 * Exakt samma fel har den här appen haft en gång förut, på hälsokontrollen:
 * vaktposten läste omdirigeringen som "allt är bra". Se kommentaren i
 * proxy.ts. Det upptäcktes inte av något test utan av ett riktigt anrop mot
 * en körande app — därför finns det här testet nu.
 */
test('proxyn släpper fram nattkörningen i stället för inloggningen', async () => {
  const { proxy } = await import('../src/proxy.ts');
  const { NextRequest } = await import('next/server');

  const knack = (sokvag) => proxy(new NextRequest(new Request(`https://exempel.test${sokvag}`)));

  const svar = knack('/api/demo-tidslinje');
  assert.equal(svar.status, 200, 'nattkörningen skickades till inloggningen');
  assert.equal(svar.headers.get('location'), null, 'en klocka följer inte en omdirigering');

  // Kontrollgrupp: allt annat utan session ska fortfarande skickas bort.
  assert.equal(knack('/status').status, 307, 'skyddade sidor ska kräva inloggning');
  assert.equal(knack('/pluton').status, 307);
});
