import { NextRequest, NextResponse } from "next/server";
import { searchRecipes } from "@/lib/recettes/client";
import { rateLimit, clientKey, rateLimitHeaders } from "@/lib/rate-limit";

/** 30 requêtes par minute par IP. */
const RATE_MAX = 30;
const RATE_WINDOW_MS = 60_000;

/**
 * GET /api/recettes/search?q={terme}
 *
 * Recherche de recettes via Spoonacular (si SPOONACULAR_API_KEY défini)
 * ou TheMealDB free tier (fallback sans clé).
 *
 * Réponses :
 *   200 { results: RecipeSummary[] }
 *   400 { error: string }   — paramètre manquant
 *   429 { error: string }   — rate limit
 *   502 { error: string }   — erreur API amont
 *
 * GROA-254 — Phase 5b VoixRecettes
 */
export async function GET(request: NextRequest) {
  const rl = await rateLimit(
    `recettes-search:${clientKey(request)}`,
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
    const results = await searchRecipes(q.trim());
    return NextResponse.json({ results });
  } catch (err) {
    console.error("[recettes] search failed:", err);
    return NextResponse.json(
      { error: "Recherche impossible. Réessayez dans un instant." },
      { status: 502 }
    );
  }
}
