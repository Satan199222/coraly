import { NextRequest, NextResponse } from "next/server";
import {
  rateLimit,
  clientKey,
  rateLimitHeaders,
} from "@/lib/rate-limit";
import { validateReferralCode, normalizeCode } from "@/lib/referral";

/**
 * Route publique de parrainage : /invitation/[code]
 *
 * Accessible sans authentification — partagé par WhatsApp, email, SMS.
 * Valide le code referral, puis redirige vers la page d'inscription
 * avec le code pré-rempli en query string.
 *
 * Rate limit : 30 req/min/IP — protège contre les scans de codes en force brute.
 */

const RATE_MAX = 30;
const RATE_WINDOW_MS = 60_000;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
): Promise<NextResponse> {
  // Rate limiting anti-abus
  const rl = await rateLimit(
    `invitation:${clientKey(request)}`,
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

  const { code } = await params;

  if (!code || typeof code !== "string") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const normalizedCode = normalizeCode(code);

  // Validation basique du format (8 caractères alphanumériques)
  if (!/^[A-Z0-9]{8}$/.test(normalizedCode)) {
    console.warn(`[referral] Code invalide reçu sur /invitation: "${code}"`);
    return NextResponse.redirect(new URL("/", request.url));
  }

  const entry = await validateReferralCode(normalizedCode);

  if (!entry) {
    // Code inconnu — rediriger vers l'accueil sans code (lien mort ou expiré)
    console.warn(`[referral] Code inexistant: ${normalizedCode}`);
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Rediriger vers la page d'inscription avec le code pré-rempli
  const destination = new URL("/app/inscription", request.url);
  destination.searchParams.set("code", normalizedCode);

  console.info(
    `[referral] Redirect invitation code=${normalizedCode} → /app/inscription`
  );

  // 302 temporaire : permet à l'utilisateur de re-partager le lien
  return NextResponse.redirect(destination, { status: 302 });
}
