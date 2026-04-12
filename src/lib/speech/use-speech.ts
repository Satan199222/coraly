"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { playBeep } from "./beep";

interface UseSpeechOptions {
  /** Multiplicateur appliqué au TTS natif (speechSynthesis). */
  rate?: number;
  /** Locale pour SpeechRecognition + SpeechSynthesis. */
  lang?: string;
  /** Si true, utilise ElevenLabs TTS en priorité, fallback natif si échec.
   *  Défaut : false (natif uniquement). */
  premiumVoice?: boolean;
}

interface UseSpeechReturn {
  transcript: string;
  isListening: boolean;
  startListening: () => void;
  stopListening: () => void;
  speak: (text: string) => Promise<void>;
  cancelSpeech: () => void;
  isSpeaking: boolean;
  isSupported: boolean;
}

export function useSpeech(options: UseSpeechOptions = {}): UseSpeechReturn {
  const { rate = 0.95, lang = "fr-FR", premiumVoice = false } = options;
  const [transcript, setTranscript] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const isListeningRef = useRef(false);
  // Audio HTMLElement en cours de lecture (ElevenLabs). Conservé pour pouvoir
  // le stopper proprement dans cancelSpeech().
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentObjectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  const isSupported =
    typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  // Stop global : coupe audio HTML5 ElevenLabs ET speechSynthesis natif.
  const cancelSpeech = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
    if (currentObjectUrlRef.current) {
      URL.revokeObjectURL(currentObjectUrlRef.current);
      currentObjectUrlRef.current = null;
    }
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  }, []);

  const startListening = useCallback(() => {
    if (!isSupported) return;

    // Toute synthèse en cours doit être interrompue (micro + TTS simultanés
    // = cacophonie pour un utilisateur non-voyant).
    cancelSpeech();

    setTranscript("");
    playBeep("start");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognitionCtor =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognitionCtor();
    recognition.lang = lang;
    recognition.continuous = true;
    recognition.interimResults = false;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const results = Array.from(event.results) as any[];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const text = results.map((r: any) => r[0].transcript).join(" ");
      setTranscript(text);
    };

    recognition.onend = () => {
      setIsListening(false);
      isListeningRef.current = false;
    };
    recognition.onerror = () => {
      setIsListening(false);
      isListeningRef.current = false;
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
    isListeningRef.current = true;
  }, [isSupported, lang, cancelSpeech]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
    isListeningRef.current = false;
    playBeep("stop");
  }, []);

  /**
   * Fallback synthèse native (speechSynthesis). Rapide (0 ms réseau) mais
   * voix souvent robotique sur Linux/Android.
   */
  const speakNative = useCallback(
    (text: string): Promise<void> => {
      return new Promise((resolve) => {
        if (typeof window === "undefined" || !window.speechSynthesis) {
          resolve();
          return;
        }
        if (isListeningRef.current) {
          resolve();
          return;
        }
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = lang;
        utterance.rate = rate;
        utterance.onstart = () => setIsSpeaking(true);
        utterance.onend = () => {
          setIsSpeaking(false);
          resolve();
        };
        utterance.onerror = () => {
          setIsSpeaking(false);
          resolve();
        };
        window.speechSynthesis.speak(utterance);
      });
    },
    [lang, rate]
  );

  /**
   * Synthèse premium ElevenLabs. Fetch /api/tts, récupère le blob audio,
   * le joue via Audio(). Fallback sur speakNative en cas d'échec (quota
   * épuisé, offline, 5xx serveur, etc.).
   */
  const speakPremium = useCallback(
    async (text: string): Promise<void> => {
      if (isListeningRef.current) return;
      // Pas de TTS premium si offline — inutile d'attendre un timeout.
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        return speakNative(text);
      }

      try {
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text }),
        });
        if (!res.ok) {
          // Quota / erreur serveur → fallback
          return speakNative(text);
        }
        const blob = await res.blob();
        if (isListeningRef.current) return; // l'user a démarré le micro entre-temps

        const url = URL.createObjectURL(blob);
        currentObjectUrlRef.current = url;

        const audio = new Audio(url);
        audioRef.current = audio;

        return new Promise<void>((resolve) => {
          audio.onplay = () => setIsSpeaking(true);
          audio.onended = () => {
            setIsSpeaking(false);
            URL.revokeObjectURL(url);
            if (currentObjectUrlRef.current === url) {
              currentObjectUrlRef.current = null;
            }
            if (audioRef.current === audio) audioRef.current = null;
            resolve();
          };
          audio.onerror = () => {
            setIsSpeaking(false);
            URL.revokeObjectURL(url);
            if (currentObjectUrlRef.current === url) {
              currentObjectUrlRef.current = null;
            }
            if (audioRef.current === audio) audioRef.current = null;
            // Fallback natif si la lecture échoue (format non supporté, etc.)
            speakNative(text).then(resolve);
          };
          audio.play().catch(() => {
            // Autoplay policy : si aucune interaction user récente, play()
            // rejette. On tombe sur le fallback qui marchera au prochain speak.
            setIsSpeaking(false);
            URL.revokeObjectURL(url);
            speakNative(text).then(resolve);
          });
        });
      } catch {
        return speakNative(text);
      }
    },
    [speakNative]
  );

  const speak = useCallback(
    (text: string): Promise<void> => {
      return premiumVoice ? speakPremium(text) : speakNative(text);
    },
    [premiumVoice, speakPremium, speakNative]
  );

  return {
    transcript,
    isListening,
    isSpeaking,
    startListening,
    stopListening,
    speak,
    cancelSpeech,
    isSupported,
  };
}
