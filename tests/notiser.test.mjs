/**
 * Notiser till befäl — i synnerhet samtalsbegäran.
 *
 * En värnpliktig som ber om samtal får beskedet att befälet fått veta. Det
 * beskedet måste vara sant. Varje test här kommer från ett fel som hittades
 * vid granskning, inte från fantasi.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { buildOrg, checkIn, database } from './setup.mjs';

test('två värnpliktiga i samma grupp som ber om samtal samma dag når båda fram', async () => {
  const { client } = await database();
  const org = await buildOrg(client);
  const [anna, bertil] = org.soldater['Grupp A'];

  const befal = Number((await client.execute({
    sql: 'INSERT INTO users (code_hash, label, role, unit_id, active, created_at) VALUES (?,?,?,?,1,?) RETURNING id',
    args: [`hash-plutonchef-${Date.now()}`, 'Plutonchef', 'pluton', org.pluton, new Date().toISOString()],
  })).rows[0].id);

  const { createTalkRequest, getUnreadNotifications } = await import('../src/lib/db/queries/notifications.ts');

  for (const [id, label] of [[anna, 'Värnpliktig 01'], [bertil, 'Värnpliktig 02']]) {
    await createTalkRequest({
      soldierUserId: id,
      soldierLabel: label,
      soldierUnitName: 'Grupp A',
      recipientUserId: befal,
      subjectUnitId: org.grupper['Grupp A'],
    });
  }

  const notiser = (await getUnreadNotifications(befal)).map((n) => n.body);
  assert.ok(notiser.some((b) => b.includes('Värnpliktig 01')), 'den första begäran ska finnas');
  assert.ok(
    notiser.some((b) => b.includes('Värnpliktig 02')),
    'den andra begäran försvann — hon fick beskedet att befälet vet, men befälet vet ingenting',
  );
});

const iso = () => new Date().toISOString();
const stockholmsDag = (bakat = 0) => {
  const [y, m, d] = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Stockholm' }).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d) - bakat * 86_400_000).toISOString().slice(0, 10);
};

async function plutonchef(client, org) {
  return Number((await client.execute({
    sql: 'INSERT INTO users (code_hash, label, role, unit_id, active, created_at) VALUES (?,?,?,?,1,?) RETURNING id',
    args: [`hash-pc-${Math.random()}`, 'Plutonchef', 'pluton', org.pluton, iso()],
  })).rows[0].id);
}

test('samma värnpliktig som trycker flera gånger samma dag blir en notis', async () => {
  const { client } = await database();
  const org = await buildOrg(client);
  const befal = await plutonchef(client, org);
  const [anna] = org.soldater['Grupp A'];
  const { createTalkRequest, getUnreadNotifications } = await import('../src/lib/db/queries/notifications.ts');

  for (let i = 0; i < 3; i++) {
    await createTalkRequest({ soldierUserId: anna, soldierLabel: 'Anna', soldierUnitName: 'Grupp A', recipientUserId: befal, subjectUnitId: org.grupper['Grupp A'] });
  }
  assert.equal((await getUnreadNotifications(befal)).length, 1);
});

test('en samtalsbegäran slängs inte för att ett larm om samma enhet redan finns', async () => {
  const { client } = await database();
  const org = await buildOrg(client);
  const befal = await plutonchef(client, org);
  const [anna] = org.soldater['Grupp A'];

  // Någon placerad direkt på plutonen: begäran och plutonens larm får samma ämne.
  await client.execute({
    sql: `INSERT INTO notifications (recipient_user_id, subject_unit_id, kind, title, body, service_date, created_at)
          VALUES (?,?,'red_values','Pluton 1 ligger på kritisk nivå','…',?,?)`,
    args: [befal, org.pluton, stockholmsDag(), iso()],
  });

  const { createTalkRequest, getUnreadNotifications } = await import('../src/lib/db/queries/notifications.ts');
  await createTalkRequest({ soldierUserId: anna, soldierLabel: 'Anna', soldierUnitName: 'Pluton 1', recipientUserId: befal, subjectUnitId: org.pluton });

  const titlar = (await getUnreadNotifications(befal)).map((n) => n.title);
  assert.ok(titlar.includes('En värnpliktig vill prata med dig'), 'begäran ska finnas trots larmet');
  assert.ok(titlar.includes('Pluton 1 ligger på kritisk nivå'), 'larmet ska finnas kvar');
});

test('en värnpliktig som bett om samtal går att radera, och begäran försvinner med henne', async () => {
  const { client } = await database();
  const org = await buildOrg(client);
  const befal = await plutonchef(client, org);
  const [anna] = org.soldater['Grupp B'];

  const { createTalkRequest, getUnreadNotifications } = await import('../src/lib/db/queries/notifications.ts');
  const { deleteUser } = await import('../src/lib/db/queries/admin.ts');

  await createTalkRequest({ soldierUserId: anna, soldierLabel: 'Anna Andersson', soldierUnitName: 'Grupp B', recipientUserId: befal, subjectUnitId: org.grupper['Grupp B'] });

  /*
   * drizzle-kit tappade ON DELETE CASCADE när kolumnen lades till. Utan den
   * vägrar databasen radera kontot — och notisen, som nämner henne vid namn,
   * skulle annars ligga kvar efter att hon raderats.
   */
  const r = await deleteUser(befal, anna);
  assert.equal(r.ok, true, r.error);
  assert.ok(!(await getUnreadNotifications(befal)).some((n) => n.body.includes('Anna Andersson')));
});

