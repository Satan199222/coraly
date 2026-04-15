/**
 * Types VoixSanté — Pharma GDD
 *
 * Résultat du sondage API GROA-244 :
 *   - L'API Sylius v2 de Pharma GDD n'est PAS exposée publiquement (/api/v2/* → 404).
 *   - Les pages produits exposent un schéma schema.org/Product complet en JSON-LD.
 *   - Accès via scraping HTML côté serveur (Next.js Route Handler).
 *   - 14 516 produits indexés dans /sitemap-product.xml (maj mensuelle).
 */

export interface PharmaProduct {
  /** Slug URL tel qu'utilisé dans https://www.pharma-gdd.com/fr/{slug} */
  slug: string;
  /** Nom complet du produit */
  name: string;
  /** EAN-13 / CIP code (code-barres officiel pharmacie France) */
  ean: string;
  /** GTIN-13 (identique au EAN pour les médicaments) */
  gtin13?: string;
  /** Marque / fabricant */
  brand?: string;
  /** URL de l'image principale (CDN Pharma GDD) */
  imageUrl?: string;
  /** Prix TTC en EUR */
  price: number;
  /** Disponibilité (true = en stock) */
  inStock: boolean;
  /** Description longue */
  description?: string;
  /** Note moyenne (sur 5) */
  ratingValue?: number;
  /** Nombre d'avis */
  reviewCount?: number;
  /** URL canonique du produit */
  url: string;
}

export interface PharmaSearchResult {
  /** Type de résultat : page produit directe ou page catégorie/marque */
  type: "product" | "category";
  /** Si type=product : données produit complètes */
  product?: PharmaProduct;
  /** Si type=category : liste de slugs de produits de la catégorie */
  categorySlugs?: string[];
  /** URL finale après redirection */
  resolvedUrl: string;
}

export interface PharmaSitemapEntry {
  /** Slug URL (chemin après /fr/) */
  slug: string;
  /** URL complète */
  url: string;
  /** Date de dernière modification (ISO 8601) */
  lastmod?: string;
  /** Priorité SEO (0–1) */
  priority?: number;
}

/** Résultat brut JSON-LD schema.org/Product extrait d'une page Pharma GDD */
export interface PharmaJsonLdProduct {
  "@context"?: string;
  "@type"?: "Product";
  name: string;
  sku?: string;
  mpn?: string;
  gtin13?: string;
  description?: string;
  brand?: { "@type": "Brand"; name: string; logo?: string };
  image?: string;
  offers?: Array<{
    "@type": "Offer";
    priceCurrency: string;
    price: string | number;
    availability?: string;
    priceValidUntil?: string;
    seller?: { "@type": "Organization"; name: string };
  }>;
  aggregateRating?: {
    "@type": "AggregateRating";
    ratingValue: number | string;
    reviewCount?: number | string;
    ratingCount?: number | string;
    bestRating?: number;
    worstRating?: number;
  };
}
