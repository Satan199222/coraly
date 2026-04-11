/**
 * Probe 01 — Flow complet : magasin → recherche → panier multi-produits
 *
 * Teste tout le parcours VoixCourses de A à Z :
 * 1. Géolocalisation (Woosmap)
 * 2. Sélection magasin (set-store)
 * 3. Recherche multi-produits (search)
 * 4. Ajout au panier (PATCH /api/cart)
 * 5. Lecture panier complet (GET /api/cart)
 * 6. Premier créneau dispo (firstslot)
 */
import { CarrefourClient } from './carrefour-client.mjs';

const POSTAL_CODE = '57360';

// Liste de courses test
const SHOPPING_LIST = [
  'lait demi ecreme lactel 1L',
  'pâtes spaghetti barilla',
  'yaourt nature',
  'jambon blanc herta',
  'savon mains',
];

async function run() {
  console.log('══════════════════════════════════════════════');
  console.log('  VoixCourses — Probe Flow Complet');
  console.log(`  Code postal: ${POSTAL_CODE}`);
  console.log(`  Liste: ${SHOPPING_LIST.length} produits`);
  console.log('══════════════════════════════════════════════\n');

  const client = new CarrefourClient();
  await client.init();
  console.log('[✓] Client initialisé (Cloudflare passé)\n');

  // ─── ÉTAPE 1: Géolocalisation ───
  console.log('━━━ ÉTAPE 1: Géolocalisation ━━━');
  const geoRes = await fetch(`https://api.woosmap.com/localities/autocomplete/?key=woos-26fe76aa-ff24-3255-b25b-e1bde7b7a683&input=${POSTAL_CODE}&components=country:fr`, {
    headers: { 'origin': 'https://www.carrefour.fr', 'referer': 'https://www.carrefour.fr/' },
  });
  const geoData = await geoRes.json();
  const location = geoData.localities?.[0]?.location || { lat: 49.254862, lng: 6.133241 };
  console.log(`  ${POSTAL_CODE} → lat=${location.lat}, lng=${location.lng}`);

  // ─── ÉTAPE 2: Trouver et sélectionner un magasin ───
  console.log('\n━━━ ÉTAPE 2: Magasins ━━━');
  const storesData = await client.findStores(location.lat, location.lng, POSTAL_CODE);
  const stores = storesData?.data?.stores || [];
  console.log(`  ${stores.length} magasin(s) trouvé(s):`);
  for (const s of stores.slice(0, 3)) {
    console.log(`    ${s.ref} — ${s.name} (${s.format}) — ${s.distance}km`);
  }
  await client.saveResult('stores', storesData);

  const selectedStore = stores[0];
  if (!selectedStore) {
    console.log('  Aucun magasin trouvé — arrêt');
    await client.close();
    return;
  }

  console.log(`\n  Sélection: ${selectedStore.name} (${selectedStore.ref})`);
  await client.setStore(selectedStore.ref);
  await client.refreshContext();

  const basketServiceId = await client.getBasketServiceId(selectedStore.ref);
  console.log(`  basketServiceId trouvé: ${basketServiceId}`);
  if (!basketServiceId) {
    console.log('  ERREUR: basketServiceId non trouvé — arrêt');
    await client.close();
    return;
  }
  await client.saveResult('store-context', { storeRef: selectedStore.ref, basketServiceId });

  // ─── ÉTAPE 3: Premier créneau ───
  console.log('\n━━━ ÉTAPE 3: Premier créneau ━━━');
  const slot = await client.getFirstSlot(selectedStore.ref);
  await client.saveResult('firstslot', slot);
  if (Array.isArray(slot) && slot.length === 0) {
    console.log('  Pas de créneau disponible pour ce magasin');
  } else if (slot?.data?.attributes) {
    console.log(`  Créneau: ${slot.data.attributes.begDate} → ${slot.data.attributes.endDate}`);
  } else {
    console.log(`  Réponse: ${JSON.stringify(slot).slice(0, 200)}`);
  }

  // ─── ÉTAPE 4: Recherche multi-produits ───
  console.log('\n━━━ ÉTAPE 4: Recherche produits ━━━');
  const foundProducts = [];

  for (const query of SHOPPING_LIST) {
    const searchResult = await client.search(query);
    const total = searchResult.meta?.total || 0;

    if (searchResult.data?.length > 0) {
      const product = CarrefourClient.extractProduct(searchResult.data[0]);
      foundProducts.push(product);
      console.log(`  "${query}" → ${total} résultats`);
      console.log(`    ✓ ${product.title} — ${product.price}€ — ${product.perUnitLabel}`);
      console.log(`      EAN: ${product.ean} | Nutri: ${product.nutriscore || '-'} | ${product.packaging}`);
    } else {
      console.log(`  "${query}" → 0 résultat`);
    }
  }

  await client.saveResult('search-products', foundProducts);
  console.log(`\n  ${foundProducts.length}/${SHOPPING_LIST.length} produits trouvés`);

  // ─── ÉTAPE 5: Ajout au panier ───
  console.log('\n━━━ ÉTAPE 5: Ajout au panier ━━━');

  // Lire le panier avant
  const cartBefore = await client.getCart();
  console.log(`  Panier avant: ${cartBefore.cart?.totalAmount}€ — ${cartBefore.cart?.totalQuantity || 0} items`);

  const addResults = [];
  for (const product of foundProducts) {
    console.log(`\n  Ajout: ${product.title} (${product.ean})...`);
    const result = await client.addToCart(product.ean, 1, basketServiceId);
    addResults.push({ product: product.title, ean: product.ean, result });

    if (result.error) {
      console.log(`    ✗ Erreur: ${result.error}`);
      console.log(`    Body envoyé: ${JSON.stringify(result.requestBody || {}).slice(0, 200)}`);
    } else {
      const cart = result.data?.cart;
      console.log(`    ✓ HTTP ${result.status} — Panier: ${cart?.totalAmount}€ — ${cart?.totalQuantity} items`);
      console.log(`    Body envoyé: ${JSON.stringify(result.requestBody)}`);
    }
  }

  await client.saveResult('add-results', addResults);

  // ─── ÉTAPE 6: Panier final ───
  console.log('\n━━━ ÉTAPE 6: Panier final ━━━');
  const cartFinal = await client.getCart();
  await client.saveResult('cart-final', cartFinal);

  const cart = cartFinal.cart;
  console.log(`  Total: ${cart?.totalAmount}€`);
  console.log(`  Total avec frais: ${cart?.totalAmountWithFees}€`);
  console.log(`  Quantité totale: ${cart?.totalQuantity}`);
  console.log(`  Frais: ${cart?.totalFees}€`);
  console.log(`  Économies: ${cart?.totalCardSaving}€`);

  // Détailler les items du panier
  const items = cart?.items || cart?.subCarts?.[0]?.items || [];
  if (items.length > 0) {
    console.log(`\n  Détail (${items.length} item(s)):`);
    for (const item of items) {
      console.log(`    • ${item.title || item.name} — ${item.quantity}x — ${item.totalAmount || item.price}€`);
    }
  } else {
    // Chercher les items dans les sub-carts
    const subCarts = cart?.subCarts || [];
    console.log(`\n  ${subCarts.length} sous-panier(s)`);
    for (const sc of subCarts) {
      console.log(`    Sous-panier: ${sc.label || sc.type || sc.id} — ${sc.items?.length || 0} items`);
      for (const item of (sc.items || []).slice(0, 10)) {
        console.log(`      • ${item.title || item.name || item.ean} — ${item.quantity}x — ${item.totalAmount ?? item.price}€`);
      }
    }
  }

  // ─── RÉSUMÉ ───
  console.log('\n══════════════════════════════════════════════');
  console.log('  RÉSUMÉ');
  console.log('══════════════════════════════════════════════');
  console.log(`  Magasin: ${selectedStore.name} (${selectedStore.ref})`);
  console.log(`  basketServiceId: ${basketServiceId}`);
  console.log(`  Produits trouvés: ${foundProducts.length}/${SHOPPING_LIST.length}`);
  console.log(`  Panier total: ${cart?.totalAmount}€`);
  console.log(`  Résultats sauvegardés dans: probes/results/`);
  console.log('══════════════════════════════════════════════\n');

  await client.close();
}

run().catch(e => { console.error(e); process.exit(1); });
