/**
 * Client VoixSanté — Pharma GDD
 *
 * Sondage API GROA-244 — conclusions :
 *
 *   ✗ API Sylius v2  (/api/v2/shop/*)      → 404 non exposée
 *   ✗ Endpoint recherche JSON              → autocomplete retourne []
 *   ✓ Pages produit HTML                   → JSON-LD schema.org/Product complet
 *   ✓ Sitemap produits                     → 14 516 URLs (/sitemap-product.xml)
 *   ✓ Redirections recherche               → /fr/search?q={q} → /fr/{slug ou marque}
 *
 * Stratégie retenue (Phase 4b) :
 *   1. getProduct(slug)   — fetch HTML produit + extraction JSON-LD
 *   2. searchProduct(q)   — follow search redirect → getProduct() si page produit
 *   3. getSitemapEntries()— index complet des produits (cache 24h recommandé)
 *
 * Limites identifiées :
 *   - Pas de recherche full-text JSON native → résultats via HTML scraping
 *   - Autocomplete /fr/search/autocomplete retourne toujours [] (peut nécessiter session)
 *   - Scraping soumis aux CGU Pharma GDD — contacter pour partenariat API si trafic élevé
 *
 * Documentation Sylius : https://docs.sylius.com/getting-started-with-sylius/using-api
 * Site Pharma GDD      : https://www.pharma-gdd.com
 */

import type {
  PharmaProduct,
  PharmaSearchResult,
  PharmaSitemapEntry,
  PharmaJsonLdProduct,
} from "./types";

const PHARMAGDD_BASE = "https://www.pharma-gdd.com";
const SITEMAP_URL = `${PHARMAGDD_BASE}/sitemap-product.xml`;
const FETCH_TIMEOUT_MS = 12_000;

const DEFAULT_HEADERS: HeadersInit = {
  "User-Agent":
    "Mozilla/5.0 (compatible; VoixSante/1.0; +https://voix.ai/)",
  "Accept-Language": "fr-FR,fr;q=0.9",
};

// ---------------------------------------------------------------------------
// Helpers internes
// ---------------------------------------------------------------------------

async function pharmaFetch(
  url: string,
  accept = "text/html"
): Promise<Response> {
  const res = await fetch(url, {
    headers: { ...DEFAULT_HEADERS, Accept: accept },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    redirect: "follow",
  });
  return res;
}

/**
 * Extrait le premier objet JSON-LD schema.org/Product d'un HTML Pharma GDD.
 * Les pages produit embarquent un graphe JSON-LD avec @type:"Product".
 */
function extractJsonLdProduct(html: string): PharmaJsonLdProduct | null {
  const scriptMatches =
    html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g) ??
    [];

  for (const scriptTag of scriptMatches) {
    const jsonStr = scriptTag
      .replace(/<script[^>]*>/, "")
      .replace("</script>", "")
      .trim();
    try {
      const parsed = JSON.parse(jsonStr) as {
        "@type"?: string;
        "@graph"?: Array<{ "@type"?: string }>;
      };
      // Support { @type: "Product" } ou { @graph: [ { @type: "Product" } ] }
      if (parsed["@type"] === "Product") {
        return parsed as unknown as PharmaJsonLdProduct;
      }
      if (Array.isArray(parsed["@graph"])) {
        const productNode = parsed["@graph"].find(
          (node) => node["@type"] === "Product"
        );
        if (productNode) return productNode as unknown as PharmaJsonLdProduct;
      }
    } catch {
      // JSON malformé — ignorer
    }
  }
  return null;
}

/**
 * Normalise un objet JSON-LD brut en PharmaProduct.
 */
function normalizeProduct(slug: string, raw: PharmaJsonLdProduct): PharmaProduct {
  const offer = raw.offers?.[0];
  const price =
    typeof offer?.price === "string"
      ? parseFloat(offer.price)
      : (offer?.price ?? 0);

  const inStock =
    offer?.availability === "https://schema.org/InStock" ||
    offer?.availability === "InStock";

  const ratingValue =
    raw.aggregateRating?.ratingValue != null
      ? Number(raw.aggregateRating.ratingValue)
      : undefined;
  const reviewCount =
    raw.aggregateRating?.reviewCount != null
      ? Number(raw.aggregateRating.reviewCount)
      : raw.aggregateRating?.ratingCount != null
        ? Number(raw.aggregateRating.ratingCount)
        : undefined;

  return {
    slug,
    name: raw.name,
    ean: raw.sku ?? raw.mpn ?? "",
    gtin13: raw.gtin13,
    brand: raw.brand?.name,
    imageUrl: raw.image,
    price,
    inStock,
    description: raw.description,
    ratingValue,
    reviewCount,
    url: `${PHARMAGDD_BASE}/fr/${slug}`,
  };
}

// ---------------------------------------------------------------------------
// API publique
// ---------------------------------------------------------------------------

