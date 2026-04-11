/**
 * Probe 05 — Auchan deep dive complet
 *
 * Auchan n'a pas de Cloudflare/DataDome agressif.
 * On cherche : les endpoints API produits, le mécanisme de sélection magasin,
 * et le format des données.
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
  console.log('══════════════════════════════════════');
  console.log('  Probe Auchan — Deep Dive Complet');
  console.log('══════════════════════════════════════\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    locale: 'fr-FR',
  });
  const page = await context.newPage();

  // Capturer TOUTES les requêtes réseau vers auchan
  const allXhr = [];
  page.on('request', req => {
    const url = req.url();
    if ((req.resourceType() === 'xhr' || req.resourceType() === 'fetch') &&
        (url.includes('auchan') || url.includes('search') || url.includes('product'))) {
      allXhr.push({
        method: req.method(),
        url,
        body: req.postData()?.slice(0, 500),
      });
    }
  });

  const apiResponses = [];
  page.on('response', async res => {
    const url = res.url();
    const ct = res.headers()['content-type'] || '';
    if (ct.includes('json') && url.includes('auchan') &&
        (url.includes('product') || url.includes('search') || url.includes('cart') ||
         url.includes('store') || url.includes('journey') || url.includes('catalog'))) {
      try {
        const body = await res.text();
        apiResponses.push({ url: url.slice(0, 150), status: res.status(), body: body.slice(0, 1000) });
      } catch {}
    }
  });

  // ━━━ ÉTAPE 1: Homepage et exploration ━━━
  console.log('━━━ ÉTAPE 1: Homepage ━━━');
  await page.goto('https://www.auchan.fr', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(2000);
  console.log(`  Titre: ${await page.title()}`);

  // ━━━ ÉTAPE 2: Trouver le mécanisme de sélection magasin ━━━
  console.log('\n━━━ ÉTAPE 2: Sélection magasin ━━━');

  // Tester les endpoints journey/store
  const storeEndpoints = [
    '/journey',
    '/journey/locator/configuration',
    '/cart/config',
  ];

  for (const ep of storeEndpoints) {
    const result = await page.evaluate(async (url) => {
      try {
        const res = await fetch(url, { headers: { accept: 'application/json' } });
        const ct = res.headers.get('content-type') || '';
        if (ct.includes('json')) return { status: res.status, data: await res.json() };
        return { status: res.status, ct };
      } catch (e) { return { error: e.message }; }
    }, ep);

    if (result.data) {
      console.log(`  ${ep}: ✓ HTTP ${result.status}`);
      console.log(`    ${JSON.stringify(result.data).slice(0, 200)}`);
      await save(`endpoint-${ep.replace(/\//g, '-')}`, result.data);
    } else {
      console.log(`  ${ep}: ${result.status || result.error}`);
    }
  }

  // ━━━ ÉTAPE 3: Recherche produit avec réseau complet ━━━
  console.log('\n━━━ ÉTAPE 3: Recherche "lait demi ecreme" ━━━');
  allXhr.length = 0;
  apiResponses.length = 0;

  await page.goto('https://www.auchan.fr/recherche?text=lait+demi+ecreme', {
    waitUntil: 'domcontentloaded', timeout: 20000,
  });
  await page.waitForTimeout(4000);

  console.log(`\n  ${allXhr.length} requêtes XHR capturées:`);
  for (const req of allXhr) {
    const shortUrl = req.url.replace('https://www.auchan.fr', '').replace('https://api.auchan.fr', '[API]');
    console.log(`    ${req.method} ${shortUrl.slice(0, 120)}`);
    if (req.body) console.log(`      Body: ${req.body.slice(0, 200)}`);
  }

  console.log(`\n  ${apiResponses.length} réponses JSON API capturées:`);
  for (const res of apiResponses) {
    const shortUrl = res.url.replace('https://www.auchan.fr', '').replace('https://api.auchan.fr', '[API]');
    console.log(`    HTTP ${res.status} ${shortUrl}`);
    console.log(`      ${res.body.slice(0, 200)}`);
  }

  await save('xhr-search', allXhr);
  await save('api-responses-search', apiResponses);

  // ━━━ ÉTAPE 4: Extraire les produits de la page ━━━
  console.log('\n━━━ ÉTAPE 4: Extraction produits ━━━');

  const pageProducts = await page.evaluate(() => {
    // Chercher toutes les structures possibles
    const result = {};

    // 1. Articles
    const articles = document.querySelectorAll('article');
    result.articleCount = articles.length;

    // 2. Product cards avec différents sélecteurs
    const selectors = [
      'article[class*="product"]',
      '[data-testid*="product"]',
      '[class*="ProductCard"]',
      '[class*="product-card"]',
      '[class*="product-list"] li',
      '[class*="productList"] li',
    ];

    for (const sel of selectors) {
      const els = document.querySelectorAll(sel);
      if (els.length > 0) {
        result[sel] = els.length;
      }
    }

    // 3. Analyser les classes des articles
    if (articles.length > 0) {
      result.firstArticleClasses = articles[0].className;
      result.firstArticleHTML = articles[0].innerHTML.slice(0, 500);

      // Essayer d'extraire des données
      const products = [];
      for (const art of Array.from(articles).slice(0, 5)) {
        const p = {};
        // Tous les éléments texte
        const allText = art.innerText?.split('\n').filter(t => t.trim()).slice(0, 10);
        p.texts = allText;

        // Liens
        const links = art.querySelectorAll('a[href]');
        p.links = Array.from(links).map(a => a.getAttribute('href')).filter(h => h.length > 5).slice(0, 3);

        // Images
        const imgs = art.querySelectorAll('img');
        p.images = Array.from(imgs).map(i => i.src?.slice(0, 80)).slice(0, 2);

        // Data attributes
        const dataAttrs = {};
        for (const attr of art.attributes) {
          if (attr.name.startsWith('data-')) dataAttrs[attr.name] = attr.value?.slice(0, 60);
        }
        p.dataAttrs = dataAttrs;

        products.push(p);
      }
      result.products = products;
    }

    return result;
  });

  console.log(`  Articles: ${pageProducts.articleCount}`);
  for (const [sel, count] of Object.entries(pageProducts).filter(([k]) => k.startsWith('article') || k.startsWith('[') || k.startsWith('.'))) {
    if (typeof count === 'number') console.log(`  ${sel}: ${count}`);
  }

  if (pageProducts.products) {
    console.log(`\n  Premiers produits:`);
    for (const p of pageProducts.products.slice(0, 5)) {
      console.log(`    Textes: ${p.texts?.join(' | ')?.slice(0, 120)}`);
      console.log(`    Liens: ${p.links?.join(', ')?.slice(0, 100)}`);
      console.log(`    Data: ${JSON.stringify(p.dataAttrs)}`);
      console.log('');
    }
  }

  await save('products-dom', pageProducts);

  // ━━━ ÉTAPE 5: Tester api.auchan.fr ━━━
  console.log('\n━━━ ÉTAPE 5: Explorer api.auchan.fr ━━━');

  const apiTests = [
    { url: 'https://api.auchan.fr/v2/products/search?q=lait&lang=fr&pageSize=3', name: 'v2/products/search' },
    { url: 'https://api.auchan.fr/v1/search?q=lait&lang=fr', name: 'v1/search' },
    { url: 'https://api.auchan.fr/catalog/search?q=lait', name: 'catalog/search' },
    { url: 'https://api.auchan.fr/search?q=lait', name: 'search' },
    { url: 'https://api.auchan.fr/store/list?lat=49.25&lng=6.13', name: 'store/list' },
    { url: 'https://api.auchan.fr/stores?lat=49.25&lng=6.13', name: 'stores' },
  ];

  for (const test of apiTests) {
    const result = await page.evaluate(async (url) => {
      try {
        const res = await fetch(url, {
          headers: { accept: 'application/json', 'x-requested-with': 'XMLHttpRequest' },
        });
        const ct = res.headers.get('content-type') || '';
        const text = await res.text();
        return {
          status: res.status,
          isJson: ct.includes('json'),
          preview: text.slice(0, 300),
        };
      } catch (e) { return { error: e.message }; }
    }, test.url);

    const icon = result.isJson ? '✓ JSON' : `❌ ${result.status}`;
    console.log(`  ${test.name}: ${icon}`);
    if (result.isJson || (result.status >= 200 && result.status < 300)) {
      console.log(`    ${result.preview?.slice(0, 150)}`);
    }
  }

  // ━━━ ÉTAPE 6: Inspecter les XHR de chargement pour trouver l'API produit ━━━
  console.log('\n━━━ ÉTAPE 6: XHR contenant "product" ou "search" ━━━');
  const productXhr = allXhr.filter(r =>
    r.url.includes('product') || r.url.includes('search') || r.url.includes('catalog')
  );
  for (const r of productXhr) {
    console.log(`  ${r.method} ${r.url.slice(0, 150)}`);
    if (r.body) console.log(`    ${r.body.slice(0, 200)}`);
  }

  if (productXhr.length === 0) {
    console.log('  Aucune requête product/search/catalog capturée');
    console.log('  → Les produits sont probablement rendus côté serveur (SSR)');
  }

  await browser.close();
  console.log('\n=== Fin ===');
}

run().catch(e => { console.error(e); process.exit(1); });
