import { NextResponse } from "next/server";
import { rateLimit, clientKey, rateLimitHeaders } from "@/lib/rate-limit";

/**
 * Génère un signed URL ElevenLabs pour l'agent Recettes de Coraly.
 *
 * Utilise ELEVENLABS_AGENT_ID_RECETTES (agent dédié recherche et lecture de recettes)
 * et ELEVENLABS_API_KEY (clé partagée).
 *
 * GROA-286 — Agent ElevenLabs Coraly Recettes
 */

const RATE_MAX = 10;
const RATE_WINDOW_MS = 60_000;

export async function GET(request: Request) {
  const rl = await rateLimit(
    `agent-recettes-signed-url:${clientKey(request)}`,
    RATE_MAX,
    RATE_WINDOW_MS
  );
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Trop de sessions démarrées. Veuillez patienter." },
      {
        status: 429,
        headers: rateLimitHeaders(RATE_MAX, rl.remaining, rl.resetAt),
      }
    );
  }

  const apiKey = process.env.ELEVENLABS_API_KEY ?? "";
  const agentId = process.env.ELEVENLABS_AGENT_ID_RECETTES ?? "";

  if (!apiKey) {
    console.error("[agent/recettes] ELEVENLABS_API_KEY manquante.");
    return NextResponse.json(
      { error: "Agent vocal Recettes non configuré sur le serveur." },
      { status: 500 }
    );
  }
  if (!agentId) {
    console.error("[agent/recettes] ELEVENLABS_AGENT_ID_RECETTES manquante.");
    return NextResponse.json(
      { error: "Agent vocal Recettes non configuré sur le serveur." },
      { status: 500 }
    );
  }

  try {
    const res = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/get_signed_url?agent_id=${agentId}`,
      {
        headers: { "xi-api-key": apiKey },
        signal: AbortSignal.timeout(8000),
      }
    );
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error(
        "[agent/recettes] ElevenLabs signed_url failed:",
        res.status,
        errText
      );
      return NextResponse.json(
        { error: "Impossible de démarrer la session vocale Recettes." },
        { status: 502 }
      );
    }
    const data = (await res.json()) as { signed_url: string };
    return NextResponse.json({ signedUrl: data.signed_url });
  } catch (err) {
    console.error("[agent/recettes] signed_url error:", err);
    return NextResponse.json(
      { error: "Erreur serveur lors de l'initialisation de l'agent Recettes." },
      { status: 500 }
    );
  }
}
