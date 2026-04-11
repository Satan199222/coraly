/**
 * CarrefourClient — Client API Carrefour via Playwright headless
 *
 * Toutes les requêtes passent par page.evaluate() pour bénéficier
 * de la session Cloudflare du navigateur.
 *
 * Usage:
 *   const client = new CarrefourClient();
 *   await client.init();
 *   const products = await client.search('lait demi ecreme');
 *   await client.setStore('850055');
 *   await client.addToCart(products[0]);
 *   const cart = await client.getCart();
 *   await client.close();
 */
import { chromium } from 'playwright';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

const RESULTS_DIR = join(import.meta.dirname, 'results');

export class CarrefourClient {
  constructor() {
    this.browser = null;
    this.context = null;
    this.page = null;
    this.ready = false;
  }

  async init() {
    this.browser = await chromium.launch({ headless: true });
    this.context = await this.browser.newContext({
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      locale: 'fr-FR',
    });
    this.page = await this.context.newPage();

    // Passer Cloudflare
    await this.page.goto('https://www.carrefour.fr', { waitUntil: 'domcontentloaded', timeout: 30000 });
    const title = await this.page.title();
    if (!title.includes('Carrefour')) {
      throw new Error(`Cloudflare non passé — titre: "${title}"`);
    }
    this.ready = true;
  }

  async close() {
    if (this.browser) await this.browser.close();
  }

  /** Sauvegarder un résultat JSON pour documentation */
  async saveResult(name, data) {
    await mkdir(RESULTS_DIR, { recursive: true });
    const filepath = join(RESULTS_DIR, `${name}.json`);
    await writeFile(filepath, JSON.stringify(data, null, 2), 'utf-8');
    return filepath;
  }

  /**
   * GET /set-store/{ref} — Sélectionner un magasin
   * @param {string} storeRef — Référence magasin (ex: "850055")
   * @returns {object} — Réponse JSON
   */
  async setStore(storeRef) {
    return this.page.evaluate(async (ref) => {
      const res = await fetch(`/set-store/${ref}`, {
        headers: { 'x-requested-with': 'XMLHttpRequest', 'accept': 'application/json' }
      });
      return { status: res.status, ok: res.ok };
    }, storeRef);
  }

  /**
   * GET /geoloc — Rechercher des magasins par position
   * @param {number} lat
   * @param {number} lng
   * @param {string} postalCode
   * @param {string[]} modes — ["delivery", "picking"]
   * @returns {object[]} — Liste de magasins
   */
  async findStores(lat, lng, postalCode, modes = ['delivery', 'picking']) {
    return this.page.evaluate(async ({ lat, lng, postalCode, modes }) => {
      const params = new URLSearchParams({
        lat: lat.toString(),
        lng: lng.toString(),
        page: '1',
        limit: '5',
        postal_code: postalCode,
      });
      params.append('array_postal_codes[]', postalCode);
      for (const m of modes) params.append('modes[]', m);

      const res = await fetch(`/geoloc?${params}`, {
        headers: { 'x-requested-with': 'XMLHttpRequest', 'accept': 'application/json' }
      });
      return res.json();
    }, { lat, lng, postalCode, modes });
  }

  /**
   * GET /s?q={query} — Recherche produits (JSON via header XHR)
   *
   * Retourne un objet JSON:API avec:
   *   data: Product[] — max 30 par page
   *   meta: { total, itemsPerPage, totalPage, currentPage, keyword, facets, ... }
   *   links: { ... }
   *
   * Chaque Product a la structure:
   *   type: "product"
   *   id: "product-{ean}"
   *   attributes:
   *     ean, title, brand, slug, format, packaging, nutriscore,
   *     categories, images, offers (contient les prix)
   *     offers.{ean}.{offerServiceId}.attributes.price: { price, perUnit, perUnitLabel }
   *     offers.{ean}.{offerServiceId}.attributes.availability: { purchasable }
   *
   * @param {string} query — Termes de recherche
   * @param {number} page — Page (default 1)
   * @returns {object} — Réponse JSON:API complète
   */
  async search(query, page = 1) {
    return this.page.evaluate(async ({ query, page }) => {
      const params = new URLSearchParams({ q: query });
      if (page > 1) params.set('page', page.toString());

      const res = await fetch(`/s?${params}`, {
        headers: { 'x-requested-with': 'XMLHttpRequest', 'accept': 'application/json' }
      });
      return res.json();
    }, { query, page });
  }

  /**
   * Extraire les infos utiles d'un produit de la réponse search
   */
  static extractProduct(rawProduct) {
    const a = rawProduct.attributes;
    const ean = a.ean;
    const offerEntries = Object.entries(a.offers?.[ean] || {});
    const [offerServiceId, offerData] = offerEntries[0] || [null, null];
    const offer = offerData?.attributes;

    return {
      ean,
      title: a.title,
      brand: a.brand,
      slug: a.slug,
      price: offer?.price?.price,
      perUnitLabel: offer?.price?.perUnitLabel,
      unitOfMeasure: offer?.price?.unitOfMeasure,
      purchasable: offer?.availability?.purchasable,
      nutriscore: a.nutriscore?.value,
      format: a.format,
      packaging: a.packaging,
      categories: a.categories?.map(c => c.label),
      image: a.images?.main,
      offerServiceId,
      basketServiceId: offer?.offerServiceId !== offerServiceId ? offer?.offerServiceId : null,
      // Données brutes pour l'ajout au panier
      _raw: {
        offerServiceId,
        ean,
      },
    };
  }

