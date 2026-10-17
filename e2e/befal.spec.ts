import { expect, test } from '@playwright/test';

import { FRAGOR, ingaEnskildaPersoner, KODER, loggaIn, synligText } from './hjalp';

/**
 * Befälsvyn: tre flikar, tre nivåer, och den gräns som hela appen vilar på —
 * att ett befäl ser sammanställningar, aldrig enskilda personer.
 */

test.describe('plutonchefen', () => {
  test.beforeEach(async ({ page }) => {
    await loggaIn(page, KODER.plutonchef);
    await expect(page).toHaveURL(/\/pluton/);
  });

  test('alla tre flikar renderar utan fel', async ({ page }) => {
    const text = await synligText(page);
    expect(text).toContain('värnpliktiga');
    expect(text).toContain('svarat idag');
    await ingaEnskildaPersoner(page);

    for (const flik of ['Trender', 'Jämförelse']) {
      await page.getByRole('tab', { name: flik }).click();
      await expect(page.getByRole('tabpanel')).toBeVisible();
      const panel = await page.getByRole('tabpanel').innerText();
      expect(panel.length, `${flik} är tom`).toBeGreaterThan(80);
      await ingaEnskildaPersoner(page);
    }
  });

  test('översikten: nyckeltal och kategorierna med sämst först; ingen vecka', async ({ page }) => {
    /*
     * Richard, 16 oktober: befälen vill ha siffror rakt på sak. Fyra
     * nyckeltal överst och kategorierna som en tabell i stället för staplar
     * som räknade svar. "Senaste veckan" är borta sedan 17 oktober, först
     * från skärmen och sedan ur rapporten: rutan var alltid sju dagar och
     * följde inte periodväljaren.
     */
    const dl = page.locator('dl').first();
    for (const etikett of ['Samlat mående', 'Svarat idag', 'Personer under 4', 'Kategorisnitt under 4']) {
      await expect(dl.getByText(etikett, { exact: true })).toBeVisible();
    }
    await expect(page.getByRole('region', { name: 'Senaste veckan' })).toHaveCount(0);
    // Ingen fotnot om hur texten tagits fram (16 oktober).
    await expect(page.getByText(/ingen AI/i)).toHaveCount(0);

    // Inga staplar med "gröna svar" kvar, och sämst först: sömn eller kost
    // överst i demons 1. pluton efter fältövningen.
    expect(await synligText(page)).not.toContain('gröna svar');
    const forsta = await page.locator('li', { hasText: /Snitt/ }).first().innerText();
    expect(forsta).toMatch(/Sömn|Kost och näring/);
    await expect(page.getByText(/av dem som svarat/)).toBeVisible();
    await ingaEnskildaPersoner(page);

  });

  test('jämförelsen: ingen rangordning, och ingen kolumn med bara streck', async ({ page }) => {
    await page.getByRole('tab', { name: 'Jämförelse' }).click();
    await expect(page.getByRole('tabpanel')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Rangordning' })).toHaveCount(0);
    // 4. grupp är dold, så antalen i rött hålls inne för alla grupper. En
    // kolumn med bara streck göms (paket 1, 17 oktober). Hos kompanichefen,
    // där alla plutoner syns, står den kvar — se testet längre ned.
    await expect(page.getByRole('columnheader', { name: 'Snitt' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Personer under 4' })).toHaveCount(0);
  });

  test('varningen står inte fem gånger: ingen tröskelruta, och inga rader om preliminära gränser', async ({ page }) => {
    // Väg B, 16 oktober (lib/varningar.ts). Demons 1. pluton har sömn och
    // kost i rött — förut stod det också i en egen ruta under listan.
    await expect(page.getByRole('heading', { name: /Tröskelvärden/ })).toHaveCount(0);
    // "Gränserna … är preliminära" och "Råden är preliminära" borta från
    // skärmen (Richard, 17 oktober).
    await expect(page.getByText(/är preliminära/)).toHaveCount(0);
    // Det röda syns fortfarande: nyckeltalet överst och märkena i tabellen.
    await expect(page.locator('dl').first().getByText('Kategorisnitt under 4', { exact: true })).toBeVisible();
    await expect(page.getByText(/sömn samt kost och näring/i).first()).toBeVisible();
    // Befälsrådet är gömt sedan 17 oktober, se testet längre ned.
    // Den dagliga notisen är gömd. Sök i notisrutan: Befälsrådet säger själv
    // "ligger på kritisk nivå", och det ska stå kvar.
    await expect(page.locator('[data-notiser]', { hasText: 'kritisk nivå' })).toHaveCount(0);
  });

  test('perioden går att byta, och bara till tillåtna värden', async ({ page }) => {
    await page.getByRole('tab', { name: 'Trender' }).click();
    await page.getByRole('link', { name: '21d' }).click();
    await expect(page).toHaveURL(/period=21/);
    expect(await synligText(page)).toContain('21 dagar');

    // Påhittad period faller tillbaka till sju dagar i stället för att öppna
    // ett eget tidsfönster — annars går enskilda dagar att räkna fram.
    await page.goto('/pluton?period=3');
    expect(await synligText(page)).toContain('7 dagar');
  });

  test('graferna ritas, inte bara rubrikerna', async ({ page }) => {
    await page.getByRole('tab', { name: 'Trender' }).click();
    // Samlat mående först, sedan en liten graf per fråga — åtta med hälsa.
    await expect(page.locator('.recharts-surface')).toHaveCount(FRAGOR + 1);
    await expect(page.getByRole('img', { name: /Trend för enheten: Samlat mående/ })).toBeVisible();
    await expect(page.getByRole('img', { name: /Trend för enheten: Sömn/ })).toBeVisible();

    await page.getByRole('tab', { name: 'Jämförelse' }).click();
    await expect(page.getByRole('img', { name: /mot hela enheten över tid/ })).toBeVisible();
    await expect(page.getByRole('img', { name: /Profil för/ })).toBeVisible();
  });

  test('exporten ger en fil med samma tal som skärmen', async ({ page }) => {
    const svar = await page.request.get('/api/export?typ=dagar&period=7');
    expect(svar.status()).toBe(200);
    const csv = await svar.text();
    const rader = csv.trim().split('\r\n');
    expect(rader.length).toBeGreaterThan(1);
    expect(rader[0]).toContain('Datum;Svarande');
    expect(csv, 'full flyttalsprecision i filen').not.toMatch(/\d+\.\d{3,}/);
  });

  test('jämförelsen i telefonen: namnen och "I rött" står på en rad', async ({ page }) => {
    // Granskningen 16 oktober: i 390 px bröts "1. grupp" efter siffran och
    // "2 av 8" efter "av", så att varje rad blev dubbelt så hög.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('tab', { name: 'Jämförelse' }).click();
    const tabell = page.getByRole('region', { name: /Jämförelse mellan/ });
    await expect(tabell).toBeVisible();
    const radbrott = await tabell.evaluate((el) => {
      // Räknar textraderna, inte rutorna: snittet ligger i en egen ruta med
      // marginal, och den räknades annars som en rad till.
      const rader = (cell: Element) => {
        const toppar = new Set<number>();
        const gå = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT);
        for (let n = gå.nextNode(); n; n = gå.nextNode()) {
          if (!n.textContent?.trim()) continue;
          const r = document.createRange();
          r.selectNodeContents(n);
          for (const x of r.getClientRects()) toppar.add(Math.round(x.top));
        }
        return toppar.size;
      };
      // Kolumnerna efter namn, inte plats: "I rött" göms när den bara har
      // streck, och kategorirubrikerna bryts på två rader med flit.
      const alla = [...el.querySelectorAll('thead th')];
      const index = alla
        .map((th, i) => (['Enhet', 'Svarsandel', 'Snitt', 'Personer under 4'].includes(th.textContent?.trim() ?? '') ? i : -1))
        .filter((i) => i >= 0);
      // Rubriken "Personer under 4" får brytas, som kategorirubrikerna; cellerna inte.
      const huvud = index.map((i) => alla[i]).filter((th) => th.textContent?.trim() !== 'Personer under 4');
      const celler = [...el.querySelectorAll('tbody tr')].flatMap((tr) => {
        const tds = [...tr.querySelectorAll('td')];
        // En rad med "Underlag saknas" spänner över resten; bara namn och svar.
        return tds.length < alla.length ? tds.slice(0, 2) : index.map((i) => tds[i]);
      });
      return [...huvud, ...celler].filter((c) => c.textContent?.trim() && rader(c) > 1).map((c) => c.textContent);
    });
    expect(radbrott, 'celler som bryts på två rader').toEqual([]);
  });

  test('21 dagar utan en period före säger det, i stället för att lova en ring', async ({ page }) => {
    // Demon har tre veckors historik, så de 21 dagarna före är tomma.
    await page.goto('/pluton?period=21');
    await expect(page.getByText(/för få svar under de 21 dagarna före/)).toBeVisible();
    await expect(page.getByText('21 dagarna före', { exact: true })).toHaveCount(0);
  });

  test('en dold grupp går inte att räkna fram: inga antal i rött per grupp', async ({ page }) => {
    /*
     * 4. grupp har tre personer och visar "Underlag saknas". Stod antalet i
     * rött kvar för de andra grupperna gick dess antal att räkna fram ur
     * plutonens total ("Personer i rött") — granskningen 16 oktober.
     */
    await page.getByRole('tab', { name: 'Jämförelse' }).click();
    const tabell = page.getByRole('region', { name: /Jämförelse mellan/ });
    await expect(tabell).toBeVisible();
    await expect(tabell.getByText(/\d+ av \d+/)).toHaveCount(0);
    // Ingen förklarande rad under tabellen på skärmen (Richard, 16 oktober):
    // den stod mellan tabellen och jämförelsen med hela enheten.
    await expect(page.getByText(/I rött visas inte per grupp/)).toHaveCount(0);

    // Inte heller i rapporten (Richard, 17 oktober). Strecken står kvar.
    await page.goto('/rapport');
    await expect(page.getByText(/I rött visas inte per grupp/)).toHaveCount(0);
    await expect(page.getByText(/är preliminära/)).toHaveCount(0);
  });

  test('rapporten säger samma sak som skärmen', async ({ page }) => {
    // Rapporten stod kvar med "Gröna värnpliktiga / Röda värnpliktiga" och
    // grön/gul/röd per grupp när befälsvyn gjordes om (granskningen 16 oktober).
    await page.goto('/rapport');
    const text = await synligText(page);
    for (const ord of ['personer under 4', 'kategorisnitt under 4', 'mot perioden före', 'sämst först']) {
      expect(text, `rapporten saknar "${ord}"`).toContain(ord);
    }
    expect(text).not.toContain('gröna värnpliktiga');
    expect(text).not.toContain('grön/gul/röd');
  });

  test('rapporten visar underenheterna per kategori', async ({ page }) => {
    /*
     * 17 oktober: befälen ska ha gott om användbar information på sina möten.
     * "3. grupp, sömn" stod bara i jämförelsen på skärmen; rapporten hade
     * snittet per grupp. Nu samma tabell som jämförelsen.
     */
    await page.goto('/rapport');
    const tabell = page.getByRole('table', { name: 'Underenheter per kategori' });
    for (const k of ['Fysisk form', 'Friskhet', 'Psykiskt mående', 'Social trivsel', 'Sömn', 'Kost och näring', 'Energinivå']) {
      await expect(tabell.getByRole('columnheader', { name: k })).toBeVisible();
    }
    const celler = await tabell.getByRole('row', { name: /^1\. grupp/ }).getByRole('cell').allInnerTexts();
    const tal = celler.filter((t) => /\d,\d/.test(t));
    expect(tal.length, `1. grupp: ${celler.join(' | ')}`).toBe(8); // snitt + sju kategorier
    // Variant 2 (Richard, 17 oktober): tonade rutor som på skärmen, och
    // varningstriangeln på de röda — 1. plutonens grupper har sömn i rött.
    const rad1 = tabell.getByRole('row', { name: /^1\. grupp/ });
    await expect(rad1.locator('span[style*="background"]')).toHaveCount(8);
    await expect(rad1.locator('svg.lucide-triangle-alert, svg.lucide-alert-triangle').first()).toBeVisible();
    // 4. grupp är dold: "I rött" hålls inne och visas inte, som på skärmen.
    await expect(tabell.getByRole('columnheader', { name: 'Personer under 4' })).toHaveCount(0);
    await expect(tabell.getByRole('row', { name: /^4\. grupp/ })).toContainText('Underlag saknas');
  });

  test('rapporten har en period: ingen vecka, och svaren i snitt för perioden', async ({ page }) => {
    /*
     * 17 oktober: rutan "Senaste veckan" var alltid sju dagar medan resten
     * av rapporten följde den valda perioden. Den är borta, och "Svarat
     * idag" — ett ögonblick, när rapporten skrevs ut — är ersatt av hur
     * många som svarat i snitt under perioden.
     */
    for (const period of [7, 21]) {
      await page.goto(`/rapport?period=${period}`);
      await expect(page.getByRole('region', { name: 'Senaste veckan' })).toHaveCount(0);
      const text = await synligText(page);
      expect(text).toContain('svarade i snitt');
      expect(text).toContain(`${period} dagar`);
      expect(text).not.toContain('svarat idag');
    }
  });

  test('samlat mående säger åt vilket håll det går', async ({ page }) => {
    /*
     * 17 oktober: ChatGPT och Claude satte det högst — "4,8" säger inte om det
     * blir bättre eller sämre. Förändringen mot perioden före står under
     * talet, på skärmen och i rapporten. Med 21 dagar finns ingen period före
     * i demon, och då står bara perioden.
     */
    const ruta = page.locator('dl').first().locator('div', { has: page.getByText('Samlat mående', { exact: true }) }).last();
    await expect(ruta.locator('dd').nth(1)).toHaveText(/^snitt 7 dagar · ([↑↓] |[+−±])\d,\d mot de 7 före$/);
    await page.goto('/pluton?period=21');
    await expect(page.locator('dl').first().locator('div', { has: page.getByText('Samlat mående', { exact: true }) }).last().locator('dd').nth(1)).toHaveText('snitt 21 dagar');
    await page.goto('/rapport?period=7');
    await expect(page.getByText(/· snitt 7 dagar · ([↑↓] |[+−±])\d,\d mot de 7 före/)).toBeVisible();
  });

  test('sidan har en synlig titel med enhetens namn', async ({ page }) => {
    // Paket 1, 17 oktober: förut stod enheten bara litet i sidhuvudet.
    await expect(page.getByRole('heading', { level: 1, name: '1. pluton' })).toBeVisible();
    await expect(page.getByText(/Plutonsnivå · \d+ värnpliktiga/)).toBeVisible();
  });

  test('nyckeltalen står bara på Översikt, och räknas inte upp igen', async ({ page }) => {
    // Paket 1, 17 oktober: i telefonen tog de halva skärmen på varje flik.
    const nyckeltal = page.locator('dl').first();
    await expect(nyckeltal).toBeVisible();
    // Låt uppräkningen efter inloggningen (0,7 s) bli klar innan talen läses.
    await page.waitForTimeout(1000);
    const fore = await nyckeltal.innerText();
    for (const flik of ['Trender', 'Jämförelse']) {
      await page.getByRole('tab', { name: flik }).click();
      await expect(page.getByRole('tabpanel')).toBeVisible();
      await expect(nyckeltal, `nyckeltal på ${flik}`).toBeHidden();
    }
    // Göms, tas inte bort: annars räknas talen upp från noll varje gång man
    // går tillbaka till Översikt, och uppräkningen ska bara ske vid
    // inloggning (Richards val A, 16 oktober). Direkt efter bytet står
    // slutvärdet, inte en nolla på väg upp.
    await page.getByRole('tab', { name: 'Översikt' }).click();
    await expect(nyckeltal).toBeVisible();
    expect(await nyckeltal.innerText()).toBe(fore);
  });

  test('flikraden står still när man byter flik', async ({ page }) => {
    // 17 oktober: när nyckeltalen gömdes utanför Översikt hoppade flikraden
    // ungefär 100 px på dator och 200 px i telefon vid varje byte. Väg B:
    // flikarna direkt under titeln, nyckeltalen först i Översikt.
    for (const bredd of [1280, 390]) {
      await page.setViewportSize({ width: bredd, height: 900 });
      const flikrad = page.getByRole('tablist', { name: 'Vyer för enheten' });
      const lagen: number[] = [];
      for (const flik of ['Översikt', 'Trender', 'Jämförelse', 'Översikt']) {
        await page.getByRole('tab', { name: flik }).click();
        await expect(page.getByRole('tabpanel')).toBeVisible();
        lagen.push(Math.round((await flikrad.boundingBox())!.y));
      }
      expect(new Set(lagen).size, `flikradens läge i ${bredd} px: ${lagen.join(', ')}`).toBe(1);
    }
  });

  test('rubrikerna är rubriker, inte versala etiketter', async ({ page }) => {
    // Paket 1, rubrikstil A (17 oktober).
    for (const flik of ['Översikt', 'Trender', 'Jämförelse']) {
      await page.getByRole('tab', { name: flik }).click();
      await expect(page.getByRole('tabpanel')).toBeVisible();
      const versala = await page.getByRole('tabpanel').locator('h2').evaluateAll((hs) =>
        hs.filter((h) => getComputedStyle(h).textTransform === 'uppercase').map((h) => h.textContent),
      );
      expect(versala, `versala rubriker på ${flik}`).toEqual([]);
    }
  });

  test('befälsrådet är gömt', async ({ page }) => {
    // Richard, 17 oktober: en AI eller en text ska inte berätta för ett befäl
    // vad han eller hon ska göra. Gömt tills vidare (VISA_BEFALSRAD).
    await expect(page.getByRole('heading', { name: 'Befälsråd' })).toHaveCount(0);
    await expect(page.getByText('Baserat på enhetens egna värden')).toHaveCount(0);
    await expect(page.getByText(/ligger på röd nivå\./)).toHaveCount(0);
  });
});

test('kompani- och bataljonschefen ser sina egna nivåer', async ({ page }) => {
  await loggaIn(page, KODER.kompanichef);
  await expect(page).toHaveURL(/\/kompani/);
  expect(await synligText(page)).toContain('kompaninivå');
  await ingaEnskildaPersoner(page);
  // Alla plutoner syns, så antalet i rött per pluton står kvar.
  await page.getByRole('tab', { name: 'Jämförelse' }).click();
  await expect(page.getByRole('columnheader', { name: 'Personer under 4' })).toBeVisible();

  // Variant A (Richard, 17 oktober): "I rött" bredvid "Svarade", så att
  // personantalen står ihop och snittet direkt före kategorierna. Snittet
  // större än kategorierna. Samma ordning i rapporten.
  const ordning = async (tabell: import('@playwright/test').Locator) =>
    (await tabell.getByRole('columnheader').allInnerTexts()).slice(0, 5).map((t) => t.replace(/\s+/g, ' ').trim().toLowerCase());
  const jamforelse = page.getByRole('region', { name: /Jämförelse mellan/ }).locator('table');
  expect(await ordning(jamforelse)).toEqual(['enhet', 'svarsandel', 'personer under 4', 'snitt', 'fysisk form']);
  const storlek = (sel: import('@playwright/test').Locator) =>
    sel.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  const forsta = jamforelse.locator('tbody tr').first().locator('td');
  expect(await storlek(forsta.nth(3).locator('div'))).toBeGreaterThan(await storlek(forsta.nth(4).locator('div')));

  await page.goto('/rapport');
  const rapport = page.getByRole('table', { name: 'Underenheter per kategori' });
  expect(await ordning(rapport)).toEqual(['enhet', 'svarsandel', 'personer under 4', 'snitt', 'fysisk form']);

  await page.goto('/bataljon');
  await expect(page).toHaveURL(/ingen-behorighet/);

  await page.goto('/soldat');
  await expect(page).toHaveURL(/ingen-behorighet/);
});

test('en värnpliktig kommer inte in i befälsvyn', async ({ page }) => {
  await loggaIn(page, KODER.varnpliktigKlar);

  for (const sida of ['/pluton', '/kompani', '/bataljon', '/rapport', '/admin']) {
    await page.goto(sida);
    await expect(page, `${sida} släppte in en värnpliktig`).toHaveURL(/ingen-behorighet/);
  }
});

test('utan inloggning kommer man ingenstans', async ({ page, context }) => {
  await context.clearCookies();
  for (const sida of ['/pluton', '/admin', '/soldat/dashboard', '/rapport']) {
    await page.goto(sida);
    await expect(page, `${sida} var öppen utan inloggning`).toHaveURL(/\/$|utgangen/);
  }
});
