"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/logo";
import { Footer } from "@/components/footer";
import { AccessibilityBar } from "@/components/accessibility-bar";
import { LiveRegion } from "@/components/live-region";
import { HelpDialog } from "@/components/help-dialog";
import { useSpeech } from "@/lib/speech/use-speech";
import { useFocusAnnounce } from "@/lib/speech/use-focus-announce";
import { useKeyboardShortcuts } from "@/lib/speech/use-keyboard-shortcuts";
import {
  usePreferences,
  SPEECH_RATE_VALUE,
} from "@/lib/preferences/use-preferences";
import { useDocumentTitle } from "@/lib/useDocumentTitle";

type Mode = "keyboard" | "vocal" | "conversation";

const MODES: Array<{
  key: Mode;
  icon: string;
  title: string;
  shortcut: string;
  tagline: string;
  description: string;
  href: string;
  cta: string;
  beta?: boolean;
}> = [
  {
    key: "keyboard",
    icon: "⌨️",
    title: "Mode clavier",
    shortcut: "1",
    tagline: "Simple, rapide, hors-ligne.",
    description:
      "Tab, Entrée, lecteur d'écran natif. Fonctionne avec NVDA, JAWS, VoiceOver. Zéro dépendance à internet pour la voix.",
    href: "/courses",
    cta: "Commencer",
  },
  {
    key: "vocal",
    icon: "🔊",
    title: "Mode vocal guidé",
    shortcut: "2",
    tagline: "L'application vous parle.",
    description:
      "Synthèse vocale française intégrée, dictée de la liste, annonces d'étapes. L'app vous accompagne à voix haute.",
    href: "/courses?voice=on",
    cta: "Activer la voix",
  },
  {
    key: "conversation",
    icon: "💬",
    title: "Mode conversation",
    shortcut: "3",
    tagline: "Parlez à l'assistant.",
    description:
      "Dictez votre liste à un assistant vocal qui comprend, pose des questions, et remplit votre panier automatiquement.",
    href: "/courses/conversation",
    cta: "Essayer",
    beta: true,
  },
];

