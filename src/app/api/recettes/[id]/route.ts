import { NextRequest, NextResponse } from "next/server";
import { getRecipe } from "@/lib/recettes/client";
import { rateLimit, clientKey, rateLimitHeaders } from "@/lib/rate-limit";

/** 20 requêtes par minute par IP. */
const RATE_MAX = 20;
const RATE_WINDOW_MS = 60_000;

/**
 * GET /api/recettes/[id]
 *
 * Détail complet d'une recette (ingrédients + étapes découpées).
 * IDs Spoonacular : entier (ex. 716429)
 * IDs TheMealDB   : préfixe "mdb-" (ex. mdb-52772)
 *
 * Réponses :
 *   200 { recipe: Recipe }
 *   400 { error: string }   — ID manquant
 *   404 { error: string }   — recette introuvable
 *   429 { error: string }   — rate limit
 *   502 { error: string }   — erreur API amont
 *
 * GROA-254 — Phase 5b VoixRecettes
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rl = await rateLimit(
    `recettes-detail:${clientKey(request)}`,
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

  const { id } = await params;
  if (!id) {
    return NextResponse.json(
      { error: "Identifiant de recette requis." },
      { status: 400 }
    );
  }

  try {
    const recipe = await getRecipe(id);
    return NextResponse.json({ recipe });
  } catch (err) {
    console.error("[recettes] detail failed:", err);
    const message = err instanceof Error ? err.message : String(err);
    const isNotFound =
      message.includes("introuvable") || message.includes("404");
    return NextResponse.json(
      { error: isNotFound ? "Recette introuvable." : "Erreur lors du chargement de la recette." },
      { status: isNotFound ? 404 : 502 }
    );
  }
}
