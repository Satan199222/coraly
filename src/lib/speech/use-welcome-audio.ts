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
 * - autoplay policies (si bloqué, échec silencieux avec console.warn)
 *
 * Délai de 600 ms : laisse le navigateur finir le premier rendu et déclencher
 * une interaction perceptible avant speak(), ce qui améliore la compatibilité
 * autoplay sur Chrome/Edge (ils exigent une "user gesture" récente).
 */
export function useWelcomeAudio({ voiceEnabled, speak }: UseWelcomeAudioOptions) {
  const playedRef = useRef(false);
  // Ref mis à jour à chaque rendu : le callback du timer peut ainsi vérifier
  // la valeur courante de voiceEnabled au moment du déclenchement, même si
  // l'utilisateur a coupé la voix pendant le délai de 600 ms.
  const voiceRef = useRef(voiceEnabled);
  useEffect(() => {
    voiceRef.current = voiceEnabled;
  });

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
      // Re-vérifier au moment du déclenchement : l'utilisateur a peut-être
      // coupé la voix pendant le délai de 600 ms.
      if (!voiceRef.current) return;
      speak(GREETING)
        .then(() => {
          try {
            sessionStorage.setItem(SESSION_KEY, "1");
          } catch (err) {
            console.warn("[welcome] sessionStorage.setItem failed:", err);
          }
        })
        .catch((err) => {
          console.warn("[welcome] autoplay bloqué ou speak échoué:", err);
        });
    }, 600);

    return () => clearTimeout(t);
  }, [voiceEnabled, speak]);
}