  /**
   * GET /autocomplete?q={query} — Autocomplétion
   */
  async autocomplete(query) {
    return this.page.evaluate(async (q) => {
      const res = await fetch(`/autocomplete?q=${encodeURIComponent(q)}`, {
        headers: { 'x-requested-with': 'XMLHttpRequest', 'accept': 'application/json' }
      });
      return res.json();
    }, query);
  }

  /**
   * GET /api/firstslot?storeId={ref} — Premier créneau disponible
   */
  async getFirstSlot(storeRef) {
    return this.page.evaluate(async (ref) => {
      const res = await fetch(`/api/firstslot?storeId=${ref}`, {
        headers: { 'x-requested-with': 'XMLHttpRequest', 'accept': 'application/json' }
      });
      return res.json();
    }, storeRef);
  }

  /**
   * GET /api/cart — Lire le panier
   */
  async getCart() {
    return this.page.evaluate(async () => {
      const res = await fetch('/api/cart', {
        headers: { 'x-requested-with': 'XMLHttpRequest', 'accept': 'application/json' }
      });
      return res.json();
    });
  }

  /**
   * PATCH /api/cart — Ajouter/modifier des produits au panier
   *
   * Body:
   * {
   *   "trackingRequest": { "pageType": "search", "pageId": "search" },
   *   "items": [{
   *     "basketServiceId": "A4CA-151-850055",  // fourni par le contexte store
   *     "counter": 1,                          // quantité
   *     "ean": "3252210390014",                // code EAN produit
   *     "subBasketType": "drive_clcv"           // type de sous-panier
   *   }]
   * }
   *
   * Le basketServiceId est récupéré dynamiquement depuis le contexte.
   */
  async addToCart(ean, quantity = 1, basketServiceIdOverride = null) {
    return this.page.evaluate(async ({ ean, quantity, bsidOverride }) => {
      // Récupérer le basketServiceId
      let basketServiceId = bsidOverride;

      if (!basketServiceId) {
        basketServiceId = window.context?.store?.basketServiceId;
      }
      if (!basketServiceId) {
        const state = window.__INITIAL_STATE__;
        basketServiceId = state?.vuex?.shop?.store?.basketServiceId;
      }

      if (!basketServiceId) {
        return { error: 'Pas de basketServiceId — sélectionnez d\'abord un magasin' };
      }

      const body = {
        trackingRequest: { pageType: 'search', pageId: 'search' },
        items: [{
          basketServiceId,
          counter: quantity,
          ean,
          subBasketType: 'drive_clcv',
        }],
      };

      const res = await fetch('/api/cart', {
        method: 'PATCH',
        headers: {
          'x-requested-with': 'XMLHttpRequest',
          'accept': 'application/json',
          'content-type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const ct = res.headers.get('content-type') || '';
      if (!ct.includes('json')) {
        return { error: 'Not JSON', status: res.status, body: (await res.text()).slice(0, 200) };
      }
      return { status: res.status, data: await res.json(), requestBody: body };
    }, { ean, quantity, bsidOverride: basketServiceIdOverride });
  }

  /**
   * Récupérer le contexte store actuel (basketServiceId, etc.)
   */
  async getStoreContext() {
    return this.page.evaluate(() => window.context?.store || {});
  }

  /**
   * Recharger la page pour rafraîchir le contexte après set-store.
   * On navigue vers une page de recherche pour que le contexte store se charge.
   */
  async refreshContext() {
    await this.page.goto('https://www.carrefour.fr/s?q=test', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await this.page.waitForTimeout(1500);
  }

  /**
   * Extraire le basketServiceId depuis la page courante.
   *
   * Le basketServiceId a le format "XXXX-NNN-{storeRef}" (ex: "A4CA-151-850055").
   * Il n'est pas exposé dans une variable JS nommée, mais il est présent dans le HTML
   * de la fiche produit. On le cherche via un regex sur le DOM.
   *
   * @param {string} storeRef — Référence magasin pour filtrer le bon ID
   */
  async getBasketServiceId(storeRef) {
    // Naviguer vers une fiche produit pour avoir le basketServiceId dans le HTML
    await this.page.goto('https://www.carrefour.fr/p/lait-demi-ecreme-uht-vitamine-d-lactel-3252210390014', {
      waitUntil: 'domcontentloaded', timeout: 30000,
    });
    await this.page.waitForTimeout(2000);

    return this.page.evaluate((ref) => {
      const html = document.documentElement.innerHTML;
      // Pattern: 4 chars alphanumériques, tiret, 3 chiffres, tiret, storeRef
      const pattern = new RegExp(`[A-Z0-9]{4}-\\d{3}-${ref}`, 'g');
      const matches = html.match(pattern);
      return matches?.[0] || null;
    }, storeRef);
  }
}
