"use client";

/**
 * Signaux sonores courts pour le micro (début / fin dictée).
 *
 * Pourquoi pas un fichier .mp3 : on veut zéro latence (juste après le clic),
 * zéro réseau, fonctionner offline. Web Audio API génère le ton en 1 ms.
 *
 * Convention :
 * - start → bip aigu (800 Hz) : "je t'écoute, parle"
 * - stop → bip grave (500 Hz) : "j'ai arrêté d'écouter"
 *
 * Un utilisateur non-voyant reconnaît l'aigu/grave instantanément — plus
 * rapide qu'un message TTS et ne saute pas la file TTS en cours.
 */

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (ctx) return ctx;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const AC = window.AudioContext || (window as any).webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  return ctx;
}

export function playBeep(kind: "start" | "stop"): void {
  const audio = getCtx();
  if (!audio) return;

  // Certains browsers suspendent le context tant qu'il n'y a pas d'interaction
  // utilisateur. Au 1er appel après un click, resume() est silencieux si déjà OK.
  if (audio.state === "suspended") {
    audio.resume().catch((err) => {
      console.warn("[beep] AudioContext.resume failed:", err);
    });
  }

  const osc = audio.createOscillator();
  const gain = audio.createGain();

  osc.type = "sine";
  osc.frequency.value = kind === "start" ? 880 : 520;

  // Enveloppe : attaque courte + déclin rapide pour ne pas avoir un "clic"
  // désagréable au début et à la fin. Volume raisonnable (0.15) — pas trop fort.
  const now = audio.currentTime;
  const duration = 0.12; // 120 ms : assez pour être perçu, assez court pour ne pas gêner
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.15, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

  osc.connect(gain).connect(audio.destination);
  osc.start(now);
  osc.stop(now + duration);
}
