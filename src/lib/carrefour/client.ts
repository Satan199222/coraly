import { browserFetch, getPage } from "./browser";
import {
  SearchResponseSchema,
  GeolocResponseSchema,
  CartRawSchema,
  SlotResponseSchema,
  safeParse,
  type ProductRaw,
  type StoreRaw,
  type CartRaw,
} from "./schemas";
import type {
  CarrefourProduct,
  SearchResult,
  CarrefourStore,
  DeliverySlot,
  Cart,
  CartItem,
} from "./types";

/**
 * Extrait un CarrefourProduct depuis la réponse JSON:API validée.
 * Les offers sont indexées par EAN — on prend la première entrée qui a
 * des attributs (il y en a généralement 1 seule par produit/magasin).
 */
function extractProduct(raw: ProductRaw): CarrefourProduct {
  const a = raw.attributes;
  const ean = a.ean;
  const offersForEan = a.offers?.[ean] ?? {};
  const firstOffer = Object.entries(offersForEan)[0];
  const offerAttrs = firstOffer?.[1]?.attributes;

  return {
    ean,
    title: a.title,
    brand: a.brand,
    slug: a.slug,
    price: offerAttrs?.price?.price ?? null,
    perUnitLabel: offerAttrs?.price?.perUnitLabel ?? null,
    unitOfMeasure: offerAttrs?.price?.unitOfMeasure ?? null,
    purchasable: offerAttrs?.availability?.purchasable ?? false,
    nutriscore: a.nutriscore?.value ?? null,
    format: a.format ?? null,
    packaging: a.packaging ?? null,
    categories: (a.categories ?? []).map((c) => c.label),
    imageUrl: a.images?.main ?? null,
    offerServiceId: firstOffer?.[0] ?? null,
  };
}

function parseCartResponse(raw: CartRaw): Cart {
  const cart = raw.cart;
  const items: CartItem[] = [];
  for (const category of cart?.items ?? []) {
    for (const p of category.products ?? []) {
      const attrs = p.product?.attributes;
      items.push({
        ean: attrs?.ean ?? "",
        title: attrs?.title ?? "",
        brand: attrs?.brand ?? "",
        quantity: p.counter,
        price: p.totalItemPrice,
        available: p.available,
      });
    }
  }
  return {
    totalAmount: cart?.totalAmount ?? 0,
    totalFees: cart?.totalFees ?? 0,
    items,
  };
}

function extractStore(raw: StoreRaw): CarrefourStore {
  return {
    ref: raw.ref,
    name: raw.name,
    format: raw.format,
    distance: raw.distance,
    isDrive: raw.isDrive,
    isDelivery: raw.isLad,
    address: raw.address,
  };
}

/** Recherche produits. Ref: GET /s?q={query} */
export async function searchProducts(query: string): Promise<SearchResult> {
  const params = new URLSearchParams({ q: query });
  const raw = await browserFetch<unknown>(`/s?${params}`);
  const parsed = safeParse(SearchResponseSchema, raw, "search");
  if (!parsed) {
    return { products: [], total: 0, keyword: query };
  }
  return {
    products: (parsed.data ?? []).map(extractProduct),
    total: parsed.meta?.total ?? 0,
    keyword: parsed.meta?.keyword ?? query,
  };
}

/** Magasins proches. Ref: GET /geoloc */
export async function findStores(
  lat: number,
  lng: number,
  postalCode: string
): Promise<CarrefourStore[]> {
  const params = new URLSearchParams({
    lat: lat.toString(),
    lng: lng.toString(),
    page: "1",
    limit: "5",
    postal_code: postalCode,
  });
  params.append("array_postal_codes[]", postalCode);
  params.append("modes[]", "delivery");
  params.append("modes[]", "picking");

  const raw = await browserFetch<unknown>(`/geoloc?${params}`);
  const parsed = safeParse(GeolocResponseSchema, raw, "geoloc");
  if (!parsed) return [];
  return (parsed.data?.stores ?? []).map(extractStore);
}

/** Sélectionner un magasin. Ref: GET /set-store/{ref} */
export async function setStore(storeRef: string): Promise<void> {
  await browserFetch<unknown>(`/set-store/${storeRef}`);
}

/**
 * Extraire le basketServiceId depuis une fiche produit.
 * Format: XXXX-NNN-{storeRef}. Ref: docs/CARREFOUR-API.md § "Identifiants"
 */
export async function getBasketServiceId(
  storeRef: string
): Promise<string | null> {
  const p = await getPage();
  await p.goto(
    "https://www.carrefour.fr/p/lait-demi-ecreme-uht-vitamine-d-lactel-3252210390014",
    { waitUntil: "domcontentloaded", timeout: 30000 }
  );
  await p.waitForTimeout(2000);
  return p.evaluate((ref: string) => {
    const html = document.documentElement.innerHTML;
    const pattern = new RegExp(`[A-Z0-9]{4}-\\d{3}-${ref}`, "g");
    return html.match(pattern)?.[0] || null;
  }, storeRef);
}

/** Lire le panier. Ref: GET /api/cart */
export async function getCart(): Promise<Cart> {
  const raw = await browserFetch<unknown>("/api/cart");
  const parsed = safeParse(CartRawSchema, raw, "cart");
  if (!parsed) return { totalAmount: 0, totalFees: 0, items: [] };
  return parseCartResponse(parsed);
}

/**
 * Ajouter un produit au panier.
 * Ref: PATCH /api/cart — docs/CARREFOUR-API.md § "Panier — Ajout"
 */
export async function addToCart(
  ean: string,
  basketServiceId: string,
  quantity: number = 1
): Promise<Cart> {
  const body = JSON.stringify({
    trackingRequest: { pageType: "search", pageId: "search" },
    items: [
      {
        basketServiceId,
        counter: quantity,
        ean,
        subBasketType: "drive_clcv",
      },
    ],
  });
  const raw = await browserFetch<unknown>("/api/cart", {
    method: "PATCH",
    body,
    headers: { "content-type": "application/json" },
  });
  const parsed = safeParse(CartRawSchema, raw, "cart:patch");
  if (!parsed) return { totalAmount: 0, totalFees: 0, items: [] };
  return parseCartResponse(parsed);
}

/** Premier créneau dispo. Ref: GET /api/firstslot */
export async function getFirstSlot(
  storeRef: string
): Promise<DeliverySlot | null> {
  const raw = await browserFetch<unknown>(
    `/api/firstslot?storeId=${storeRef}`
  );
  const parsed = safeParse(SlotResponseSchema, raw, "slot");
  // Réponse [] = pas de créneau dispo
  if (!parsed || Array.isArray(parsed)) return null;
  const attrs = parsed.data?.attributes;
  if (!attrs) return null;
  return {
    begDate: attrs.begDate,
    endDate: attrs.endDate,
  };
}