test('ett nytt larm ersätter äldre olästa om samma sak, men aldrig en samtalsbegäran', async () => {
  const { client } = await database();
  const org = await buildOrg(client);
  const befal = await plutonchef(client, org);
  const alla = [...org.soldater['Grupp A'], ...org.soldater['Grupp B']];

  await client.execute({
    sql: `INSERT INTO notifications (recipient_user_id, subject_unit_id, kind, title, body, service_date, created_at)
          VALUES (?,?,'red_values','Pluton 1 ligger på kritisk nivå','igår',?,?)`,
    args: [befal, org.pluton, stockholmsDag(1), iso()],
  });

  /*
   * Begäran är från IGÅR och fortfarande oläst — befälet har inte hunnit se
   * den. Det är det farliga fallet: ett larm idag som städar bort gamla
   * notiser får aldrig ta den med sig. (En begäran från idag hade inte
   * prövat något, eftersom bara äldre notiser ersätts.)
   */
  await client.execute({
    sql: `INSERT INTO notifications (recipient_user_id, subject_unit_id, kind, requested_by_user_id, title, body, service_date, created_at)
          VALUES (?,?,'talk_request',?,'En värnpliktig vill prata med dig','Anna i Grupp A har begärt ett samtal.',?,?)`,
    args: [befal, org.grupper['Grupp A'], alla[0], stockholmsDag(1), iso()],
  });
  const { getUnreadNotifications } = await import('../src/lib/db/queries/notifications.ts');

  // Alla svarar rött idag — plutonen larmar igen.
  await checkIn(client, alla, stockholmsDag(), 2);
  const { evaluateAlerts } = await import('../src/lib/db/queries/alerts.ts');
  await evaluateAlerts(org.grupper['Grupp A']);

  const olasta = await getUnreadNotifications(befal);
  const larm = olasta.filter((n) => n.title === 'Pluton 1 ligger på kritisk nivå');
  assert.equal(larm.length, 1, 'bara det senaste larmet ska vara oläst');
  assert.equal(larm[0].serviceDate, stockholmsDag(), 'och det ska vara dagens');
  assert.ok(olasta.some((n) => n.title === 'En värnpliktig vill prata med dig'), 'begäran får inte kvitteras av ett larm');
});

