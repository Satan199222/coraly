/**
 * Probe 06 — Auchan : sélection magasin → prix → panier
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
  console.log('=== Auchan : magasin → prix → panier ===\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    locale: 'fr-FR',
  });
  const page = await context.newPage();

  // Capturer les requêtes API
  const apiLog = [];
  page.on('response', async res => {
    const url = res.url();
    const ct = res.headers()['content-type'] || '';
    if (ct.includes('json') && url.includes('auchan') &&
        (url.includes('journey') || url.includes('store') || url.includes('cart') || url.includes('product'))) {
      try {
        apiLog.push({ url: url.slice(0, 150), status: res.status(), body: (await res.text()).slice(0, 500) });
      } catch {}
    }
  });

  // 1. Homepage
  await page.goto('https://www.auchan.fr', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(2000);

  // 2. Chercher le sélecteur de magasin
  console.log('[1] Recherche du sélecteur de magasin...');
  const storeSelector = await page.evaluate(() => {
    // Chercher les boutons/liens liés au magasin
    const candidates = document.querySelectorAll('button, a, [class*="store"], [class*="Store"], [class*="journey"], [class*="locator"]');
    return Array.from(candidates)
      .filter(el => {
        const text = (el.textContent?.trim() || '').toLowerCase();
        return (text.includes('magasin') || text.includes('drive') || text.includes('retrait') ||
                text.includes('livraison') || text.includes('choisir')) && text.length < 100;
      })
      .map(el => ({
        tag: el.tagName,
        text: el.textContent?.trim()?.slice(0, 60),
        class: el.className?.toString?.()?.slice(0, 80),
        href: el.getAttribute('href'),
        rect: el.getBoundingClientRect(),
      }))
      .slice(0, 10);
  });

  for (const s of storeSelector) {
    console.log(`    ${s.tag} "${s.text}" — ${s.class?.slice(0, 40)} — (${Math.round(s.rect.x)},${Math.round(s.rect.y)})`);
  }

  // 3. Essayer de set un magasin via l'API journey
  console.log('\n[2] Set magasin via API journey...');

  // D'abord récupérer la config locator pour comprendre le format
  const journeyResult = await page.evaluate(async () => {
    // Lire le journey actuel
    const journey = await fetch('/journey', { headers: { accept: 'application/json' } }).then(r => r.json());

    return journey;
  });
  console.log(`  Journey ID: ${journeyResult.id}`);
  console.log(`  Contextes: ${JSON.stringify(journeyResult.activeContexts?.map(c => c.type))}`);
  await save('journey', journeyResult);

  // 4. Essayer de choisir un magasin
  console.log('\n[3] Tentative sélection magasin Auchan...');

  // Essayer PUT /journey avec un magasin
  const storeAttempts = [
    {
      name: 'PUT /journey (store GROCERY)',
      method: 'PUT',
      url: '/journey',
      body: {
        id: journeyResult.id,
        activeContexts: [
          { type: 'GROCERY', context: { type: 'DRIVE', storeReference: '208', storeCode: '208' } },
        ],
      },
    },
    {
      name: 'POST /journey/select-store',
      method: 'POST',
      url: '/journey/select-store',
      body: { storeReference: '208', journeyType: 'DRIVE' },
    },
    {
      name: 'POST /journey/locator/select',
      method: 'POST',
      url: '/journey/locator/select',
      body: { storeReference: '208', type: 'DRIVE' },
    },
  ];

  for (const attempt of storeAttempts) {
    const result = await page.evaluate(async ({ method, url, body }) => {
      try {
        const res = await fetch(url, {
          method,
          headers: { 'content-type': 'application/json', accept: 'application/json' },
          body: JSON.stringify(body),
        });
        const ct = res.headers.get('content-type') || '';
        const text = await res.text();
        return { status: res.status, isJson: ct.includes('json'), body: text.slice(0, 300) };
      } catch (e) { return { error: e.message }; }
    }, attempt);

    console.log(`  ${attempt.name}: HTTP ${result.status || result.error}`);
    console.log(`    ${result.body?.slice(0, 150) || ''}`);
  }

  // 5. Recherche après tentative de sélection
  console.log('\n[4] Recherche après sélection magasin...');
  await page.goto('https://www.auchan.fr/recherche?text=lait+demi+ecreme', {
    waitUntil: 'domcontentloaded', timeout: 20000,
  });
  await page.waitForTimeout(3000);

  const productsAfterStore = await page.evaluate(() => {
    const articles = document.querySelectorAll('article[class*="product"]');
    return Array.from(articles).slice(0, 5).map(art => {
      const texts = art.innerText?.split('\n').filter(t => t.trim()).slice(0, 8);
      const link = art.querySelector('a[href*="/pr-"]');
      const dataId = art.getAttribute('data-id');
      // Chercher spécifiquement les éléments prix
      const priceEl = art.querySelector('[class*="price"], [class*="Price"]');
      return {
        texts,
        priceText: priceEl?.textContent?.trim(),
        url: link?.getAttribute('href'),
        dataId,
      };
    });
  });

  for (const p of productsAfterStore) {
    console.log(`  ${p.texts?.slice(0, 4).join(' | ')}`);
    console.log(`    Prix: ${p.priceText || '(pas de prix)'} — URL: ${p.url?.slice(0, 50)}`);
    console.log('');
  }

  // 6. Essayer le clic sur "Afficher le prix" / lien produit
  console.log('[5] Clic sur un produit pour voir la fiche...');
  const firstProductUrl = productsAfterStore[0]?.url;
  if (firstProductUrl) {
    apiLog.length = 0;
    await page.goto(`https://www.auchan.fr${firstProductUrl}`, {
      waitUntil: 'domcontentloaded', timeout: 20000,
    });
    await page.waitForTimeout(3000);

    const productDetail = await page.evaluate(() => {
      const result = {};
      result.title = document.querySelector('h1')?.textContent?.trim();

      // Tous les prix sur la page
      const priceEls = document.querySelectorAll('[class*="price"], [class*="Price"]');
      result.prices = Array.from(priceEls)
        .map(el => el.textContent?.trim())
        .filter(t => t && t.length < 50)
        .slice(0, 5);

      // JSON-LD structured data
      const jsonLd = document.querySelector('script[type="application/ld+json"]');
      if (jsonLd) {
        try { result.jsonLd = JSON.parse(jsonLd.textContent); } catch {}
      }

      // Boutons
      result.buttons = Array.from(document.querySelectorAll('button'))
        .filter(b => {
          const t = b.textContent?.trim() || '';
          return t.includes('panier') || t.includes('Ajouter') || t.includes('Acheter');
        })
        .map(b => b.textContent?.trim()?.slice(0, 60))
        .slice(0, 5);

      return result;
    });

    console.log(`  Titre: ${productDetail.title}`);
    console.log(`  Prix trouvés: ${productDetail.prices?.join(', ') || 'aucun'}`);
    console.log(`  JSON-LD: ${JSON.stringify(productDetail.jsonLd)?.slice(0, 200)}`);
    console.log(`  Boutons: ${productDetail.buttons?.join(', ')}`);
    await save('product-detail', productDetail);

    // API responses
    if (apiLog.length > 0) {
      console.log(`\n  ${apiLog.length} réponses API sur la fiche produit:`);
      for (const r of apiLog) {
        console.log(`    ${r.status} ${r.url.replace('https://www.auchan.fr', '').slice(0, 100)}`);
      }
    }
  }

  await browser.close();
  console.log('\n=== Fin ===');
}

run().catch(e => { console.error(e); process.exit(1); });
