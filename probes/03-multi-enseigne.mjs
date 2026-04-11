/**
 * Probe 03 — Test multi-enseigne
 *
 * Teste les sites de courses en ligne français pour voir
 * lesquels exposent des API JSON exploitables.
 */
import { chromium } from 'playwright';

const ENSEIGNES = [
  {
    name: 'Leclerc Drive',
    home: 'https://www.leclercdrive.fr',
    searchUrl: (q) => `https://www.leclercdrive.fr/magasin-drive/recherche?searchTerm=${encodeURIComponent(q)}`,
    apiSearch: (q) => `https://www.leclercdrive.fr/api/rest/live-search/search?storeId=59&term=${encodeURIComponent(q)}`,
  },
  {
    name: 'Auchan',
    home: 'https://www.auchan.fr',
    searchUrl: (q) => `https://www.auchan.fr/recherche?text=${encodeURIComponent(q)}`,
    apiSearch: null,
  },
  {
    name: 'Intermarché',
    home: 'https://www.intermarche.com',
    searchUrl: (q) => `https://www.intermarche.com/recherche?q=${encodeURIComponent(q)}`,
    apiSearch: null,
  },
  {
    name: 'Système U (Courses U)',
    home: 'https://www.coursesu.com',
    searchUrl: (q) => `https://www.coursesu.com/recherche?q=${encodeURIComponent(q)}`,
    apiSearch: null,
  },
];

async function testEnseigne(enseigne) {
  console.log(`\n━━━ ${enseigne.name} ━━━`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    locale: 'fr-FR',
  });
  const page = await context.newPage();

  const results = { name: enseigne.name, home: false, search: false, json: false, products: [] };

  // 1. Page d'accueil
  try {
    const t0 = Date.now();
    await page.goto(enseigne.home, { waitUntil: 'domcontentloaded', timeout: 15000 });
    const title = await page.title();
    const elapsed = Date.now() - t0;
    const isCloudflare = title.includes('Just a moment') || title.includes('Attention');
    console.log(`  Homepage: ${isCloudflare ? '❌ Cloudflare' : '✓'} — "${title.slice(0, 50)}" (${elapsed}ms)`);
    results.home = !isCloudflare;
  } catch (e) {
    console.log(`  Homepage: ❌ ${e.message.slice(0, 60)}`);
    await browser.close();
    return results;
  }

  if (!results.home) {
    await browser.close();
    return results;
  }

  // 2. Recherche produit (page HTML)
  try {
    await page.goto(enseigne.searchUrl('lait'), { waitUntil: 'domcontentloaded', timeout: 15000 });
    const title = await page.title();
    console.log(`  Search page: "${title.slice(0, 60)}"`);
    results.search = true;
  } catch (e) {
    console.log(`  Search page: ❌ ${e.message.slice(0, 60)}`);
  }

  // 3. Tester XHR JSON sur la page de recherche
  try {
    const jsonResult = await page.evaluate(async (searchUrl) => {
      const res = await fetch(searchUrl, {
        headers: {
          'x-requested-with': 'XMLHttpRequest',
          'accept': 'application/json',
        },
      });
      const ct = res.headers.get('content-type') || '';
      if (ct.includes('json')) {
        const data = await res.json();
        return {
          isJson: true, status: res.status,
          keys: Object.keys(data),
          preview: JSON.stringify(data).slice(0, 400),
        };
      }
      return { isJson: false, status: res.status, ct };
    }, enseigne.searchUrl('lait'));

    if (jsonResult.isJson) {
      console.log(`  XHR JSON: ✓ HTTP ${jsonResult.status}`);
      console.log(`    Clés: ${jsonResult.keys.join(', ')}`);
      console.log(`    Aperçu: ${jsonResult.preview.slice(0, 150)}...`);
      results.json = true;
    } else {
      console.log(`  XHR JSON: ❌ HTTP ${jsonResult.status} — ${jsonResult.ct}`);
    }
  } catch (e) {
    console.log(`  XHR JSON: ❌ ${e.message.slice(0, 60)}`);
  }

  // 4. Tester les API dédiées si disponibles
  if (enseigne.apiSearch) {
    try {
      const apiResult = await page.evaluate(async (apiUrl) => {
        const res = await fetch(apiUrl, {
          headers: { 'accept': 'application/json' },
        });
        const ct = res.headers.get('content-type') || '';
        if (ct.includes('json')) {
          const data = await res.json();
          return { isJson: true, status: res.status, preview: JSON.stringify(data).slice(0, 400) };
        }
        return { isJson: false, status: res.status, ct };
      }, enseigne.apiSearch('lait'));

      if (apiResult.isJson) {
        console.log(`  API dédiée: ✓ HTTP ${apiResult.status}`);
        console.log(`    ${apiResult.preview.slice(0, 200)}...`);
      } else {
        console.log(`  API dédiée: ❌ HTTP ${apiResult.status} — ${apiResult.ct}`);
      }
    } catch (e) {
      console.log(`  API dédiée: ❌ ${e.message.slice(0, 60)}`);
    }
  }

  // 5. Chercher __NEXT_DATA__, __INITIAL_STATE__, ou d'autres patterns de données embarquées
  const embeddedData = await page.evaluate(() => {
    const patterns = {
      nextData: !!document.getElementById('__NEXT_DATA__'),
      initialState: !!(window.__INITIAL_STATE__),
      nuxtData: !!(window.__NUXT__),
      windowData: !!(window.__data),
    };

    // Extraire les produits du DOM si possible
    const productSelectors = ['[class*="product-card"]', '[class*="ProductCard"]', '[data-testid*="product"]', 'article[class*="product"]'];
    for (const sel of productSelectors) {
      const cards = document.querySelectorAll(sel);
      if (cards.length > 0) {
        patterns.productCards = { selector: sel, count: cards.length };
        break;
      }
    }

    return patterns;
  });

  console.log(`  Données embarquées: ${JSON.stringify(embeddedData)}`);

  await browser.close();
  return results;
}

async function run() {
  console.log('══════════════════════════════════════');
  console.log('  Probe Multi-Enseigne');
  console.log('══════════════════════════════════════');

  const allResults = [];
  for (const enseigne of ENSEIGNES) {
    const result = await testEnseigne(enseigne);
    allResults.push(result);
  }

  // Résumé
  console.log('\n══════════════════════════════════════');
  console.log('  RÉSUMÉ');
  console.log('══════════════════════════════════════');
  console.log('Enseigne          | Homepage | Search | JSON API');
  console.log('------------------|----------|--------|----------');
  for (const r of allResults) {
    const h = r.home ? '✓' : '❌';
    const s = r.search ? '✓' : '❌';
    const j = r.json ? '✓' : '❌';
    console.log(`${r.name.padEnd(18)}| ${h.padEnd(9)}| ${s.padEnd(7)}| ${j}`);
  }
}

run().catch(e => { console.error(e); process.exit(1); });
