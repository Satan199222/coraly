import { NextRequest, NextResponse } from "next/server";
import {
  rateLimit,
  clientKey,
  rateLimitHeaders,
} from "@/lib/rate-limit";

/**
 * Stream ElevenLabs TTS vers le client.
 *
 * Le client envoie du texte, on appelle ElevenLabs en streaming, et on
 * forward les bytes audio/mpeg directement. xi-api-key reste server-side.
 *
 * Coût : ~0,18 $/1k chars au-delà du free tier 10k chars/mois. On cap la
 * longueur à 1500 chars par appel pour éviter l'abus ; les annonces
 * VoixCourses font typiquement < 500 chars.
 *
 * Modèle : eleven_turbo_v2_5 — rapide (~500ms premier byte), multilingual
 * (gère bien le FR malgré une voix anglophone de base).
 */

const MAX_TEXT_LENGTH = 1500;
// Rate limit large pour le TTS : une session VoixCourses déclenche beaucoup
// d'annonces courtes (étapes, confirmations, focus). 60/min/IP laisse large
// tout en bloquant un script naïf.
const RATE_MAX = 60;
const RATE_WINDOW_MS = 60_000;

// Voix Rachel (free tier ElevenLabs, multilingual_v2 supporte FR).
// Change pour une voix FR native (Koraly) si tu upgrades au tier payant.
const VOICE_ID = "21m00Tcm4TlvDq8ikWAM";

export async function POST(request: NextRequest) {
  const rl = rateLimit(
    `tts:${clientKey(request)}`,
    RATE_MAX,
    RATE_WINDOW_MS
  );
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Trop de requêtes TTS. Patientez quelques secondes." },
      {
        status: 429,
        headers: rateLimitHeaders(RATE_MAX, rl.remaining, rl.resetAt),
      }
    );
  }

  let body: { text?: string; voice?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const text = body.text?.trim();
  if (!text) {
    return NextResponse.json({ error: "text requis" }, { status: 400 });
  }
  if (text.length > MAX_TEXT_LENGTH) {
    return NextResponse.json(
      { error: `Texte trop long (max ${MAX_TEXT_LENGTH} caractères)` },
      { status: 413 }
    );
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    console.error("[tts] ELEVENLABS_API_KEY manquant");
    return NextResponse.json(
      { error: "TTS non configuré" },
      { status: 500 }
    );
  }

  const voiceId = body.voice || VOICE_ID;

  try {
    const elevenRes = await fetch(
      // output_format mp3_22050_32 : qualité correcte, fichier léger.
      // optimize_streaming_latency=3 : compromise TTFB / qualité.
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream?output_format=mp3_22050_32&optimize_streaming_latency=3`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "content-type": "application/json",
          accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_turbo_v2_5",
          language_code: "fr",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0,
            use_speaker_boost: true,
          },
        }),
      }
    );

    if (!elevenRes.ok) {
      const errText = await elevenRes.text().catch(() => "");
      console.error(
        "[tts] ElevenLabs HTTP",
        elevenRes.status,
        errText.slice(0, 200)
      );
      return NextResponse.json(
        { error: `TTS ElevenLabs indisponible (${elevenRes.status})` },
        { status: 502 }
      );
    }

    // Stream le body ElevenLabs directement au client. Pas de buffering.
    return new Response(elevenRes.body, {
      status: 200,
      headers: {
        "content-type": "audio/mpeg",
        "cache-control": "no-store",
      },
    });
  } catch (err) {
    console.error("[tts] fetch error:", err);
    return NextResponse.json(
      { error: "Erreur lors de l'appel TTS" },
      { status: 500 }
    );
  }
}