export default function Landing() {
  useDocumentTitle("VoixCourses — Assistant de courses accessible");

  const router = useRouter();
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const { prefs } = usePreferences();
  const hasAutoPresented = useRef(false);

  const { speak, cancelSpeech, isSpeaking } = useSpeech({
    rate: SPEECH_RATE_VALUE[prefs.speechRate],
    lang: prefs.speechLocale,
    premiumVoice: prefs.premiumVoice,
  });

  useFocusAnnounce(voiceEnabled, {
    rate: SPEECH_RATE_VALUE[prefs.speechRate] * 1.1,
    lang: prefs.speechLocale,
  });

  const presentation =
    "Bienvenue sur VoixCourses. Trois modes sont disponibles pour faire vos courses en ligne. " +
    "Appuyez sur 1 pour le mode clavier. " +
    "Appuyez sur 2 pour le mode vocal guidé. " +
    "Appuyez sur 3 pour le mode conversation avec un assistant vocal. " +
    "Appuyez sur la touche point d'interrogation pour afficher l'aide.";

  // Auto-présentation à l'arrivée : seulement si voix activée ET une seule
  // fois par montage (évite répéter si l'utilisateur revient sur la page).
  useEffect(() => {
    if (voiceEnabled && !hasAutoPresented.current) {
      hasAutoPresented.current = true;
      // Petit délai pour laisser la page se charger visuellement
      const t = setTimeout(() => speak(presentation), 400);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceEnabled]);

  function goToMode(mode: Mode) {
    const target = MODES.find((m) => m.key === mode);
    if (!target) return;
    setAnnouncement(`Mode ${target.title} sélectionné. Chargement…`);
    router.push(target.href);
  }

  // Raccourcis 1/2/3 pour accès direct — avantage massif pour utilisateur
  // non-voyant qui ne veut pas tabber jusqu'à la bonne carte.
  useKeyboardShortcuts({
    onHelp: () => setHelpOpen(true),
    onEscape: () => {
      if (helpOpen) setHelpOpen(false);
      else cancelSpeech();
    },
  });

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
      ) {
        return;
      }
      if (e.key === "1") {
        e.preventDefault();
        goToMode("keyboard");
      } else if (e.key === "2") {
        e.preventDefault();
        goToMode("vocal");
      } else if (e.key === "3") {
        e.preventDefault();
        goToMode("conversation");
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [helpOpen]);

  return (
    <>
      <AccessibilityBar
        onVoiceToggle={setVoiceEnabled}
        onHelpRequest={() => setHelpOpen(true)}
      />
      <HelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
      <LiveRegion message={announcement} />

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-16">
        {/* HERO */}
        <header className="pt-6">
          <div className="flex items-center gap-4 mb-8">
            <div
              className="shrink-0 w-16 h-16 rounded-2xl bg-[var(--bg-surface)] border-2 border-[var(--accent)] flex items-center justify-center text-[var(--accent)]"
              style={{ boxShadow: "var(--shadow-md)" }}
            >
              <Logo className="w-10 h-10" />
            </div>
            <div>
              <h1 className="text-4xl font-bold tracking-tight">VoixCourses</h1>
              <p className="text-[var(--text-muted)] text-base">
                Faire ses courses par la voix, accessible à tous.
              </p>
            </div>
          </div>

          <div className="space-y-4 max-w-2xl">
            <h2 className="text-3xl sm:text-4xl font-bold leading-tight">
              Vos courses Carrefour en ligne, même si vous ne voyez pas l&apos;écran.
            </h2>
            <p className="text-lg text-[var(--text-muted)]">
              Dictez ou tapez votre liste, l&apos;intelligence artificielle
              trouve les produits, l&apos;extension remplit votre panier. Sans
              identifiants à partager.
            </p>

            <div className="flex gap-3 flex-wrap items-center pt-3">
              <button
                type="button"
                onClick={() => {
                  if (isSpeaking) {
                    cancelSpeech();
                  } else {
                    speak(presentation);
                  }
                }}
                aria-label={
                  isSpeaking
                    ? "Arrêter la présentation vocale"
                    : "Écouter la présentation vocale"
                }
                aria-pressed={isSpeaking}
                className={`px-6 py-3 rounded-lg font-bold text-lg transition-colors ${
                  isSpeaking
                    ? "bg-[var(--danger)] text-white"
                    : "bg-[var(--bg-surface)] border-2 border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent)] hover:text-[var(--bg)]"
                }`}
              >
                {isSpeaking ? "⏹ Stop" : "▶ Écouter la présentation"}
              </button>
              <Link
                href="/courses"
                className="px-6 py-3 rounded-lg bg-[var(--accent)] text-[var(--bg)] font-bold text-lg hover:bg-[var(--accent-hover)] transition-colors"
                aria-label="Accéder directement à VoixCourses"
              >
                Accéder à VoixCourses →
              </Link>
            </div>
          </div>
        </header>

        {/* 3 MODES */}
        <section aria-label="Choisir un mode d'utilisation">
          <h2 className="text-2xl font-bold mb-2">Choisissez votre mode</h2>
          <p className="text-[var(--text-muted)] mb-6">
            Utilisez le raccourci clavier{" "}
            <kbd className="px-1.5 py-0.5 rounded bg-[var(--bg-surface)] border border-[var(--border)] text-sm">
              1
            </kbd>
            ,{" "}
            <kbd className="px-1.5 py-0.5 rounded bg-[var(--bg-surface)] border border-[var(--border)] text-sm">
              2
            </kbd>{" "}
            ou{" "}
            <kbd className="px-1.5 py-0.5 rounded bg-[var(--bg-surface)] border border-[var(--border)] text-sm">
              3
            </kbd>{" "}
            pour accéder directement au mode correspondant.
          </p>
          <div className="grid md:grid-cols-3 gap-4">
            {MODES.map((m) => (
              <Link
                key={m.key}
                href={m.href}
                aria-label={`${m.title}. ${m.tagline} ${m.description} Raccourci clavier : touche ${m.shortcut}.`}
                className="group block p-5 rounded-xl bg-[var(--bg-surface)] border-2 border-[var(--border)] hover:border-[var(--accent)] transition-colors space-y-3 relative"
              >
                <div className="flex items-start justify-between">
                  <span className="text-4xl" aria-hidden="true">
                    {m.icon}
                  </span>
                  <span
                    className="text-xs font-bold px-2 py-0.5 rounded bg-[var(--bg)] border border-[var(--border)] text-[var(--text-muted)]"
                    aria-hidden="true"
                  >
                    Touche {m.shortcut}
                  </span>
                </div>
                <h3 className="text-xl font-bold">
                  {m.title}
                  {m.beta && (
                    <span className="ml-2 text-xs font-bold px-2 py-0.5 rounded bg-[var(--accent)] text-[var(--bg)]">
                      BETA
                    </span>
                  )}
                </h3>
                <p className="font-semibold text-[var(--accent)]">{m.tagline}</p>
                <p className="text-sm text-[var(--text-muted)]">{m.description}</p>
                <span className="inline-block font-semibold text-[var(--accent)] group-hover:underline">
                  {m.cta} →
                </span>
              </Link>
            ))}
          </div>
        </section>

        {/* POURQUOI */}
        <section aria-label="Pourquoi VoixCourses" className="space-y-4">
          <h2 className="text-2xl font-bold">Pourquoi VoixCourses</h2>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-[var(--bg-surface)] border border-[var(--border)]">
              <div className="text-2xl mb-2" aria-hidden="true">
                ♿
              </div>
              <h3 className="font-bold mb-1">Accessibilité de bout en bout</h3>
              <p className="text-sm text-[var(--text-muted)]">
                Navigation clavier complète, compatible NVDA / JAWS / VoiceOver.
                Conforme WCAG AA+ / RGAA.
              </p>
            </div>
            <div className="p-4 rounded-lg bg-[var(--bg-surface)] border border-[var(--border)]">
              <div className="text-2xl mb-2" aria-hidden="true">
                🔐
              </div>
              <h3 className="font-bold mb-1">Vos identifiants restent chez vous</h3>
              <p className="text-sm text-[var(--text-muted)]">
                L&apos;extension agit dans votre propre session Carrefour. Aucun mot
                de passe ne transite par VoixCourses. Zéro télémétrie.
              </p>
            </div>
            <div className="p-4 rounded-lg bg-[var(--bg-surface)] border border-[var(--border)]">
              <div className="text-2xl mb-2" aria-hidden="true">
                ⚖️
              </div>
              <h3 className="font-bold mb-1">Conforme European Accessibility Act</h3>
              <p className="text-sm text-[var(--text-muted)]">
                Depuis juin 2025, les sites e-commerce doivent être accessibles.
                VoixCourses rend carrefour.fr utilisable pour 1 million de
                non-voyants en France.
              </p>
            </div>
          </div>
        </section>

        {/* COMMENT ÇA MARCHE */}
        <section aria-label="Comment ça marche" className="space-y-4">
          <h2 className="text-2xl font-bold">En trois étapes</h2>
          <ol className="space-y-3">
            <li className="flex gap-4 p-4 rounded-lg bg-[var(--bg-surface)] border border-[var(--border)]">
              <span
                className="shrink-0 w-10 h-10 rounded-full bg-[var(--accent)] text-[var(--bg)] font-bold flex items-center justify-center"
                aria-hidden="true"
              >
                1
              </span>
              <div>
                <h3 className="font-bold">Votre magasin</h3>
                <p className="text-sm text-[var(--text-muted)]">
                  Entrez votre code postal, nous trouvons les Carrefour proches.
                </p>
              </div>
            </li>
            <li className="flex gap-4 p-4 rounded-lg bg-[var(--bg-surface)] border border-[var(--border)]">
              <span
                className="shrink-0 w-10 h-10 rounded-full bg-[var(--accent)] text-[var(--bg)] font-bold flex items-center justify-center"
                aria-hidden="true"
              >
                2
              </span>
              <div>
                <h3 className="font-bold">Votre liste</h3>
                <p className="text-sm text-[var(--text-muted)]">
                  Dictez ou tapez naturellement. L&apos;IA comprend
                  &laquo;&nbsp;2 litres de lait demi-écrémé&nbsp;&raquo; comme
                  un humain.
                </p>
              </div>
            </li>
            <li className="flex gap-4 p-4 rounded-lg bg-[var(--bg-surface)] border border-[var(--border)]">
              <span
                className="shrink-0 w-10 h-10 rounded-full bg-[var(--accent)] text-[var(--bg)] font-bold flex items-center justify-center"
                aria-hidden="true"
              >
                3
              </span>
              <div>
                <h3 className="font-bold">Votre panier, en 1 clic</h3>
                <p className="text-sm text-[var(--text-muted)]">
                  L&apos;extension VoixCourses remplit votre panier Carrefour
                  directement. Il ne reste plus qu&apos;à payer.
                </p>
              </div>
            </li>
          </ol>
        </section>

        {/* CTA FINAL */}
        <section className="p-6 rounded-xl bg-[var(--bg-surface)] border-2 border-[var(--accent)] text-center space-y-4">
          <h2 className="text-2xl font-bold">Prêt à essayer ?</h2>
          <p className="text-[var(--text-muted)] max-w-xl mx-auto">
            Gratuit, sans inscription, sans CB. Vous aurez besoin
            d&apos;installer notre extension navigateur pour finaliser
            l&apos;achat sur carrefour.fr.
          </p>
          <div className="flex gap-3 justify-center flex-wrap">
            <Link
              href="/courses"
              className="px-6 py-3 rounded-lg bg-[var(--accent)] text-[var(--bg)] font-bold hover:bg-[var(--accent-hover)] transition-colors"
            >
              Commencer maintenant
            </Link>
            <Link
              href="/installer"
              className="px-6 py-3 rounded-lg border-2 border-[var(--border)] text-[var(--text)] font-semibold hover:border-[var(--accent)] transition-colors"
            >
              Installer l&apos;extension
            </Link>
          </div>
        </section>
      </div>
      <Footer />
    </>
  );
}
