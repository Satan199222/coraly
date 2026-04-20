"use client";

/**
 * useKoralyChat — hook partagé pour les 4 pages conversationnelles Coraly.
 *
 * Gère :
 *  - État de la conversation (messages, inputText, busy)
 *  - Intégration useSpeech + usePreferences
 *  - Effet scroll automatique vers le bas
 *  - Effet injection du transcript dans l'input
 *  - Effet auto-soumission à la fin de la reconnaissance vocale
 *  - Calcul de l'orbStatus KoralyOrb
 *
 * Chaque page fournit un `onQuery` callback qui contient sa logique métier.
 *
 * GROA-496
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useSpeech } from "@/lib/shared/speech/use-speech";
import { usePreferences, SPEECH_RATE_VALUE } from "@/lib/preferences/use-preferences";
import type { KoralyOrbStatus } from "@/lib/shared/components/koraly-orb";

// ---------------------------------------------------------------------------
// Types exportés
// ---------------------------------------------------------------------------

export interface KoralyChatMsg {
  id: string;
  role: "user" | "koraly";
  text: string;
  loading?: boolean;
}

export interface UseKoralyChatOptions {
  /** Message affiché en premier dans la conversation au chargement. */
  welcomeMessage: string;
  /**
   * Callback métier : prend la requête texte et retourne la réponse Koraly.
   * Toute erreur levée est rattrapée et transformée en message d'erreur.
   */
  onQuery: (query: string) => Promise<string>;
  /** Namespace de log (ex: "[transport]", "[sante]"). */
  logNamespace: string;
}

export interface UseKoralyChatReturn {
  // Parole
  speak: (text: string) => Promise<void>;
  cancelSpeech: () => void;
  startListening: () => void;
  stopListening: () => void;
  isListening: boolean;
  isSpeaking: boolean;
  isSupported: boolean;
  transcript: string;
  orbStatus: KoralyOrbStatus;

  // État conversation
  messages: KoralyChatMsg[];
  inputText: string;
  setInputText: (v: string) => void;
  busy: boolean;
  announcement: string;

  // Refs
  chatEndRef: React.RefObject<HTMLDivElement | null>;
  inputRef: React.RefObject<HTMLInputElement | null>;

  // Actions
  submitQuery: (query: string) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useKoralyChat({
  welcomeMessage,
  onQuery,
  logNamespace,
}: UseKoralyChatOptions): UseKoralyChatReturn {
  const { prefs } = usePreferences();
  const {
    speak,
    cancelSpeech,
    startListening,
    stopListening,
    transcript,
    isListening,
    isSpeaking,
    isSupported,
  } = useSpeech({
    rate: SPEECH_RATE_VALUE[prefs.speechRate],
    lang: prefs.speechLocale,
    premiumVoice: prefs.premiumVoice,
  });

  const [announcement, setAnnouncement] = useState("");
  const [inputText, setInputText] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<KoralyChatMsg[]>([
    { id: "welcome", role: "koraly", text: welcomeMessage },
  ]);

  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const prevTranscriptRef = useRef("");

  // Scroll automatique en bas du fil
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Injection du transcript dans l'input
  useEffect(() => {
    if (transcript && transcript !== prevTranscriptRef.current) {
      prevTranscriptRef.current = transcript;
      setInputText(transcript);
    }
  }, [transcript]);

  // Auto-soumission quand la reconnaissance s'arrête avec un transcript valide
   
  useEffect(() => {
    if (!isListening && inputText.trim() && inputText === transcript) {
      submitQuery(inputText);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isListening]);

  const orbStatus: KoralyOrbStatus = isListening
    ? "listening"
    : isSpeaking
    ? "speaking"
    : "idle";

  // ---------------------------------------------------------------------------
  // submitQuery — point d'entrée principal
  // ---------------------------------------------------------------------------

  const submitQuery = useCallback(
    async (query: string) => {
      const q = query.trim();
      if (!q || busy) return;

      const userMsgId = crypto.randomUUID();
      const koralyMsgId = crypto.randomUUID();

      setMessages((prev) => [
        ...prev,
        { id: userMsgId, role: "user", text: q },
        { id: koralyMsgId, role: "koraly", text: "", loading: true },
      ]);
      setInputText("");
      prevTranscriptRef.current = "";
      setBusy(true);
      setAnnouncement("Koraly réfléchit…");
      cancelSpeech();

      try {
        const answer = await onQuery(q);

        setMessages((prev) =>
          prev.map((m) =>
            m.id === koralyMsgId ? { ...m, text: answer, loading: false } : m
          )
        );
        setAnnouncement(answer);

        speak(answer).catch((err) =>
          console.warn(`${logNamespace} speak failed:`, err)
        );
      } catch (err) {
        console.error(`${logNamespace} onQuery failed:`, err);
        const errText =
          "Une erreur s'est produite lors de la recherche. Veuillez réessayer.";
        setMessages((prev) =>
          prev.map((m) =>
            m.id === koralyMsgId ? { ...m, text: errText, loading: false } : m
          )
        );
        setAnnouncement(errText);
      } finally {
        setBusy(false);
        setTimeout(() => inputRef.current?.focus(), 100);
      }
    },
     
    [busy, onQuery, speak, cancelSpeech, logNamespace]
  );

  return {
    speak,
    cancelSpeech,
    startListening,
    stopListening,
    isListening,
    isSpeaking,
    isSupported,
    transcript,
    orbStatus,
    messages,
    inputText,
    setInputText,
    busy,
    announcement,
    chatEndRef,
    inputRef,
    submitQuery,
  };
}
