import { NextRequest, NextResponse } from "next/server";
import { parseGroceryList, type ParseContext } from "@/lib/ai/parse-grocery-list";
import {
  rateLimit,
  clientKey,
  rateLimitHeaders,
} from "@/lib/rate-limit";

/** Longueur max du texte accepté. 5 000 caractères = ~1 000 mots = bien plus
 *  qu'une liste de courses normale. Au-delà, on rejette sans appeler Claude
 *  (qui coûterait cher en tokens pour rien). */
const MAX_TEXT_LENGTH = 5000;

/** Rate-limit : 10 analyses par minute par IP. Suffit largement pour un user
 *  réel qui itère, bloque un script naïf qui spamme. */
const RATE_MAX = 10;
const RATE_WINDOW_MS = 60_000;

export async function POST(request: NextRequest) {
  const key = `parse-list:${clientKey(request)}`;
  const rl = await rateLimit(key, RATE_MAX, RATE_WINDOW_MS);
  if (!rl.ok) {
    return NextResponse.json(
      {
        error:
          "Trop de requêtes. Veuillez patienter avant de relancer une analyse.",
      },
      {
        status: 429,
        headers: rateLimitHeaders(RATE_MAX, rl.remaining, rl.resetAt),
      }
    );
  }

  let body: { text?: string; context?: ParseContext };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide" }, { status: 400 });
  }

  const text = body.text;
  if (!text?.trim()) {
    return NextResponse.json({ error: "text requis" }, { status: 400 });
  }
  if (text.length > MAX_TEXT_LENGTH) {
    return NextResponse.json(
      {
        error: `Liste trop longue (max ${MAX_TEXT_LENGTH} caractères). Réduisez votre texte.`,
      },
      { status: 413 }
    );
  }

  try {
    const items = await parseGroceryList(text, body.context ?? {});
    return NextResponse.json({ items });
  } catch (err) {
    console.error("[parse-list] Claude parsing failed:", err);
    return NextResponse.json(
      { error: "Analyse de la liste impossible. Veuillez réessayer." },
      { status: 502 }
    );
  }
}
