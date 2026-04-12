"use client";

import { useEffect, useRef } from "react";

const GREETING = "Bonjour, je suis Koraly.";
const SESSION_KEY = "voixcourses-welcome-played";

interface UseWelcomeAudioOptions {
  /** Si false (voix coupée), ne rien faire. */
  voiceEnabled: boolean;
  /** Fonction speak du hook useSpeech (TTS premium + fallback). */
  speak: (text: string) => Promise<void>;
}

/**
 * Joue l'accueil vocal "Bonjour, je suis Koraly." au premier chargement de
 * la home dans une session donnée. Respecte :
 * - le toggle voix global (voiceEnabled)
 * - sessionStorage pour ne pas rejouer après navigation retour
 * - autoplay policies (si bloqué, échec silencieux)
 */
export function useWelcomeAudio({ voiceEnabled, speak }: UseWelcomeAudioOptions) {
  const playedRef = useRef(false);

  useEffect(() => {
    if (playedRef.current) return;
    if (!voiceEnabled) return;
    if (typeof window === "undefined") return;

    try {
      if (sessionStorage.getItem(SESSION_KEY) === "1") {
        playedRef.current = true;
        return;
      }
    } catch { /* noop */ }

    playedRef.current = true;

    const t = setTimeout(() => {
      speak(GREETING)
        .then(() => {
          try { sessionStorage.setItem(SESSION_KEY, "1"); } catch { /* noop */ }
        })
        .catch(() => { /* autoplay bloqué, pas grave */ });
    }, 600);

    return () => clearTimeout(t);
  }, [voiceEnabled, speak]);
}
