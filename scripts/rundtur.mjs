/**
 * Rundtur — klickar igenom appen som varje demokonto och larmar om något brister.
 *
 *   npm run rundtur                    # mot den driftsatta demon
 *   npm run rundtur -- http://localhost:3002
 *
 * Varför det här finns: testerna kontrollerar delarna var för sig, men inget
 * av dem öppnar en riktig sida i en riktig webbläsare. Ett fel i en
 * klientkomponent — en graf som kraschar när ett värde saknas, en flik som
 * slutar rendera — syns inte i ett enda av dem. Det syns först på scenen.
 *
 * Rundturen loggar in på vanligt sätt, går till varje sida kontot ska nå,
 * klickar på varje flik och kontrollerar tre saker:
 *   1. att sidan svarar och innehåller det den ska,
 *   2. att webbläsaren inte rapporterat något fel under tiden,
 *   3. att inga enskilda personers namn läcker ut i befälsvyerna.
 *
 * Kör den före varje uppvisning. Den skriver aldrig något: bara inloggningar
 * och GET.
 */
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { setTimeout as vanta } from 'node:timers/promises';

const BAS = (process.argv[2] ?? 'https://fm-psvi-v2.vercel.app').replace(/\/$/, '');
const CHROME =
  process.env.CHROME_PATH ??
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

/** Vad varje konto ska kunna nå, och vad sidan måste innehålla för att duga. */
const KONTON = [
  {
    kod: 'P1G1-01',
    roll: 'Värnpliktig',
    sidor: [
      { url: '/soldat', kraver: ['Daglig rapportering'], flikar: [] },
    ],
  },
  {
    kod: 'BEF-P1',
    roll: 'Plutonchef',
    sidor: [
      { url: '/pluton', kraver: ['värnpliktiga', 'svarat idag'], flikar: ['Trender', 'Jämförelse'] },
      { url: '/rapport', kraver: ['Samlat mående'], flikar: [] },
    ],
  },
  {
    kod: 'BEF-KP1',
    roll: 'Kompanichef',
    sidor: [{ url: '/kompani', kraver: ['värnpliktiga'], flikar: ['Trender', 'Jämförelse'] }],
  },
  {
    kod: 'BEF-BAT',
    roll: 'Bataljonschef',
    sidor: [{ url: '/bataljon', kraver: ['värnpliktiga'], flikar: ['Trender', 'Jämförelse'] }],
  },
  {
    kod: 'ADMIN-01',
    roll: 'Administratör',
    sidor: [
      { url: '/admin', kraver: ['Enheter', 'Gallring av hälsodata'], flikar: [] },
      { url: '/status', kraver: [], flikar: [] },
    ],
  },
];

/**
 * Text som aldrig får synas för en användare.
 *
 * Jämförs exakt och med ordgräns. "NaN" utan det träffade mitt i ordet
 * "innan" och larmade om en bugg som inte fanns.
 */
const LARMORD = [
  /Application error/,
  /Internal Server Error/,
  /This page could not be found/,
  /\bundefined\b/,
  /\bNaN\b/,
  /Objects are not valid as a React child/,
];

const brister = [];
const anmark = (vad) => { brister.push(vad); console.log(`  ✗ ${vad}`); };

/**
 * Städar bort webbläsarens profilkatalog, och struntar i om det inte går.
 *
 * `chrome.kill()` skickar SIGTERM men väntar inte, så Chrome skriver
 * fortfarande i katalogen när rmSync körs — och `force: true` hjälper inte,
 * den ignorerar bara "finns inte", inte ENOTEMPTY. Följden var att rundturen
 * skrev "Allt fungerade" och därefter kastade en stackspårning.
 *
 * Katalogen ligger i operativsystemets temp-katalog och städas bort ändå. En
 * misslyckad städning får aldrig fälla verktyget man kör precis före en
 * visning.
 */
