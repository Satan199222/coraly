"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AccessibilityBar } from "@/components/accessibility-bar";
import { SiteHeader } from "@/components/site-header";
import { HeroSection } from "@/components/hero-section";
import { TrustStrip } from "@/components/trust-strip";
import { ModesShowcase } from "@/components/modes-showcase";
import { ManifestoSection } from "@/components/manifesto-section";
import { WalkthroughDialog } from "@/components/walkthrough-dialog";
import { TestimonySection } from "@/components/testimony-section";
import { FaqAccordion } from "@/components/faq-accordion";
import { FinalCtaSection } from "@/components/final-cta-section";
import { Footer } from "@/components/footer";
import { LiveRegion } from "@/components/live-region";
import { HelpDialog } from "@/components/help-dialog";
import { useSpeech } from "@/lib/speech/use-speech";
import { useWelcomeAudio } from "@/lib/speech/use-welcome-audio";
import { useKeyboardShortcuts } from "@/lib/speech/use-keyboard-shortcuts";
import { usePreferences, SPEECH_RATE_VALUE } from "@/lib/preferences/use-preferences";
import { useDocumentTitle } from "@/lib/useDocumentTitle";

export default function HomePage() {
  useDocumentTitle("VoixCourses — Vos courses par la voix");

  const router = useRouter();
  // Lire la préférence voix depuis localStorage dès le premier rendu pour que
  // useWelcomeAudio ne démarre jamais avec voiceEnabled=true si l'utilisateur
  // avait coupé la voix lors d'une session précédente.
  const [voiceEnabled, setVoiceEnabled] = useState(() => {
    if (typeof window === "undefined") return true;
    try {
      const saved = localStorage.getItem("voixcourses-voice-enabled");
      return saved === null ? true : saved === "true";
    } catch (err) {
      console.warn("[home] localStorage.getItem(voixcourses-voice-enabled) failed:", err);
      return true; // Défaut : voix activée si localStorage inaccessible
    }
  });
  const [helpOpen, setHelpOpen] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const { prefs } = usePreferences();

  const { speak, cancelSpeech } = useSpeech({
    rate: SPEECH_RATE_VALUE[prefs.speechRate],
    lang: prefs.speechLocale,
    premiumVoice: prefs.premiumVoice,
  });

  useWelcomeAudio({ voiceEnabled, speak });

  const playDemo = useCallback(async () => {
    const text =
      "Bonjour, je suis Koraly. Dites-moi ce dont vous avez besoin. " +
      "Par exemple : pommes Golden, lait demi-écrémé, pain complet.";

    // La démo court-circuite useSpeech intentionnellement : on veut toujours
    // ElevenLabs quelle que soit la préférence premiumVoice de l'utilisateur,
    // et on isole le cycle de vie audio (pas d'effet sur isSpeaking ni cancelSpeech).
    if (typeof navigator !== "undefined" && navigator.onLine !== false) {
      try {
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text }),
        });
        if (res.ok) {
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          const audio = new Audio(url);
          const cleanup = () => URL.revokeObjectURL(url);
          audio.onended = cleanup;
          audio.onerror = () => {
            console.warn("[home] playDemo audio.onerror:", audio.error?.code, audio.error?.message);
            cleanup();
            speak(text).catch((err) => console.error("[home] playDemo speak fallback failed:", err));
          };
          try {
            await audio.play();
          } catch (err) {
            console.warn("[home] playDemo autoplay bloqué:", err);
            cleanup();
            speak(text).catch((err2) =>
              console.error("[home] playDemo speak fallback failed:", err2)
            );
          }
          return;
        }
        console.warn("[home] playDemo /api/tts responded", res.status, "— fallback natif");
      } catch (err) {
        console.warn("[home] playDemo ElevenLabs failed, fallback natif:", err);
      }
    }
    speak(text).catch((err) => console.error("[home] playDemo speak failed:", err));
  }, [speak]);

  useKeyboardShortcuts({
    onHelp: () => setHelpOpen(true),
    onEscape: () => {
      if (helpOpen) setHelpOpen(false);
      else cancelSpeech();
    },
  });

  // Raccourcis 1/2/3 — accès direct aux modes sans tabuler sur les cartes.
  // Désactivés quand le dialog d'aide est ouvert.
  useEffect(() => {
    if (typeof window === "undefined") return;
    function handler(e: KeyboardEvent) {
      if (helpOpen) return;
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      const target = e.target as HTMLElement | null;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable
      )
        return;
      if (e.key === "1") {
        e.preventDefault();
        setAnnouncement("Mode Clavier sélectionné. Chargement…");
        router.push("/courses");
      } else if (e.key === "2") {
        e.preventDefault();
        setAnnouncement("Mode Vocal guidé sélectionné. Chargement…");
        router.push("/courses?voice=on");
      } else if (e.key === "3") {
        e.preventDefault();
        setAnnouncement("Mode Conversation sélectionné. Chargement…");
        router.push("/courses/conversation");
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [helpOpen, router]);

  return (
    <>
      <LiveRegion message={announcement} />
      <AccessibilityBar
        onVoiceToggle={setVoiceEnabled}
        onHelpRequest={() => setHelpOpen(true)}
      />
      <SiteHeader />
      <main id="main" tabIndex={-1}>
        <HeroSection onListenDemo={playDemo} />
        <TrustStrip />
        <ModesShowcase />
        <ManifestoSection />
        <WalkthroughDialog />
        <TestimonySection />
        <FaqAccordion />
        <FinalCtaSection onListenDemo={playDemo} />
      </main>
      <Footer />
      <HelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
    </>
  );
}
