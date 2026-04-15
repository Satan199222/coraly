import { NextRequest, NextResponse } from "next/server";
import { getProduct } from "@/lib/sante/pharmagdd";
import { rateLimit, clientKey, rateLimitHeaders } from "@/lib/rate-limit";
import type { PharmaProduct } from "@/lib/sante/types";

/** 30 requêtes par minute par IP — chaque appel interroge une page Pharma GDD. */
const RATE_MAX = 30;
const RATE_WINDOW_MS = 60_000;

/**
 * GET /api/pharma/product/{slug}
 *
 * Récupère les données complètes d'un médicament Pharma GDD par son slug URL.
 *
 * Exemple :
 *   GET /api/pharma/product/doliprane-1000-mg-paracetamol-effervescent
 *
 * Réponses :
 *   200 { product: PharmaProduct }
 *   400 { error: string }   — slug manquant / invalide
 *   404 { error: string }   — produit introuvable
 *   429 { error: string }   — rate limit
 *   502 { error: string }   — erreur amont Pharma GDD
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rl = await rateLimit(
    `pharma-product:${clientKey(request)}`,
    RATE_MAX,
    RATE_WINDOW_MS
  );
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Trop de requêtes. Veuillez patienter." },
      {
        status: 429,
        headers: rateLimitHeaders(RATE_MAX, rl.remaining, rl.resetAt),
      }
    );
  }

  const { id: slug } = await params;
  if (!slug || !slug.trim()) {
    return NextResponse.json(
      { error: "Slug produit requis." },
      { status: 400 }
    );
  }

  try {
    const product: PharmaProduct = await getProduct(slug.trim());
    return NextResponse.json({ product });
  } catch (err) {
    console.error("[pharma] product fetch failed:", err);
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("introuvable") || msg.includes("HTTP 404")) {
      return NextResponse.json(
        { error: `Produit "${slug}" introuvable sur Pharma GDD.` },
        { status: 404 }
      );
    }
    const message = msg.includes("[pharmagdd]")
      ? msg.replace("[pharmagdd] ", "")
      : "Récupération du produit impossible. Réessayez dans un instant.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
