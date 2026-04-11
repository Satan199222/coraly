/**
 * Probe 07 — Auchan : sélection magasin via le flow UI
 */
import { chromium } from 'playwright';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

const RESULTS_DIR = join(import.meta.dirname, 'results');
async function save(name, data) {
  await mkdir(RESULTS_DIR, { recursive: true });
  await writeFile(join(RESULTS_DIR, `auchan-${name}.json`), JSON.stringify(data, null, 2));
}

async function run() {
  console.log('=== Auchan : sélection magasin via UI ===\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    locale: 'fr-FR',
  });
  const page = await context.newPage();

  // Capturer les requêtes API
  const apiLog = [];
  page.on('request', req => {
    const url = req.url();
    if ((req.resourceType() === 'xhr' || req.resourceType() === 'fetch') &&
        url.includes('auchan') &&
        (url.includes('journey') || url.includes('store') || url.includes('locator'))) {
      apiLog.push({ dir: '→', method: req.method(), url: url.slice(0, 150), body: req.postData()?.slice(0, 400) });
    }
  });
  page.on('response', async res => {
    const url = res.url();
    if (url.includes('auchan') &&
        (url.includes('journey') || url.includes('store') || url.includes('locator'))) {
      try {
        apiLog.push({ dir: '←', status: res.status(), url: url.slice(0, 150), body: (await res.text()).slice(0, 400) });
      } catch {}
    }
  });

  // 1. Homepage
  await page.goto('https://www.auchan.fr', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(2000);

  // Fermer cookie banner
  await page.evaluate(() => {
    const btn = document.querySelector('#onetrust-reject-all-handler, [id*="reject"]');
    if (btn) btn.click();
  });
  await page.waitForTimeout(500);

  // 2. Cliquer "Choisir un drive ou la livraison"
  console.log('[1] Clic "Choisir un drive ou la livraison"...');
  apiLog.length = 0;

  const clicked = await page.evaluate(() => {
    const btn = document.querySelector('.journey-reminder__initial-choice-button, [class*="journey-reminder"]');
    if (btn) { btn.click(); return true; }
    return false;
  });
  console.log(`  Cliqué: ${clicked}`);
  await page.waitForTimeout(2000);

  // 3. Voir le modal qui s'ouvre
  console.log('\n[2] Modal ouvert...');
  const modal = await page.evaluate(() => {
    const dialogs = document.querySelectorAll('[role="dialog"], [class*="modal"], [class*="Modal"], [class*="overlay"], [class*="Overlay"], [class*="journey-selector"]');
    for (const d of dialogs) {
      if (d.offsetParent !== null || d.style.display !== 'none') {
        const buttons = Array.from(d.querySelectorAll('button, a'))
          .map(b => ({
            text: b.textContent?.trim()?.slice(0, 60),
            class: b.className?.toString?.()?.slice(0, 60),
            href: b.getAttribute('href'),
          }))
          .filter(b => b.text && b.text.length > 2);

        const inputs = Array.from(d.querySelectorAll('input'))
          .map(i => ({ type: i.type, name: i.name, placeholder: i.placeholder, id: i.id }));

        return {
          class: d.className?.toString?.()?.slice(0, 80),
          text: d.innerText?.slice(0, 500),
          buttons,
          inputs,
        };
      }
    }
    return null;
  });

  if (modal) {
    console.log(`  Class: ${modal.class}`);
    console.log(`  Texte: ${modal.text?.slice(0, 200)}`);
    console.log(`  Boutons: ${modal.buttons?.map(b => `"${b.text}"`).join(', ')}`);
    console.log(`  Inputs: ${JSON.stringify(modal.inputs)}`);
  } else {
    console.log('  Aucun modal trouvé — essai clic direct sur le header');

    // Essayer l'autre bouton
    await page.evaluate(() => {
      const btn = document.querySelector('.context-header__button');
      if (btn) btn.click();
    });
    await page.waitForTimeout(2000);

    const modal2 = await page.evaluate(() => {
      const all = document.querySelectorAll('[class*="journey"], [class*="locator"], [class*="store-select"], [role="dialog"]');
      for (const el of all) {
        if (el.offsetParent !== null && el.textContent?.length > 50) {
          return {
            class: el.className?.toString?.()?.slice(0, 80),
            text: el.innerText?.slice(0, 500),
          };
        }
      }
      return null;
    });

    if (modal2) {
      console.log(`  Modal 2: ${modal2.text?.slice(0, 200)}`);
    }
  }

  // 4. Requêtes API capturées
  console.log(`\n[3] ${apiLog.length} requêtes API:`);
  for (const r of apiLog) {
    console.log(`  ${r.dir} ${r.method || ''} ${r.status || ''} ${r.url.replace('https://www.auchan.fr', '').replace('https://api.auchan.fr', '[API]')}`);
    if (r.body) console.log(`    ${r.body.slice(0, 200)}`);
  }

  // 5. Essayer l'approche directe : aller sur une URL de drive spécifique
  console.log('\n[4] Test URL Drive direct...');
  apiLog.length = 0;

  // Auchan Drive URLs typiques
  const driveUrls = [
    'https://www.auchan.fr/magasin/drive-amneville/s-208-cl-drive',
    'https://www.auchan.fr/magasin/drive-semecourt/s-208-cl-drive',
  ];

  for (const url of driveUrls) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 });
      const title = await page.title();
      console.log(`  ${url.split('/').pop()}: "${title?.slice(0, 50)}" — HTTP ${page.url().includes('404') ? '404' : 'OK'}`);
    } catch (e) {
      console.log(`  ${url.split('/').pop()}: timeout`);
    }
  }

  // 6. Essayer la recherche avec un paramètre storeId
  console.log('\n[5] Recherche avec paramètre magasin...');
  const searchWithStore = [
    '/recherche?text=lait&storeId=208',
    '/recherche?text=lait&store=208',
    '/recherche?text=lait&storeReference=208',
  ];

  for (const url of searchWithStore) {
    await page.goto(`https://www.auchan.fr${url}`, { waitUntil: 'domcontentloaded', timeout: 10000 });
    await page.waitForTimeout(1500);

    const priceCheck = await page.evaluate(() => {
      const priceEls = document.querySelectorAll('[class*="price"], [class*="Price"]');
      const prices = Array.from(priceEls)
        .map(el => el.textContent?.trim())
        .filter(t => t && t.match(/\d/) && !t.includes('Afficher'))
        .slice(0, 3);
      return prices;
    });

    console.log(`  ${url}: ${priceCheck.length > 0 ? `✓ Prix: ${priceCheck.join(', ')}` : '❌ Pas de prix'}`);
  }

  // 7. Tester l'approche cookie — set un cookie de magasin manuellement
  console.log('\n[6] Test cookie magasin...');
  await context.addCookies([
    { name: 'auchan_store_id', value: '208', domain: '.auchan.fr', path: '/' },
    { name: 'storeReference', value: '208', domain: '.auchan.fr', path: '/' },
    { name: 'journey_store', value: '208', domain: '.auchan.fr', path: '/' },
  ]);

  await page.goto('https://www.auchan.fr/recherche?text=lait+demi+ecreme', {
    waitUntil: 'domcontentloaded', timeout: 15000,
  });
  await page.waitForTimeout(2000);

  const pricesAfterCookie = await page.evaluate(() => {
    const articles = document.querySelectorAll('article[class*="product"]');
    return Array.from(articles).slice(0, 3).map(art => ({
      text: art.innerText?.split('\n').filter(t => t.trim()).slice(0, 5).join(' | '),
      hasPrice: !art.textContent?.includes('Afficher le prix') ||
                !!art.textContent?.match(/\d+[,\.]\d{2}\s*€/),
    }));
  });

  for (const p of pricesAfterCookie) {
    console.log(`  ${p.hasPrice ? '✓' : '❌'} ${p.text?.slice(0, 100)}`);
  }

  await browser.close();
  console.log('\n=== Fin ===');
}

run().catch(e => { console.error(e); process.exit(1); });