/**
 * Récupère les données d'un produit Pharma GDD par son slug URL.
 *
 * @param slug   Slug du produit (ex: "doliprane-1000-mg-paracetamol-effervescent")
 * @throws Error si la page est introuvable ou ne contient pas de JSON-LD produit
 *
 * @example
 * const product = await getProduct("doliprane-1000-mg-paracetamol-effervescent");
 * // { name: "Doliprane 1000 mg effervescent", price: 2.18, inStock: true, ... }
 */
export async function getProduct(slug: string): Promise<PharmaProduct> {
  const url = `${PHARMAGDD_BASE}/fr/${encodeURIComponent(slug)}`;
  const res = await pharmaFetch(url);

  if (!res.ok) {
    throw new Error(
      `[pharmagdd] Produit introuvable : "${slug}" (HTTP ${res.status})`
    );
  }

  const html = await res.text();
  const rawProduct = extractJsonLdProduct(html);

  if (!rawProduct) {
    throw new Error(
      `[pharmagdd] Pas de données JSON-LD produit sur la page "${slug}"`
    );
  }

  return normalizeProduct(slug, rawProduct);
}

/**
 * Recherche un produit par terme (nom, marque, molécule).
 *
 * Mécanisme : /fr/search?q={q} redirige vers :
 *   - Page produit (/fr/{slug}) → extraction JSON-LD directe
 *   - Page catégorie/marque    → extraction des liens produits de la page
 *
 * @param query  Terme de recherche (ex: "doliprane", "paracetamol", "vitamine C")
 * @returns      Résultat typé product (données complètes) ou category (slugs listés)
 */
export async function searchProduct(
  query: string
): Promise<PharmaSearchResult> {
  const searchUrl = `${PHARMAGDD_BASE}/fr/search?q=${encodeURIComponent(query.trim())}`;
  const res = await pharmaFetch(searchUrl);

  if (!res.ok) {
    throw new Error(
      `[pharmagdd] Erreur recherche "${query}" (HTTP ${res.status})`
    );
  }

  const resolvedUrl = res.url;
  const html = await res.text();

  // Cas 1 : redirection vers une page produit → JSON-LD disponible
  const rawProduct = extractJsonLdProduct(html);
  if (rawProduct) {
    // Extraire le slug depuis l'URL finale
    const slugMatch = resolvedUrl.match(/\/fr\/([^/?#]+)$/);
    const slug = slugMatch?.[1] ?? query.toLowerCase().replace(/\s+/g, "-");
    return {
      type: "product",
      product: normalizeProduct(slug, rawProduct),
      resolvedUrl,
    };
  }

  // Cas 2 : page catégorie / marque → extraire les liens produits
  const productLinks = [
    ...(html.match(/href="\/fr\/([a-z0-9][a-z0-9\-]+[a-z0-9])"/g) ?? []),
  ]
    .map((h) => h.match(/\/fr\/([^"]+)"/)?.[1] ?? "")
    .filter(
      (s) =>
        s.length > 3 &&
        !["medicaments", "sante", "hygiene-beaute", "bebe-grossesse",
          "minceur-sport", "veterinaire", "promotions", "soins",
          "parapharmacie", "login", "register", "avis-clients"].includes(s)
    );

  const uniqueSlugs = [...new Set(productLinks)].slice(0, 20);

  return {
    type: "category",
    categorySlugs: uniqueSlugs,
    resolvedUrl,
  };
}

/**
 * Récupère les entrées du sitemap produit Pharma GDD.
 * Permet de construire un index local des 14 516 produits.
 *
 * Recommandation : mettre en cache le résultat 24h (le sitemap est mis à jour mensuellement).
 *
 * @param limit  Nombre max d'entrées à retourner (défaut : 500, max : toutes)
 */
export async function getSitemapEntries(
  limit = 500
): Promise<PharmaSitemapEntry[]> {
  const res = await pharmaFetch(SITEMAP_URL, "application/xml, text/xml, */*");

  if (!res.ok) {
    throw new Error(
      `[pharmagdd] Impossible de récupérer le sitemap (HTTP ${res.status})`
    );
  }

  const xml = await res.text();
  const urlMatches = xml.match(/<url>([\s\S]*?)<\/url>/g) ?? [];

  const entries: PharmaSitemapEntry[] = [];
  for (const block of urlMatches) {
    const locMatch = block.match(/<loc>(https?[^<]+)<\/loc>/);
    if (!locMatch) continue;

    const url = locMatch[1].trim();
    const slugMatch = url.match(/\/fr\/([^/?#]+)$/);
    if (!slugMatch) continue;

    const lastmodMatch = block.match(/<lastmod>([^<]+)<\/lastmod>/);
    const priorityMatch = block.match(/<priority>([^<]+)<\/priority>/);

    entries.push({
      slug: slugMatch[1],
      url,
      lastmod: lastmodMatch?.[1],
      priority: priorityMatch ? parseFloat(priorityMatch[1]) : undefined,
    });

    if (entries.length >= limit) break;
  }

  return entries;
}
