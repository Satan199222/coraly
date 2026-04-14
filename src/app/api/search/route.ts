import { NextRequest, NextResponse } from "next/server";
import { searchProducts } from "@/lib/carrefour/client";
import { rankProducts } from "@/lib/carrefour/score";
import {
  rateLimit,
  clientKey,
  rateLimitHeaders,
} from "@/lib/rate-limit";

/** 30 recherches par minute — une liste de 20 produits déclenche 20 search en
 *  parallèle, on laisse donc large mais on coupe les bursts abusifs. */
const RATE_MAX = 30;
const RATE_WINDOW_MS = 60_000;
/** Longueur max de la query — au-delà c'est forcément du bruit ou un abus. */
const MAX_QUERY_LENGTH = 200;

export async function GET(request: NextRequest) {
  const rl = await rateLimit(
    `search:${clientKey(request)}`,
    RATE_MAX,
    RATE_WINDOW_MS
  );
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Trop de recherches. Veuillez patienter." },
      {
        status: 429,
        headers: rateLimitHeaders(RATE_MAX, rl.remaining, rl.resetAt),
      }
    );
  }

  const query = request.nextUrl.searchParams.get("q");
  if (!query) {
    return NextResponse.json({ error: "q requis" }, { status: 400 });
  }
  if (query.length > MAX_QUERY_LENGTH) {
    return NextResponse.json(
      { error: "Requête trop longue." },
      { status: 413 }
    );
  }

  // Contexte optionnel pour le reranking. Passé en query string pour rester
  // idempotent et cacheable côté CDN (vs POST).
  const dietParam = request.nextUrl.searchParams.get("diet");
  const brand = request.nextUrl.searchParams.get("brand") ?? undefined;
  const qtyParam = request.nextUrl.searchParams.get("qty");
  const unit = request.nextUrl.searchParams.get("unit") ?? undefined;
  const storeRef = request.nextUrl.searchParams.get("storeRef") ?? undefined;

  const diet = dietParam ? dietParam.split(",").filter(Boolean) : undefined;
  const targetQuantity = qtyParam ? Number(qtyParam) : undefined;

  try {
    const result = await searchProducts(query, storeRef);
    const ranked = rankProducts(result.products, query, {
      diet,
      brand,
      targetQuantity: Number.isFinite(targetQuantity) ? targetQuantity : undefined,
      targetUnit: unit,
    });
    return NextResponse.json({ ...result, products: ranked });
  } catch (err) {
    console.error("[search] Carrefour search failed:", err);
    return NextResponse.json(
      { error: "Recherche impossible. Veuillez réessayer." },
      { status: 502 }
    );
  }
}
