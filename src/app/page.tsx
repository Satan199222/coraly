"use client";

import { useCallback, useEffect, useState } from "react";
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

  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [helpOpen, setHelpOpen] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const { prefs } = usePreferences();

  const { speak, cancelSpeech } = useSpeech({
    rate: SPEECH_RATE_VALUE[prefs.speechRate],
    lang: prefs.speechLocale,
    premiumVoice: prefs.premiumVoice,
  });

  useWelcomeAudio({ voiceEnabled, speak });

  const playDemo = useCallback(() => {
    speak(
      "Bonjour, je suis Koraly. Dites-moi ce dont vous avez besoin. " +
        "Par exemple : pommes Golden, lait demi-écrémé, pain complet."
    ).catch(() => {});
  }, [speak]);

  useKeyboardShortcuts({
    onHelp: () => setHelpOpen(true),
    onEscape: () => {
      if (helpOpen) setHelpOpen(false);
      else cancelSpeech();
    },
  });

  // Raccourcis 1/2/3 — accès direct aux modes sans tabuler sur les cartes.
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
        window.location.href = "/courses";
      } else if (e.key === "2") {
        e.preventDefault();
        setAnnouncement("Mode Vocal guidé sélectionné. Chargement…");
        window.location.href = "/courses?voice=on";
      } else if (e.key === "3") {
        e.preventDefault();
        setAnnouncement("Mode Conversation sélectionné. Chargement…");
        window.location.href = "/courses/conversation";
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [helpOpen]);

  return (
    <>
      <LiveRegion message={announcement} />
      <AccessibilityBar
        onVoiceToggle={setVoiceEnabled}
        onHelpRequest={() => setHelpOpen(true)}
      />
      <SiteHeader />
      <HeroSection onListenDemo={playDemo} />
      <TrustStrip />
      <ModesShowcase />
      <ManifestoSection />
      <WalkthroughDialog />
      <TestimonySection />
      <FaqAccordion />
      <FinalCtaSection onListenDemo={playDemo} />
      <Footer />
      <HelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
    </>
  );
}
