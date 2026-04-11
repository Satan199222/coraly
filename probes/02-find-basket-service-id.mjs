/**
 * Probe 02 — Trouver le basketServiceId
 *
 * Le basketServiceId est nécessaire pour PATCH /api/cart.
 * On le cherche dans le Vuex store de la fiche produit après set-store.
 */
import { chromium } from 'playwright';

async function run() {
  console.log('=== Probe: trouver le basketServiceId ===\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    locale: 'fr-FR',
  });
  const page = await context.newPage();

  // 1. Passer Cloudflare
  await page.goto('https://www.carrefour.fr', { waitUntil: 'domcontentloaded', timeout: 30000 });

  // 2. Sélectionner le magasin
  console.log('[1] set-store/850055...');
  await page.evaluate(async () => {
    await fetch('/set-store/850055', {
      headers: { 'x-requested-with': 'XMLHttpRequest', 'accept': 'application/json' }
    });
  });

  // 3. Aller sur une fiche produit
  console.log('[2] Fiche produit...');
  await page.goto('https://www.carrefour.fr/p/lait-demi-ecreme-uht-vitamine-d-lactel-3252210390014', {
    waitUntil: 'domcontentloaded', timeout: 30000
  });
  await page.waitForTimeout(3000);

  // 4. Fouiller TOUT pour trouver le basketServiceId
  console.log('[3] Recherche basketServiceId...\n');

  const findings = await page.evaluate(() => {
    const result = {};

    // A. window.context
    result.windowContextStore = window.context?.store;

    // B. __INITIAL_STATE__ — chercher "basketServiceId" en profondeur
    const stateStr = JSON.stringify(window.__INITIAL_STATE__ || {});
    const bsidPattern = /basketServiceId['"]*:['"]*([^'"}\s,]+)/gi;
    const stateMatches = [];
    let m;
    while ((m = bsidPattern.exec(stateStr)) !== null && stateMatches.length < 5) {
      stateMatches.push(m[0]);
    }
    result.inInitialState = stateMatches;

    // C. Instance Vue live
    const app = document.querySelector('#app')?.__vue_app__;
    if (app) {
      const store = app.config?.globalProperties?.$store;
      if (store?.state) {
        const liveStr = JSON.stringify(store.state);
        const liveMatches = [];
        const re = /basketServiceId['"]*:['"]*([^'"}\s,]+)/gi;
        let lm;
        while ((lm = re.exec(liveStr)) !== null && liveMatches.length < 5) {
          liveMatches.push(lm[0]);
        }
        result.inLiveVuex = liveMatches;

        // Extraire les clés de shop.store si ça existe
        if (store.state.shop?.store) {
          result.liveShopStore = store.state.shop.store;
        }
        if (store.state.shop) {
          result.liveShopKeys = Object.keys(store.state.shop);
        }
      }
    }

    // D. Chercher dans le HTML brut
    const html = document.documentElement.innerHTML;
    const htmlMatches = [];
    const htmlRe = /basketServiceId['"]*\s*[:=]\s*['"]*([A-Za-z0-9_-]+)/gi;
    let hm;
    while ((hm = htmlRe.exec(html)) !== null && htmlMatches.length < 5) {
      htmlMatches.push(hm[0]);
    }
    result.inHTML = htmlMatches;

    // E. Chercher offerServiceId (on le connaît: "0261-150-6")
    // et le pattern "A4CA-151-850055" qu'on a vu dans le test réussi
    const offerPattern = /[A-Z0-9]{4}-\d{3}-\d+/g;
    const offerMatches = new Set();
    let om;
    while ((om = offerPattern.exec(html)) !== null && offerMatches.size < 10) {
      offerMatches.add(om[0]);
    }
    result.serviceIdPatterns = [...offerMatches];

    return result;
  });

  console.log('window.context.store:', JSON.stringify(findings.windowContextStore, null, 2));
  console.log('\nbasketServiceId dans __INITIAL_STATE__:', findings.inInitialState);
  console.log('basketServiceId dans Vuex live:', findings.inLiveVuex);
  console.log('basketServiceId dans HTML:', findings.inHTML);
  console.log('\nshop.store live:', JSON.stringify(findings.liveShopStore, null, 2)?.slice(0, 500));
  console.log('shop keys:', findings.liveShopKeys);
  console.log('\nPatterns serviceId (XXXX-NNN-NNNNN):', findings.serviceIdPatterns);

  await browser.close();
  console.log('\n=== Fin ===');
}

run().catch(e => { console.error(e); process.exit(1); });
