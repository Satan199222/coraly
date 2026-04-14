import { NextRequest, NextResponse } from "next/server";
import {
  rateLimit,
  clientKey,
  rateLimitHeaders,
} from "@/lib/rate-limit";
import { recordConversion } from "@/lib/referral";

/**
 * POST /api/referral/convert
 *
 * Enregistre une conversion referral après inscription confirmée d'un filleul.
 * Accorde 2 mois d'accès premium au parrain ET au filleul.
 *
 * Body : { referrerCode: string, referreeEmail: string }
 * Response (succès)       : { ok: true }
 * Response (déjà converti): { ok: false, reason: "conversion_deja_enregistree" }
 * Response (code invalide): { ok: false, reason: "code_invalide" }
 * Response (auto-referral): { ok: false, reason: "auto_referral" }
 *
 * Rate limit : 5 req/min/IP — conversion est une opération d'inscription rare.
 */

const RATE_MAX = 5;
const RATE_WINDOW_MS = 60_000;

export async function POST(request: NextRequest): Promise<NextResponse> {
  const rl = await rateLimit(
    `referral:convert:${clientKey(request)}`,
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

  let body: { referrerCode?: unknown; referreeEmail?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const { referrerCode, referreeEmail } = body;

  if (typeof referrerCode !== "string" || !referrerCode.trim()) {
    return NextResponse.json({ error: "referrerCode requis" }, { status: 400 });
  }
  if (typeof referreeEmail !== "string" || !referreeEmail.trim()) {
    return NextResponse.json(
      { error: "referreeEmail requis" },
      { status: 400 }
    );
  }

  // Validation basique format email
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(referreeEmail.trim())) {
    return NextResponse.json(
      { error: "referreeEmail invalide" },
      { status: 400 }
    );
  }

  let result: Awaited<ReturnType<typeof recordConversion>>;
  try {
    result = await recordConversion(referrerCode.trim(), referreeEmail.trim());
  } catch (err) {
    console.error("[referral] Erreur enregistrement conversion:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }

  if (!result.ok) {
    // Cas "code invalide" → 404, les autres cas → 409 (conflit)
    const status = result.reason === "code_invalide" ? 404 : 409;
    return NextResponse.json(
      { ok: false, reason: result.reason },
      { status }
    );
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
