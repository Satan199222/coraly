import { NextRequest, NextResponse } from "next/server";
import { trackShipment } from "@/lib/poste/laposte";
import { rateLimit, clientKey, rateLimitHeaders } from "@/lib/rate-limit";
import type { TrackingApiResponse } from "@/lib/poste/types";

/** 30 requêtes par minute par IP — chaque appel interroge l'API La Poste. */
const RATE_MAX = 30;
const RATE_WINDOW_MS = 60_000;

/**
 * GET /api/poste/tracking?id={numéro_de_suivi}
 *
 * Suit un envoi La Poste par numéro de colis.
 * `id` : numéro de suivi (ex: "6T12345678901" Colissimo, "1A23456789" Lettre suivie)
 */
export async function GET(request: NextRequest) {
  const rl = await rateLimit(
    `poste-tracking:${clientKey(request)}`,
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

  const idShip = request.nextUrl.searchParams.get("id");
  if (!idShip || !idShip.trim()) {
    return NextResponse.json(
      { error: "Paramètre id requis (numéro de suivi)." },
      { status: 400 }
    );
  }

  try {
    const tracking = await trackShipment(idShip.trim());
    const body: TrackingApiResponse = { tracking };
    return NextResponse.json(body);
  } catch (err) {
    console.error("[poste] tracking failed:", err);
    const message =
      err instanceof Error && err.message.includes("[laposte]")
        ? err.message.replace("[laposte] ", "")
        : "Suivi impossible. Vérifiez le numéro de colis et réessayez.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
