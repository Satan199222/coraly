import { NextRequest, NextResponse } from "next/server";
import {
  rateLimit,
  clientKey,
  rateLimitHeaders,
} from "@/lib/rate-limit";
import { getOrCreateReferralCode, buildReferralLink } from "@/lib/referral";

/**
 * POST /api/referral/generate
 *
 * Génère ou retrouve le code referral d'un utilisateur.
 * Idempotent : deux appels avec le même email retournent le même code.
 *
 * Body : { email: string }
 * Response : { code: string, link: string }
 *
 * Rate limit : 5 req/min/IP — génération d'un code est une opération rare.
 */

const RATE_MAX = 5;
const RATE_WINDOW_MS = 60_000;

export async function POST(request: NextRequest): Promise<NextResponse> {
  const rl = await rateLimit(
    `referral:generate:${clientKey(request)}`,
    RATE_MAX,
    RATE_WINDOW_MS
  );
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Trop de requêtes. Réessayez dans quelques instants." },
      {
        status: 429,
        headers: rateLimitHeaders(RATE_MAX, rl.remaining, rl.resetAt),
      }
    );
  }

  let body: { email?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const email = body.email;
  if (typeof email !== "string" || !email.trim()) {
    return NextResponse.json({ error: "email requis" }, { status: 400 });
  }

  // Validation basique format email
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return NextResponse.json({ error: "email invalide" }, { status: 400 });
  }

  let code: string;
  try {
    code = await getOrCreateReferralCode(email.trim());
  } catch (err) {
    console.error("[referral] Erreur génération code:", err);
    return NextResponse.json(
      { error: "Impossible de générer le code referral" },
      { status: 500 }
    );
  }

  const link = buildReferralLink(code);
  return NextResponse.json({ code, link }, { status: 200 });
}