function stadaProfil(katalog) {
  try {
    rmSync(katalog, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  } catch {
    /* Chrome höll kvar en fil. Temp-katalogen töms av systemet. */
  }
}

// ── Inloggning över HTTP: samma väg som formuläret ──────────────────────────

/**
 * Hämtar en sessionskaka för en kod.
 *
 * Inloggningen är en Server Action, alltså en POST till startsidan med de
 * dolda $ACTION-fälten som sidan levererar. Vi läser dem ur HTML:en och
 * skickar tillbaka dem, precis som webbläsaren gör.
 */
async function loggaIn(kod) {
  let html;
  try {
    html = await (await fetch(BAS + '/')).text();
  } catch (fel) {
    throw new Error(`nådde inte ${BAS} (${fel.message})`);
  }

  // Fälten står HTML-kodade i sidan. Skickas de vidare som de är svarar
  // servern 500 — vilket såg ut som fel kod, men var fel avkodning.
  const avkoda = (t) =>
    t.replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>').replace(/&amp;/g, '&');

  const falt = new Map();
  for (const tagg of html.match(/<input\b[^>]*>/g) ?? []) {
    const namn = tagg.match(/name="(\$ACTION[^"]*)"/)?.[1];
    if (!namn) continue;
    const varde = tagg.match(/value="([^"]*)"/)?.[1] ?? '';
    falt.set(avkoda(namn), avkoda(varde));
  }

  const form = new FormData();
  for (const [k, v] of falt) form.append(k, v);
  form.append('code', kod);

  const svar = await fetch(BAS + '/', { method: 'POST', body: form, redirect: 'manual' });
  const kaka = (svar.headers.getSetCookie?.() ?? [])
    .find((c) => c.startsWith('psvi_session='))
    ?.split(';')[0]
    .slice('psvi_session='.length);

  if (!kaka) throw new Error(`inloggning misslyckades för ${kod}`);
  return kaka;
}

// ── Webbläsaren ─────────────────────────────────────────────────────────────

/**
 * En ledig port, inte en fast.
 *
 * Med en fast port kraschade rundturen när en tidigare körnings webbläsare
 * ännu inte hunnit släppa den — och ett verktyg som ibland slutar fungera
 * litar man inte på när det är skarpt läge.
 */
async function ledigPort() {
  return new Promise((res, rej) => {
    const s2 = createServer();
    s2.on('error', rej);
    s2.listen(0, '127.0.0.1', () => {
      const { port } = s2.address();
      s2.close(() => res(port));
    });
  });
}

const PORT = await ledigPort();
const profil = mkdtempSync(path.join(tmpdir(), 'psvi-rundtur-'));
const chrome = spawn(CHROME, [
  '--headless=new',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${profil}`,
  '--no-first-run',
  'about:blank',
], { stdio: 'ignore' });

/*
 * Går webbläsaren inte att starta kommer felet som en händelse, inte som ett
 * undantag — utan det här avslutades rundturen med en stackspårning i stället
 * för ett svar på frågan.
 */
chrome.on('error', (fel) => {
  console.error(
    `\nKunde inte starta webbläsaren: ${fel.message}` +
      `\nSökväg: ${CHROME}\nAnge en annan med CHROME_PATH=... npm run rundtur`,
  );
  stadaProfil(profil);
  process.exit(1);
});

async function anslut() {
  for (let i = 0; i < 40; i++) {
    try {
      const mal = (await (await fetch(`http://localhost:${PORT}/json/list`)).json())
        .find((t) => t.type === 'page');
      if (mal) return mal.webSocketDebuggerUrl;
    } catch { /* webbläsaren är inte uppe än */ }
    await vanta(250);
  }
  throw new Error(
    `webbläsaren startade inte. Sökväg: ${CHROME}\n` +
      'Ange en annan med CHROME_PATH=... npm run rundtur',
  );
}

