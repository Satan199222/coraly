import { NextRequest, NextResponse } from "next/server";
import { createLreSending, getLreSendingStatus } from "@/lib/poste/maileva";
import { rateLimit, clientKey, rateLimitHeaders } from "@/lib/rate-limit";
import type { LreSendingApiResponse, LreSendingOptions } from "@/lib/poste/types";

/** 10 envois par minute par IP — chaque appel crée un recommandé électronique facturable. */
const RATE_MAX = 10;
const RATE_WINDOW_MS = 60_000;

/**
 * POST /api/poste/lre
 *   Body JSON : LreSendingOptions
 *   → Crée un recommandé électronique (LRE) via Maileva.
 *
 * GET /api/poste/lre?id={sendingId}
 *   → Retourne le statut d'un envoi LRE existant.
 */

export async function POST(request: NextRequest) {
  const rl = await rateLimit(
    `poste-lre:${clientKey(request)}`,
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

  let options: LreSendingOptions;
  try {
    options = (await request.json()) as LreSendingOptions;
  } catch {
    return NextResponse.json(
      { error: "Corps JSON invalide." },
      { status: 400 }
    );
  }

  if (
    !options.name ||
    !options.senderEmail ||
    !options.recipientEmail ||
    !options.recipientName ||
    !options.body
  ) {
    return NextResponse.json(
      {
        error:
          "Champs requis : name, senderEmail, recipientEmail, recipientName, body.",
      },
      { status: 400 }
    );
  }

  // Validation e-mail basique
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRe.test(options.senderEmail) || !emailRe.test(options.recipientEmail)) {
    return NextResponse.json(
      { error: "senderEmail ou recipientEmail invalide." },
      { status: 400 }
    );
  }

  try {
    const sending = await createLreSending(options);
    const body: LreSendingApiResponse = { sending };
    return NextResponse.json(body, { status: 201 });
  } catch (err) {
    console.error("[poste] lre create failed:", err);
    return NextResponse.json(
      { error: "Création du recommandé électronique impossible. Vérifiez vos identifiants Maileva." },
      { status: 502 }
    );
  }
}

export async function GET(request: NextRequest) {
  const rl = await rateLimit(
    `poste-lre-status:${clientKey(request)}`,
    30,
    RATE_WINDOW_MS
  );
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Trop de requêtes. Veuillez patienter." },
      { status: 429, headers: rateLimitHeaders(30, rl.remaining, rl.resetAt) }
    );
  }

  const sendingId = request.nextUrl.searchParams.get("id");
  if (!sendingId) {
    return NextResponse.json(
      { error: "Paramètre id requis." },
      { status: 400 }
    );
  }

  try {
    const sending = await getLreSendingStatus(sendingId);
    const body: LreSendingApiResponse = { sending };
    return NextResponse.json(body);
  } catch (err) {
    console.error("[poste] lre status failed:", err);
    return NextResponse.json(
      { error: "Statut de l'envoi LRE introuvable." },
      { status: 502 }
    );
  }
}
