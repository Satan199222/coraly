import { NextRequest, NextResponse } from "next/server";
import {
  rateLimit,
  clientKey,
  rateLimitHeaders,
} from "@/lib/rate-limit";
import { validateReferralCode, normalizeCode } from "@/lib/referral";

/**
 * GET /api/referral/validate?code=XXXXXXXX
 *
 * Valide un code referral. Route publique, accessible sans authentification.
 * Utilisée par la page d'inscription pour vérifier le code passé en query.
 *
 * Response (valide)   : { valid: true,  referrerInitial: "M." }
 * Response (invalide) : { valid: false }
 *
 * Rate limit : 60 req/min/IP — le formulaire d'inscription vérifie à la saisie.
 */

const RATE_MAX = 60;
const RATE_WINDOW_MS = 60_000;

export async function GET(request: NextRequest): Promise<NextResponse> {
  const rl = await rateLimit(
    `referral:validate:${clientKey(request)}`,
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

  const code = request.nextUrl.searchParams.get("code");

  if (!code || typeof code !== "string" || !code.trim()) {
    return NextResponse.json({ error: "code requis" }, { status: 400 });
  }

  const normalized = normalizeCode(code);

  // Format check avant d'interroger Redis
  if (!/^[A-Z0-9]{8}$/.test(normalized)) {
    return NextResponse.json({ valid: false }, { status: 200 });
  }

  let entry: Awaited<ReturnType<typeof validateReferralCode>>;
  try {
    entry = await validateReferralCode(normalized);
  } catch (err) {
    console.error("[referral] Erreur validation code:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }

  if (!entry) {
    return NextResponse.json({ valid: false }, { status: 200 });
  }

  // On n'expose pas l'email complet — juste l'initiale pour rassurer le visiteur
  const initial = entry.email.charAt(0).toUpperCase() + ".";
  return NextResponse.json({ valid: true, referrerInitial: initial }, { status: 200 });
}
