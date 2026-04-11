/** Produit extrait de la réponse search Carrefour */
export interface CarrefourProduct {
  ean: string;
  title: string;
  brand: string;
  slug: string;
  price: number | null;
  perUnitLabel: string | null;
  unitOfMeasure: string | null;
  purchasable: boolean;
  nutriscore: string | null;
  format: string | null;
  packaging: string | null;
  categories: string[];
  imageUrl: string | null;
  offerServiceId: string | null;
}

/** Résultat de recherche */
export interface SearchResult {
  products: CarrefourProduct[];
  total: number;
  keyword: string;
}

/** Magasin Carrefour */
export interface CarrefourStore {
  ref: string;
  name: string;
  format: string;
  distance: string;
  isDrive?: boolean;
  isDelivery?: boolean;
  address?: {
    address1: string;
    city: string;
    postalCode: string;
  };
}

/** Créneau de livraison */
export interface DeliverySlot {
  begDate: string;
  endDate: string;
}

/** Produit dans le panier */
export interface CartItem {
  ean: string;
  title: string;
  brand: string;
  quantity: number;
  price: number;
  available: boolean;
}

/** Panier complet */
export interface Cart {
  totalAmount: number;
  totalFees: number;
  items: CartItem[];
}

/** Item parsé par Claude depuis la liste en langage naturel */
export interface ParsedGroceryItem {
  query: string;
  originalText: string;
  quantity?: number;
  unit?: string;
  brand?: string;
  status: "clear" | "ambiguous" | "unrecognized";
  /** Question pour l'utilisateur si ambigu */
  clarificationQuestion?: string;
  /** Suggestions si ambigu ou incompris */
  suggestions?: string[];
}
