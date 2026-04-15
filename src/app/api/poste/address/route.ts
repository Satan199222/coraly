import { NextRequest, NextResponse } from "next/server";
import { searchAddress, reverseGeocode } from "@/lib/poste/ban";
import { rateLimit, clientKey, rateLimitHeaders } from "@/lib/rate-limit";
import type { AddressSearchApiResponse } from "@/lib/poste/types";

/** 60 requêtes par minute par IP — API BAN ouverte mais à ne pas saturer. */
const RATE_MAX = 60;
const RATE_WINDOW_MS = 60_000;
const MAX_LIMIT = 20;

/**
 * GET /api/poste/address?q={query}&limit={n}
 *   → Autocomplétion d'adresse (BAN)
 *
 * GET /api/poste/address?lat={lat}&lon={lon}
 *   → Géocodage inverse (BAN)
 */
export async function GET(request: NextRequest) {
  const rl = await rateLimit(
    `poste-address:${clientKey(request)}`,
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

  const params = request.nextUrl.searchParams;
  const query = params.get("q");
  const latStr = params.get("lat");
  const lonStr = params.get("lon");

  // --- Géocodage inverse ---
  if (latStr && lonStr) {
    const lat = parseFloat(latStr);
    const lon = parseFloat(lonStr);

    if (isNaN(lat) || isNaN(lon)) {
      return NextResponse.json(
        { error: "Paramètres lat et lon doivent être des nombres." },
        { status: 400 }
      );
    }

    try {
      const address = await reverseGeocode(lat, lon);
      const body: AddressSearchApiResponse = {
        query: `${lat},${lon}`,
        addresses: address ? [address] : [],
      };
      return NextResponse.json(body);
    } catch (err) {
      console.error("[poste] address reverse failed:", err);
      return NextResponse.json(
        { error: "Géocodage inverse impossible. Veuillez réessayer." },
        { status: 502 }
      );
    }
  }

  // --- Autocomplétion ---
  if (!query || !query.trim()) {
    return NextResponse.json(
      { error: "Paramètre q (requête) ou lat+lon requis." },
      { status: 400 }
    );
  }

  const rawLimit = params.get("limit");
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, rawLimit ? parseInt(rawLimit, 10) || 8 : 8)
  );

  try {
    const addresses = await searchAddress(query.trim(), limit);
    const body: AddressSearchApiResponse = { query: query.trim(), addresses };
    return NextResponse.json(body);
  } catch (err) {
    console.error("[poste] address search failed:", err);
    return NextResponse.json(
      { error: "Recherche d'adresse impossible. Veuillez réessayer." },
      { status: 502 }
    );
  }
}
