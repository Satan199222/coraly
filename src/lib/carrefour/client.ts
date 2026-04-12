import { scrapflyFetch, scrapflyFetchHtml, sessionForStore } from "./scrapfly";
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

/**
 * Recherche produits. Ref: GET /s?q={query}
 * `storeRef` optionnel : si fourni, utilise la session ScrapFly du magasin
 * pour que les prix/dispo reflètent le stock local.
 */
export async function searchProducts(
  query: string,
  storeRef?: string
): Promise<SearchResult> {
  const params = new URLSearchParams({ q: query });
  const raw = await scrapflyFetch<unknown>(`/s?${params}`, {
    session: storeRef ? sessionForStore(storeRef) : undefined,
  });
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

  const raw = await scrapflyFetch<unknown>(`/geoloc?${params}`);
  const parsed = safeParse(GeolocResponseSchema, raw, "geoloc");
  if (!parsed) return [];
  return (parsed.data?.stores ?? []).map(extractStore);
}

/** Sélectionner un magasin. Ref: GET /set-store/{ref}
 *  On passe par la session du magasin pour que le cookie persiste sur les
 *  appels suivants (search, cart, slots). */
export async function setStore(storeRef: string): Promise<void> {
  await scrapflyFetch<unknown>(`/set-store/${storeRef}`, {
    session: sessionForStore(storeRef),
  });
}

/**
 * Extraire le basketServiceId depuis une fiche produit (HTML).
 * Pattern: XXXX-NNN-{storeRef}. Ref: docs/CARREFOUR-API.md § "Identifiants"
 */
export async function getBasketServiceId(
  storeRef: string
): Promise<string | null> {
  const html = await scrapflyFetchHtml(
    "/p/lait-demi-ecreme-uht-vitamine-d-lactel-3252210390014",
    { session: sessionForStore(storeRef) }
  );
  const pattern = new RegExp(`[A-Z0-9]{4}-\\d{3}-${storeRef}`, "g");
  return html.match(pattern)?.[0] || null;
}

/** Lire le panier. Ref: GET /api/cart */
export async function getCart(storeRef?: string): Promise<Cart> {
  const raw = await scrapflyFetch<unknown>("/api/cart", {
    session: storeRef ? sessionForStore(storeRef) : undefined,
  });
  const parsed = safeParse(CartRawSchema, raw, "cart");
  if (!parsed) return { totalAmount: 0, totalFees: 0, items: [] };
  return parseCartResponse(parsed);
}

/**
 * Ajouter un produit au panier.
 * Ref: PATCH /api/cart — docs/CARREFOUR-API.md § "Panier — Ajout"
 *
 * Note : dans le flow VoixCourses, c'est l'extension Chrome qui appelle
 * cet endpoint directement sur carrefour.fr (avec les cookies utilisateur).
 * Cette fonction n'est utilisée qu'en dev/test.
 */
export async function addToCart(
  ean: string,
  basketServiceId: string,
  quantity: number = 1,
  storeRef?: string
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
  const raw = await scrapflyFetch<unknown>("/api/cart", {
    method: "PATCH",
    body,
    headers: { "content-type": "application/json" },
    session: storeRef ? sessionForStore(storeRef) : undefined,
  });
  const parsed = safeParse(CartRawSchema, raw, "cart:patch");
  if (!parsed) return { totalAmount: 0, totalFees: 0, items: [] };
  return parseCartResponse(parsed);
}

/** Premier créneau dispo. Ref: GET /api/firstslot */
export async function getFirstSlot(
  storeRef: string
): Promise<DeliverySlot | null> {
  const raw = await scrapflyFetch<unknown>(
    `/api/firstslot?storeId=${storeRef}`,
    { session: sessionForStore(storeRef) }
  );
  const parsed = safeParse(SlotResponseSchema, raw, "slot");
  if (!parsed || Array.isArray(parsed)) return null;
  const attrs = parsed.data?.attributes;
  if (!attrs) return null;
  return { begDate: attrs.begDate, endDate: attrs.endDate };
}
