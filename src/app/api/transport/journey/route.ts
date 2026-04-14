import { NextRequest, NextResponse } from "next/server";
import { getJourneys } from "@/lib/transport/navitia";
import { rateLimit, clientKey, rateLimitHeaders } from "@/lib/rate-limit";
import type { JourneyApiResponse } from "@/lib/transport/types";

/** 20 calculs d'itinéraire par minute par IP — chaque requête fait appel à Navitia. */
const RATE_MAX = 20;
const RATE_WINDOW_MS = 60_000;

export async function GET(request: NextRequest) {
  const rl = await rateLimit(
    `transport-journey:${clientKey(request)}`,
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

  const from = request.nextUrl.searchParams.get("from");
  const to = request.nextUrl.searchParams.get("to");
  const datetime = request.nextUrl.searchParams.get("datetime") ?? undefined;

  if (!from || !to) {
    return NextResponse.json(
      { error: "Paramètres from et to requis." },
      { status: 400 }
    );
  }

  try {
    const journeys = await getJourneys(from, to, datetime);
    const body: JourneyApiResponse = { journeys };
    return NextResponse.json(body);
  } catch (err) {
    console.error("[transport] journey search failed:", err);
    return NextResponse.json(
      { error: "Calcul d'itinéraire impossible. Veuillez réessayer." },
      { status: 502 }
    );
  }
}
