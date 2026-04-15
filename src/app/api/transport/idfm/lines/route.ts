import { NextRequest, NextResponse } from "next/server";
import { searchLine } from "@/lib/transport/prim";
import { rateLimit, clientKey, rateLimitHeaders } from "@/lib/rate-limit";
import type { TransportLineInfo } from "@/lib/transport/types";

/** 30 requêtes par minute par IP — données semi-statiques. */
const RATE_MAX = 30;
const RATE_WINDOW_MS = 60_000;
const MAX_QUERY_LENGTH = 80;

export interface LinesApiResponse {
  lines: TransportLineInfo[];
}

/**
 * GET /api/transport/idfm/lines?q={query}
 *
 * Recherche de lignes de transport Île-de-France par code ou nom.
 * `q` : code court (ex: "13", "A", "RER B") ou nom partiel
 */
export async function GET(request: NextRequest) {
  const rl = await rateLimit(
    `idfm-lines:${clientKey(request)}`,
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
  if (!q) {
    return NextResponse.json(
      { error: "Paramètre q requis." },
      { status: 400 }
    );
  }
  if (q.length > MAX_QUERY_LENGTH) {
    return NextResponse.json({ error: "Requête trop longue." }, { status: 413 });
  }

  try {
    const lines = await searchLine(q);
    const body: LinesApiResponse = { lines };
    return NextResponse.json(body, {
      headers: {
        "Cache-Control": "public, max-age=300, stale-while-revalidate=60",
      },
    });
  } catch (err) {
    console.error("[idfm] lines search failed:", err);
    return NextResponse.json(
      { error: "Recherche de ligne impossible. Veuillez réessayer." },
      { status: 502 }
    );
  }
}
