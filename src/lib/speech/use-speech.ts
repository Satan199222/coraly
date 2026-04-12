"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { playBeep } from "./beep";

interface UseSpeechOptions {
  /** Multiplicateur appliqué à utterance.rate (ex: 0.75 lent, 0.95 normal, 1.2 rapide) */
  rate?: number;
  /** Locale pour SpeechRecognition + SpeechSynthesis (fr-FR par défaut) */
  lang?: string;
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
  const { rate = 0.95, lang = "fr-FR" } = options;
  const [transcript, setTranscript] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const isListeningRef = useRef(false);

  // Synchroniser ref + state
  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  const isSupported =
    typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  const cancelSpeech = useCallback(() => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  }, []);

  const startListening = useCallback(() => {
    if (!isSupported) return;

    // Couper immédiatement toute synthèse vocale en cours : on ne peut pas
    // écouter l'utilisateur et lui parler en même temps. Le système audio
    // résultant serait inintelligible pour un non-voyant.
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }

    // Reset du transcript précédent : sinon une 2e dictée commencerait avec
    // le texte de la précédente, ce qui fait sauter le textarea visuellement.
    setTranscript("");

    // Bip aigu : signal audio "je t'écoute". Indispensable pour un utilisateur
    // non-voyant qui ne voit pas le bouton changer de couleur.
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
  }, [isSupported, lang]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
    isListeningRef.current = false;
    // Bip grave : signal audio "j'ai arrêté d'écouter".
    playBeep("stop");
  }, []);

  const speak = useCallback(
    (text: string): Promise<void> => {
      return new Promise((resolve) => {
        if (typeof window === "undefined" || !window.speechSynthesis) {
          resolve();
          return;
        }

        // Ne jamais parler par-dessus une dictée active : évite que VoixCourses
        // pollue le micro pendant que l'utilisateur parle.
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
