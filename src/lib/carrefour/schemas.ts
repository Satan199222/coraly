import { z } from "zod";

/**
 * Schémas Zod pour valider les réponses JSON:API de Carrefour.
 *
 * Philosophie : tolérants — on `passthrough()` et on marque quasi tout
 * optional parce que Carrefour peut renommer ou supprimer des champs sans
 * préavis. L'objectif n'est PAS de rejeter les réponses qui s'écartent un
 * peu du schéma, mais de :
 * 1. Typer proprement nos extractions (plus de `any`)
 * 2. Logger un warning si un champ critique manque
 * 3. Continuer avec des défauts sensés si possible
 *
 * Les `.catch()` sur les champs optionnels donnent des défauts si la valeur
 * reçue n'est pas du bon type — robustesse maximale.
 */

/** Prix détaillé d'une offre produit */
const PriceSchema = z
  .object({
    price: z.number().nullable().optional(),
    perUnitLabel: z.string().nullable().optional(),
    unitOfMeasure: z.string().nullable().optional(),
  })
  .passthrough();

const AvailabilitySchema = z
  .object({
    purchasable: z.boolean().optional().default(false),
  })
  .passthrough();

const OfferAttributesSchema = z
  .object({
    price: PriceSchema.optional(),
    availability: AvailabilitySchema.optional(),
  })
  .passthrough();

const OfferEntrySchema = z
  .object({
    attributes: OfferAttributesSchema.optional(),
  })
  .passthrough();

const CategorySchema = z
  .object({
    label: z.string().optional().default(""),
  })
  .passthrough();

const NutriscoreSchema = z
  .object({
    value: z.string().nullable().optional(),
  })
  .passthrough();

const ImagesSchema = z
  .object({
    main: z.string().nullable().optional(),
  })
  .passthrough();

const ProductAttributesSchema = z
  .object({
    ean: z.string(),
    title: z.string().catch(""),
    brand: z.string().catch(""),
    slug: z.string().catch(""),
    format: z.string().nullable().optional(),
    packaging: z.string().nullable().optional(),
    nutriscore: NutriscoreSchema.optional().nullable(),
    categories: z.array(CategorySchema).optional().default([]),
    images: ImagesSchema.optional().nullable(),
    // offers est un objet indexé par EAN — impossible à typer strictement sans
    // transform. On utilise un record générique.
    offers: z.record(z.string(), z.record(z.string(), OfferEntrySchema)).optional(),
  })
  .passthrough();

export const ProductRawSchema = z
  .object({
    attributes: ProductAttributesSchema,
  })
  .passthrough();

export const SearchResponseSchema = z
  .object({
    data: z.array(ProductRawSchema).optional().default([]),
    meta: z
      .object({
        total: z.number().optional().default(0),
        keyword: z.string().optional().default(""),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

// ── Store / geoloc ───────────────────────────────────────────────────────────

const StoreAddressSchema = z
  .object({
    address1: z.string().catch(""),
    city: z.string().catch(""),
    postalCode: z.string().catch(""),
  })
  .passthrough();

export const StoreSchema = z
  .object({
    ref: z.string(),
    name: z.string().catch(""),
    format: z.string().catch(""),
    distance: z.string().catch(""),
    isDrive: z.boolean().optional(),
    isLad: z.boolean().optional(),
    address: StoreAddressSchema.optional(),
  })
  .passthrough();

export const GeolocResponseSchema = z
  .object({
    data: z
      .object({
        stores: z.array(StoreSchema).optional().default([]),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

// ── Cart ─────────────────────────────────────────────────────────────────────

const CartProductEntrySchema = z
  .object({
    product: z
      .object({
        attributes: z
          .object({
            ean: z.string().catch(""),
            title: z.string().catch(""),
            brand: z.string().catch(""),
          })
          .passthrough()
          .optional(),
      })
      .passthrough()
      .optional(),
    counter: z.number().optional().default(0),
    totalItemPrice: z.number().optional().default(0),
    available: z.boolean().optional().default(true),
  })
  .passthrough();

const CartCategorySchema = z
  .object({
    products: z.array(CartProductEntrySchema).optional().default([]),
  })
  .passthrough();

export const CartRawSchema = z
  .object({
    cart: z
      .object({
        totalAmount: z.number().optional().default(0),
        totalFees: z.number().optional().default(0),
        items: z.array(CartCategorySchema).optional().default([]),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

// ── Slot ─────────────────────────────────────────────────────────────────────

export const SlotResponseSchema = z.union([
  z.array(z.unknown()), // réponse `[]` quand aucun créneau
  z
    .object({
      data: z
        .object({
          attributes: z
            .object({
              begDate: z.string(),
              endDate: z.string(),
            })
            .passthrough(),
        })
        .passthrough()
        .optional(),
    })
    .passthrough(),
]);

// ── Types inférés ────────────────────────────────────────────────────────────

export type ProductRaw = z.infer<typeof ProductRawSchema>;
export type SearchResponse = z.infer<typeof SearchResponseSchema>;
export type GeolocResponse = z.infer<typeof GeolocResponseSchema>;
export type CartRaw = z.infer<typeof CartRawSchema>;
export type StoreRaw = z.infer<typeof StoreSchema>;

/**
 * Parse une réponse inconnue avec un schéma Zod. En cas d'échec, log un
 * warning mais ne throw pas — on préfère continuer avec des données
 * partielles plutôt que casser l'utilisateur final pour un champ optionnel
 * renommé.
 */
export function safeParse<T extends z.ZodTypeAny>(
  schema: T,
  data: unknown,
  context: string
): z.infer<T> | null {
  const result = schema.safeParse(data);
  if (!result.success) {
    console.warn(
      `[carrefour:${context}] Réponse non conforme au schéma:`,
      result.error.issues.slice(0, 3)
    );
    return null;
  }
  return result.data;
}
