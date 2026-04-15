import { NextRequest, NextResponse } from "next/server";
import { searchProduct } from "@/lib/sante/pharmagdd";
import { rateLimit, clientKey, rateLimitHeaders } from "@/lib/rate-limit";
import type { PharmaSearchResult } from "@/lib/sante/types";

/** 20 requêtes par minute par IP — chaque appel effectue 1-2 requêtes vers Pharma GDD. */
const RATE_MAX = 20;
const RATE_WINDOW_MS = 60_000;

/**
 * GET /api/sante/search?q={terme}
 *
 * Recherche un médicament / produit parapharmacie sur Pharma GDD.
 * Mécanisme : suivi de redirection /fr/search?q={q} + extraction JSON-LD.
 *
 * Réponses possibles :
 *   200 { type: "product", product: PharmaProduct, resolvedUrl }
 *   200 { type: "category", categorySlugs: string[], resolvedUrl }
 *   400 { error: string }   — paramètre manquant
 *   429 { error: string }   — rate limit
 *   502 { error: string }   — erreur amont Pharma GDD
 *
 * GROA-246 — Phase 4b VoixSanté interface conversationnelle Koraly
 */
export async function GET(request: NextRequest) {
  const rl = await rateLimit(
    `sante-search:${clientKey(request)}`,
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

  const q = request.nextUrl.searchParams.get("q");
  if (!q || !q.trim()) {
    return NextResponse.json(
      { error: "Paramètre q requis (terme de recherche)." },
      { status: 400 }
    );
  }

  try {
    const result: PharmaSearchResult = await searchProduct(q.trim());
    return NextResponse.json(result);
  } catch (err) {
    console.error("[sante] search failed:", err);
    const message =
      err instanceof Error && err.message.includes("[pharmagdd]")
        ? err.message.replace("[pharmagdd] ", "")
        : "Recherche impossible. Réessayez dans un instant.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