test('en ny begäran når fram efter att befälet kvitterat den förra samma dag', async () => {
  /*
   * Det här är fallet som betyder mest, och det som var trasigt.
   *
   * Unikhetsvillkoret gäller per person och dag, och kvitteringen sätter bara
   * read_at — raden låg kvar. Bad någon om samtal på morgonen, fick den
   * kvitterad, och bad igen på eftermiddagen för att det blivit sämre, slängdes
   * den andra begäran tyst medan gränssnittet svarade att den skickats.
   * Befälet fick aldrig veta, och personen trodde att hjälp var på väg.
   */
  const { client } = await database();
  const org = await buildOrg(client);
  const [soldat] = org.soldater['Grupp A'];

  const befal = Number((await client.execute({
    sql: 'INSERT INTO users (code_hash, label, role, unit_id, active, created_at) VALUES (?,?,?,?,1,?) RETURNING id',
    args: [`hash-chef-igen-${Date.now()}`, 'Plutonchef', 'pluton', org.pluton, new Date().toISOString()],
  })).rows[0].id);

  const { createTalkRequest, getUnreadNotifications, markNotificationRead } = await import(
    '../src/lib/db/queries/notifications.ts'
  );

  const begar = () =>
    createTalkRequest({
      soldierUserId: soldat,
      soldierLabel: 'Värnpliktig 01',
      soldierUnitName: 'Grupp A',
      recipientUserId: befal,
      subjectUnitId: org.grupper['Grupp A'],
    });

  await begar();
  const [forsta] = await getUnreadNotifications(befal);
  assert.ok(forsta, 'den första begäran nådde inte fram');

  // Befälet kvitterar: "jag har sett den".
  await markNotificationRead(befal, forsta.id);
  assert.equal((await getUnreadNotifications(befal)).length, 0, 'kvitteringen tog inte');

  // Samma person ber igen senare samma dag.
  await begar();

  assert.equal(
    (await getUnreadNotifications(befal)).length,
    1,
    'den andra begäran nådde aldrig fram till befälet',
  );
});

test('den värnpliktige kan se att begäran ligger inne, och om befälet sett den', async () => {
  /*
   * Bekräftelsen fanns bara i formulärets minne. Laddades sidan om var den
   * borta, och den som bett om samtal möttes av knapparna igen som om
   * ingenting hänt — utan svar på "gick det fram?". Det är illa för vem som
   * helst och sämst för just den som tryckt på knappen.
   */
  const { client } = await database();
  const org = await buildOrg(client);
  const [soldat] = org.soldater['Grupp A'];

  const befal = Number((await client.execute({
    sql: 'INSERT INTO users (code_hash, label, role, unit_id, active, created_at) VALUES (?,?,?,?,1,?) RETURNING id',
    args: [`hash-chef-status-${Date.now()}`, 'Plutonchef', 'pluton', org.pluton, new Date().toISOString()],
  })).rows[0].id);

  const { createTalkRequest, markNotificationRead, samtalsbegaranIdag, getUnreadNotifications } =
    await import('../src/lib/db/queries/notifications.ts');

  // Innan något begärts finns ingenting att visa.
  assert.equal(await samtalsbegaranIdag(soldat), null);

  await createTalkRequest({
    soldierUserId: soldat,
    soldierLabel: 'Värnpliktig 01',
    soldierUnitName: 'Grupp A',
    recipientUserId: befal,
    subjectUnitId: org.grupper['Grupp A'],
  });

  const inne = await samtalsbegaranIdag(soldat);
  assert.ok(inne, 'begäran syns inte för den som skickade den');
  assert.equal(inne.kvitterad, false, 'markerades som sedd innan befälet sett den');

  // Befälet kvitterar.
  const [notis] = await getUnreadNotifications(befal);
  await markNotificationRead(befal, notis.id);

  const sedd = await samtalsbegaranIdag(soldat);
  assert.ok(sedd, 'begäran försvann när den kvitterades');
  assert.equal(sedd.kvitterad, true, 'kvitteringen syns inte för den värnpliktige');
});
