/**
 * Probe 04 — Auchan deep dive
 * Auchan passe sans protection anti-bot et a des product cards dans le DOM.
 */
import { chromium } from 'playwright';

async function run() {
  console.log('=== Probe Auchan — Deep Dive ===\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    locale: 'fr-FR',
  });
  const page = await context.newPage();

  // Intercepter les XHR
  const xhrLog = [];
  page.on('request', req => {
    if ((req.resourceType() === 'xhr' || req.resourceType() === 'fetch') && req.url().includes('auchan')) {
      xhrLog.push({ method: req.method(), url: req.url().slice(0, 150), body: req.postData()?.slice(0, 300) });
    }
  });

  // 1. Page de recherche
  console.log('[1] Recherche "lait demi ecreme"...');
  await page.goto('https://www.auchan.fr/recherche?text=lait+demi+ecreme', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(3000);
  console.log(`    Titre: ${await page.title()}`);
  console.log(`    ${xhrLog.length} requêtes XHR interceptées`);

  // 2. Extraire les produits du DOM
  console.log('\n[2] Extraction produits DOM...');
  const products = await page.evaluate(() => {
    const articles = document.querySelectorAll('article[class*="product"]');
    return Array.from(articles).slice(0, 8).map(art => {
      const titleEl = art.querySelector('a[class*="title"], h2, [class*="Title"], [class*="name"]');
      const priceEl = art.querySelector('[class*="price"], [class*="Price"]');
      const link = art.querySelector('a[href*="/p/"]');
      const img = art.querySelector('img');
      const brandEl = art.querySelector('[class*="brand"], [class*="Brand"]');

      return {
        title: titleEl?.textContent?.trim()?.slice(0, 80),
        price: priceEl?.textContent?.trim()?.replace(/\s+/g, ' ')?.slice(0, 30),
        brand: brandEl?.textContent?.trim(),
        url: link?.getAttribute('href'),
        image: img?.src?.slice(0, 100),
        classes: art.className?.slice(0, 80),
      };
    });
  });

  for (const p of products) {
    console.log(`    ${p.title || '(sans titre)'} — ${p.price || '(sans prix)'}`);
    if (p.url) console.log(`      URL: ${p.url?.slice(0, 80)}`);
  }

  // 3. Chercher les données embarquées
  console.log('\n[3] Données embarquées...');
  const embedded = await page.evaluate(() => {
    const result = {};

    // Next.js, Nuxt, etc.
    if (document.getElementById('__NEXT_DATA__')) {
      const data = JSON.parse(document.getElementById('__NEXT_DATA__').textContent);
      result.nextData = { keys: Object.keys(data), pagePropsKeys: Object.keys(data.props?.pageProps || {}) };
    }

    // Chercher window.* data
    for (const key of ['__INITIAL_STATE__', '__NUXT__', '__data', '__APOLLO_STATE__', '__PRELOADED_STATE__']) {
      if (window[key]) {
        const val = window[key];
        result[key] = typeof val === 'object' ? Object.keys(val).slice(0, 10) : typeof val;
      }
    }

    // Chercher des scripts JSON-LD (structured data)
    const jsonLd = document.querySelectorAll('script[type="application/ld+json"]');
    if (jsonLd.length > 0) {
      result.jsonLd = Array.from(jsonLd).map(s => {
        try {
          const d = JSON.parse(s.textContent);
          return { type: d['@type'], name: d.name?.slice(0, 40) };
        } catch { return null; }
      }).filter(Boolean);
    }

    return result;
  });
  console.log(`    ${JSON.stringify(embedded, null, 2)}`);

  // 4. Lister les XHR captés pendant le chargement
  console.log('\n[4] Requêtes XHR pendant le chargement...');
  for (const req of xhrLog.slice(0, 15)) {
    console.log(`    ${req.method} ${req.url}`);
    if (req.body) console.log(`      Body: ${req.body.slice(0, 150)}`);
  }

  // 5. Tester des endpoints API probables
  console.log('\n[5] Test endpoints API...');
  const apiTests = [
    '/api/search?text=lait',
    '/api/products/search?q=lait',
    '/on/demandware.store/Sites-Auchan-Site/fr_FR/Search-Show?q=lait&format=ajax',
  ];

  for (const endpoint of apiTests) {
    const result = await page.evaluate(async (url) => {
      try {
        const res = await fetch(url, {
          headers: { 'accept': 'application/json', 'x-requested-with': 'XMLHttpRequest' }
        });
        const ct = res.headers.get('content-type') || '';
        if (ct.includes('json')) {
          const data = await res.json();
          return { status: res.status, json: true, preview: JSON.stringify(data).slice(0, 200) };
        }
        return { status: res.status, json: false, ct, size: (await res.text()).length };
      } catch (e) { return { error: e.message }; }
    }, endpoint);
    console.log(`    ${endpoint}: ${result.json ? `✓ JSON — ${result.preview?.slice(0, 100)}` : `❌ ${result.status} ${result.ct || result.error}`}`);
  }

  await browser.close();
  console.log('\n=== Fin ===');
}

run().catch(e => { console.error(e); process.exit(1); });
