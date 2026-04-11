/**
 * Probe 08 — Auchan : test complet sans Playwright
 *
 * Auchan n'a pas d'anti-bot → on teste avec fetch Node.js natif.
 * Flow : homepage cookies → journey/update → search HTML → prix → cart → fiche produit
 */

const BASE = 'https://www.auchan.fr';
let cookies = '';

async function auchanFetch(path, options = {}) {
  const url = path.startsWith('http') ? path : `${BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'accept': 'application/json, text/html, */*',
      'accept-language': 'fr-FR,fr;q=0.9',
      'x-requested-with': 'XMLHttpRequest',
      ...(cookies ? { cookie: cookies } : {}),
      ...options.headers,
    },
    redirect: 'manual',
  });

  const setCookies = res.headers.getSetCookie?.() || [];
  if (setCookies.length > 0) {
    const newCookies = setCookies.map(c => c.split(';')[0]).join('; ');
    cookies = cookies ? `${cookies}; ${newCookies}` : newCookies;
  }

  return res;
}

async function run() {
  console.log('══════════════════════════════════════════');
  console.log('  Auchan — Test SANS Playwright (fetch natif)');
  console.log('══════════════════════════════════════════\n');

  // ━━━ 1. Homepage ━━━
  console.log('━━━ 1. Homepage ━━━');
  const homeRes = await auchanFetch('/');
  const homeText = await homeRes.text();
  const blocked = homeText.includes('Just a moment') || homeText.includes('captcha');
  console.log(`  HTTP ${homeRes.status} — ${homeText.length} bytes — Bloqué: ${blocked ? 'OUI ❌' : 'NON ✓'}`);
  console.log(`  Cookies: ${cookies.split(';').length}`);

  if (blocked) { console.log('  ARRÊT — anti-bot détecté'); return; }

  // ━━━ 2. Sélection magasin ━━━
  console.log('\n━━━ 2. Sélection magasin Semécourt ━━━');
  const journeyBody = new URLSearchParams({
    'offeringContext.seller.id': '7aeec5f4-3a03-43c5-b1b3-6b65b070f430',
    'offeringContext.channels[0]': 'PICK_UP',
    'offeringContext.storeReference': '956',
    'address.zipcode': '57360',
    'address.city': 'Amnéville',
    'address.country': 'France',
    'location.latitude': '49.260361',
    'location.longitude': '6.142074',
    'accuracy': 'MUNICIPALITY',
  });

  const journeyRes = await auchanFetch('/journey/update', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: journeyBody.toString(),
  });
  console.log(`  HTTP ${journeyRes.status}`);

  if (journeyRes.status >= 300 && journeyRes.status < 400) {
    const loc = journeyRes.headers.get('location');
    console.log(`  Redirect → ${loc}`);
    const followRes = await auchanFetch(loc);
    await followRes.text();
    console.log(`  Follow: HTTP ${followRes.status}`);
  } else {
    await journeyRes.text();
  }

  // ━━━ 3. Recherche avec prix ━━━
  console.log('\n━━━ 3. Recherche "lait demi ecreme" ━━━');
  const searchRes = await auchanFetch('/recherche?text=lait+demi+ecreme', {
    headers: { accept: 'text/html' },
  });
  const searchHtml = await searchRes.text();
  console.log(`  HTTP ${searchRes.status} — ${searchHtml.length} bytes`);

  // Parser les produits
  const productRegex = /<article[^>]*class="[^"]*product[^"]*"[^>]*data-id="([^"]*)"[^>]*>([\s\S]*?)<\/article>/gi;
  const products = [];
  let m;
  while ((m = productRegex.exec(searchHtml)) !== null && products.length < 8) {
    const dataId = m[1];
    const html = m[2];

    const title = html.match(/alt="([^"]{5,})"/)?.[1]?.slice(0, 70);
    const link = html.match(/href="(\/[^"]*\/pr-[^"]+)"/)?.[1];
    const productRef = link?.match(/pr-(C\d+)/)?.[1];

    const priceMatches = [...html.matchAll(/(\d+[,]\d{2})\s*€/g)].map(pm => pm[1].replace(',', '.'));

    products.push({
      dataId,
      title,
      url: link,
      productRef,
      prices: priceMatches,
      mainPrice: priceMatches.length > 0 ? parseFloat(priceMatches[priceMatches.length - 1]) : null,
    });
  }

  console.log(`  ${products.length} produits:`);
  for (const p of products) {
    const priceStr = p.mainPrice ? `${p.mainPrice}€` : 'pas de prix';
    console.log(`    ${p.mainPrice ? '✓' : '❌'} ${p.title} — ${priceStr} — ${p.productRef}`);
  }

  // ━━━ 4. Test XHR JSON ━━━
  console.log('\n━━━ 4. Recherche mode JSON ━━━');
  const jsonRes = await auchanFetch('/recherche?text=lait+demi+ecreme', {
    headers: { accept: 'application/json', 'x-requested-with': 'XMLHttpRequest' },
  });
  const jsonCt = jsonRes.headers.get('content-type') || '';
  if (jsonCt.includes('json')) {
    const data = await jsonRes.json();
    console.log(`  ✓ JSON — Clés: ${Object.keys(data).join(', ')}`);
    console.log(`  ${JSON.stringify(data).slice(0, 300)}`);
  } else {
    await jsonRes.text();
    console.log(`  ❌ Pas de JSON (${jsonCt.slice(0, 40)})`);
  }

  // ━━━ 5. Panier ━━━
  console.log('\n━━━ 5. Panier ━━━');
  const cartRes = await auchanFetch('/cart', {
    headers: { accept: 'application/json' },
  });
  const cartCt = cartRes.headers.get('content-type') || '';
  if (cartCt.includes('json')) {
    const cart = await cartRes.json();
    console.log(`  ✓ Panier JSON`);
    console.log(`  ${JSON.stringify(cart).slice(0, 400)}`);

    // Essayer d'ajouter un produit
    if (products[0]) {
      console.log(`\n  Ajout: ${products[0].title}...`);

      const addRes = await auchanFetch('/cart/update', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({
          productId: products[0].productRef,
          quantity: 1,
          storeReference: '956',
        }),
      });
      const addCt = addRes.headers.get('content-type') || '';
      const addText = await addRes.text();
      console.log(`  HTTP ${addRes.status} — ${addCt.slice(0, 30)}`);
      console.log(`  ${addText.slice(0, 300)}`);
    }
  } else {
    await cartRes.text();
    console.log(`  ❌ Pas de JSON (${cartCt})`);
  }

  // ━━━ 6. Fiche produit — structured data ━━━
  console.log('\n━━━ 6. Fiche produit ━━━');
  if (products[0]?.url) {
    const pdpRes = await auchanFetch(products[0].url, { headers: { accept: 'text/html' } });
    const pdpHtml = await pdpRes.text();
    console.log(`  HTTP ${pdpRes.status} — ${pdpHtml.length} bytes`);

    // JSON-LD
    const jsonLdMatches = [...pdpHtml.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
    for (const jm of jsonLdMatches) {
      try {
        const ld = JSON.parse(jm[1]);
        if (ld['@type'] === 'Product' || ld.offers) {
          console.log(`  ✓ JSON-LD Product:`);
          console.log(`    name: ${ld.name}`);
          console.log(`    brand: ${ld.brand?.name || ld.brand}`);
          console.log(`    gtin: ${ld.gtin13 || ld.gtin}`);
          console.log(`    sku: ${ld.sku}`);
          console.log(`    price: ${ld.offers?.price || ld.offers?.[0]?.price} ${ld.offers?.priceCurrency || ''}`);
          console.log(`    availability: ${ld.offers?.availability}`);
          console.log(`    image: ${(typeof ld.image === 'string' ? ld.image : ld.image?.[0])?.slice(0, 80)}`);
        }
      } catch {}
    }
  }

  // ━━━ RÉSUMÉ ━━━
  console.log('\n══════════════════════════════════════════');
  console.log('  RÉSUMÉ AUCHAN');
  console.log('══════════════════════════════════════════');
  console.log(`  Anti-bot: AUCUN`);
  console.log(`  Fetch Node.js natif: ✓`);
  console.log(`  Sélection magasin: POST /journey/update`);
  console.log(`  Prix récupérables: ${products.some(p => p.mainPrice) ? '✓' : '❌'}`);
  console.log(`  Produits: ${products.length}`);
  console.log('══════════════════════════════════════════');
}

run().catch(e => { console.error(e); process.exit(1); });
