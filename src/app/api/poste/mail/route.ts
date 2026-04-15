import { NextRequest, NextResponse } from "next/server";
import { createMailSending, getMailSendingStatus } from "@/lib/poste/maileva";
import { rateLimit, clientKey, rateLimitHeaders } from "@/lib/rate-limit";
import type { MailSendingApiResponse, MailSendingOptions } from "@/lib/poste/types";

/** 10 envois par minute par IP — chaque appel crée un envoi physique facturable. */
const RATE_MAX = 10;
const RATE_WINDOW_MS = 60_000;

/**
 * POST /api/poste/mail
 *   Body JSON : MailSendingOptions
 *   → Crée un envoi de courrier physique via Maileva.
 *
 * GET /api/poste/mail?id={sendingId}
 *   → Retourne le statut d'un envoi existant.
 */

export async function POST(request: NextRequest) {
  const rl = await rateLimit(
    `poste-mail:${clientKey(request)}`,
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

  let options: MailSendingOptions;
  try {
    options = (await request.json()) as MailSendingOptions;
  } catch {
    return NextResponse.json(
      { error: "Corps JSON invalide." },
      { status: 400 }
    );
  }

  if (!options.name || !options.recipientName || !options.recipientAddress) {
    return NextResponse.json(
      { error: "Champs requis : name, recipientName, recipientAddress." },
      { status: 400 }
    );
  }

  if (
    !options.recipientAddress.line1 ||
    !options.recipientAddress.line6
  ) {
    return NextResponse.json(
      { error: "recipientAddress doit contenir line1 (destinataire) et line6 (CP Ville)." },
      { status: 400 }
    );
  }

  if (!options.documentBase64 && !options.documentUrl) {
    return NextResponse.json(
      { error: "Champ requis : documentBase64 ou documentUrl." },
      { status: 400 }
    );
  }

  try {
    const sending = await createMailSending(options);
    const body: MailSendingApiResponse = { sending };
    return NextResponse.json(body, { status: 201 });
  } catch (err) {
    console.error("[poste] mail create failed:", err);
    return NextResponse.json(
      { error: "Création de l'envoi impossible. Vérifiez vos identifiants Maileva." },
      { status: 502 }
    );
  }
}

export async function GET(request: NextRequest) {
  const rl = await rateLimit(
    `poste-mail-status:${clientKey(request)}`,
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
    const sending = await getMailSendingStatus(sendingId);
    const body: MailSendingApiResponse = { sending };
    return NextResponse.json(body);
  } catch (err) {
    console.error("[poste] mail status failed:", err);
    return NextResponse.json(
      { error: "Statut de l'envoi introuvable." },
      { status: 502 }
    );
  }
}