let ws;
try {
  ws = new WebSocket(await anslut());
  await new Promise((r) => { ws.onopen = r; });

  let id = 0;
  const vantande = new Map();
  let laddad = false;
  const felILoggen = [];

  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id) vantande.get(m.id)?.(m);
    else if (m.method === 'Page.loadEventFired') laddad = true;
    else if (m.method === 'Runtime.exceptionThrown') {
      felILoggen.push(m.params.exceptionDetails?.exception?.description ?? 'okänt fel');
    } else if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
      felILoggen.push(m.params.args?.map((a) => a.description ?? a.value).join(' ') ?? 'fel i konsolen');
    }
  };

  const cdp = (metod, params = {}) => {
    const nr = ++id;
    return new Promise((res, rej) => {
      vantande.set(nr, (m) => (m.error ? rej(new Error(`${metod}: ${m.error.message}`)) : res(m.result)));
      ws.send(JSON.stringify({ id: nr, method: metod, params }));
    });
  };
  const js = async (uttryck) =>
    (await cdp('Runtime.evaluate', { expression: uttryck, returnByValue: true })).result.value;

  await cdp('Emulation.setDeviceMetricsOverride', {
    width: 1280, height: 900, deviceScaleFactor: 1, mobile: false,
  });
  await cdp('Page.enable');
  await cdp('Runtime.enable');
  await cdp('Network.enable');

  // ── Rundturen ───────────────────────────────────────────────────────────────

  const domän = new URL(BAS).hostname;

  for (const konto of KONTON) {
    console.log(`\n${konto.roll} (${konto.kod})`);
    let kaka;
    try {
      kaka = await loggaIn(konto.kod);
      console.log('  ✓ inloggning');
    } catch (fel) {
      anmark(`${konto.roll}: ${fel.message}`);
      continue;
    }

    for (const sida of konto.sidor) {
      await cdp('Network.clearBrowserCookies');
      await cdp('Network.setCookie', {
        name: 'psvi_session', value: kaka, domain: domän, path: '/', httpOnly: true,
        secure: BAS.startsWith('https'),
      });

      felILoggen.length = 0;
      laddad = false;
      await cdp('Page.navigate', { url: BAS + sida.url });
      for (let i = 0; i < 150 && !laddad; i++) await vanta(100);
      await vanta(2500);

      const vagen = await js('location.pathname');
      if (vagen !== sida.url) {
        anmark(`${konto.roll}: ${sida.url} hamnade på ${vagen}`);
        continue;
      }

      const flikar = ['(översikt)', ...sida.flikar];
      for (const flik of flikar) {
        if (flik !== '(översikt)') {
          const klickat = await js(
            `(() => { const k = [...document.querySelectorAll('button')]
                .find(b => b.textContent.trim().toLowerCase() === ${JSON.stringify(flik.toLowerCase())});
              if (!k) return false; k.click(); return true; })()`,
          );
          if (!klickat) { anmark(`${konto.roll}: fliken ${flik} saknas på ${sida.url}`); continue; }
          await vanta(2500);
        }

        const text = await js('document.body.innerText');
        /*
         * Jämförs gemener och versaler var för sig missar kontrollen allt som
         * står i en rubrik: webbläsaren återger versalisering från formatmallen,
         * så "Enheter" kommer tillbaka som "ENHETER".
         */
        const sokbar = (text ?? '').toLowerCase();
        const var_ = `${konto.roll}, ${sida.url}${flik === '(översikt)' ? '' : ` → ${flik}`}`;

        if (!text || text.length < 80) { anmark(`${var_}: sidan är tom`); continue; }
        for (const larm of LARMORD) {
          if (larm.test(text)) anmark(`${var_}: innehåller ${larm.source}`);
        }
        if (flik === '(översikt)') {
          for (const krav of sida.kraver) {
            if (!sokbar.includes(krav.toLowerCase())) anmark(`${var_}: saknar "${krav}"`);
          }
        }
        /*
         * Befäl ska aldrig se en enskild persons benämning — utom i notisrutan.
         *
         * En samtalsbegäran nämner med flit den som bett om samtalet; utan
         * namnet vet befälet inte vem hen ska söka upp. Rutan är märkt med
         * data-notiser och läses därför bort innan kontrollen. Utan det här
         * larmade rundturen så fort någon i demon hade en obesvarad begäran,
         * och ett verktyg som ropar varg går man till slut förbi.
         */
        const utanNotiser = await js(
          /*
           * Rutan göms i den LEVANDE sidan och visas igen direkt.
           *
           * Första försöket klonade body och tog bort rutan ur klonen. Men
           * innerText på ett frånkopplat element beter sig som textContent
           * och tar då med innehållet i script-taggarna — där Next lägger
           * sidans data, inklusive samma notistext. Kontrollen larmade
           * fortfarande, på text ingen kan se.
           */
          "(() => { const r = [...document.querySelectorAll('[data-notiser]')];" +
          " const fore = r.map((e) => e.style.display);" +
          " r.forEach((e) => { e.style.display = 'none'; });" +
          " const t = document.body.innerText;" +
          " r.forEach((e, i) => { e.style.display = fore[i]; });" +
          " return t; })()",
        );
        const befalsvy = ['/pluton', '/kompani', '/bataljon', '/rapport'].includes(sida.url);
        /*
         * Kom ingen text tillbaka har kontrollen slutat kontrollera, och en
         * tyst godkänd sida är värre än en falsk varning. Då ska det sägas.
         */
        if (befalsvy && (utanNotiser ?? '').length < 80) {
          anmark(`${var_}: integritetskontrollen kunde inte läsa sidan`);
        }
        if (befalsvy && /\b(värnpliktig|soldat)\s+\d{2}\b/.test((utanNotiser ?? '').toLowerCase())) {
          anmark(`${var_}: en enskild persons benämning syns i en befälsvy`);
        }
        if (felILoggen.length) {
          anmark(`${var_}: fel i webbläsaren — ${felILoggen[0].split('\n')[0]}`);
          felILoggen.length = 0;
        }
        console.log(`  ✓ ${sida.url}${flik === '(översikt)' ? '' : ` → ${flik}`}`);
      }
    }
  }

  // Exporten: den enda vägen ut ur systemet, och lätt att glömma.
  try {
    const kaka = await loggaIn('BEF-P1');
    const csv = await (await fetch(`${BAS}/api/export?typ=dagar&period=7`, {
      headers: { Cookie: `psvi_session=${kaka}` },
    })).text();
    const rader = csv.trim().split('\r\n');
    if (rader.length < 2) anmark('exporten: filen innehåller inga rader');
    else if (/\d+\.\d{3,}/.test(csv)) anmark('exporten: tal med full flyttalsprecision');
    else console.log('\n  ✓ export (CSV)');
  } catch (fel) {
    anmark(`exporten: ${fel.message}`);
  }

  // ── Utfall ──────────────────────────────────────────────────────────────────

  if (brister.length) {
    const { data } = await cdp('Page.captureScreenshot', { format: 'png' });
    const bild = path.join(tmpdir(), `rundtur-fel-${Date.now()}.png`);
    writeFileSync(bild, Buffer.from(data, 'base64'));
    console.log(`\n${brister.length} brister. Sista sidan sparad: ${bild}`);
  } else {
    console.log(`\nAllt fungerade. ${BAS}`);
  }
} catch (fel) {
  // Ett verktyg som ska köras före en uppvisning ska säga vad som gick fel,
  // inte skriva ut en stackspårning.
  console.error(`\nRundturen kunde inte slutföras: ${fel.message}`);
  brister.push(fel.message);
} finally {
  ws?.close();
  chrome.kill();
  stadaProfil(profil);
}

process.exit(brister.length ? 1 : 0);
