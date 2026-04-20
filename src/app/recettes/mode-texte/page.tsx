"use client";

/**
 * VoixRecettes — Page /recettes
 * Interface vocale Koraly pour la recherche et lecture de recettes.
 *
 * Fonctionnalités :
 * - Recherche vocale : "ratatouille", "tarte tatin", "coq au vin"
 * - Résultats sous forme de cartes cliquables
 * - Mode détail : liste d'ingrédients + lecture étape par étape
 * - Koraly lit chaque étape à la demande (touche N/P ou bouton)
 * - WCAG AAA, police Luciole, design system marine
 *
 * Sources API (GROA-253) :
 *   - Spoonacular (si SPOONACULAR_API_KEY configuré)
 *   - TheMealDB free tier (fallback sans clé)
 *
 * GROA-254 — Phase 5b VoixRecettes
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { KoralyPageShell } from "@/lib/shared/components/koraly-page-shell";
import { KoralyMsgBubble } from "@/lib/shared/components/koraly-msg-bubble";
import { KoralyOrb } from "@/lib/shared/components/koraly-orb";
import type { KoralyOrbStatus } from "@/lib/shared/components/koraly-orb";
import { useSpeech } from "@/lib/shared/speech/use-speech";
import { usePreferences, SPEECH_RATE_VALUE } from "@/lib/preferences/use-preferences";
import { useDocumentTitle } from "@/lib/useDocumentTitle";
import type { Recipe, RecipeSummary } from "@/lib/recettes/types";

// ---------------------------------------------------------------------------
// Vue en cours
// ---------------------------------------------------------------------------
type View = "search" | "detail";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

interface ChatMsg {
  id: string;
  role: "user" | "koraly";
  text: string;
  loading?: boolean;
  results?: RecipeSummary[];
}

// ---------------------------------------------------------------------------
// Composant carte recette (liste de résultats)
// ---------------------------------------------------------------------------

interface RecipeCardProps {
  recipe: RecipeSummary;
  onSelect: (id: string) => void;
  disabled?: boolean;
}

function RecipeCard({ recipe, onSelect, disabled }: RecipeCardProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(recipe.id)}
      disabled={disabled}
      aria-label={`Voir la recette : ${recipe.title}`}
      className="w-full text-left rounded-2xl overflow-hidden transition-opacity disabled:opacity-40"
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border-hi)",
      }}
    >
      <div className="flex gap-3 items-center p-3">
        {recipe.imageUrl && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={recipe.imageUrl}
            alt={recipe.title}
            width={56}
            height={56}
            className="rounded-xl object-cover flex-shrink-0"
          />
        )}
        <div className="flex-1 min-w-0">
          <p
            className="font-semibold text-sm leading-tight truncate"
            style={{ color: "var(--text)" }}
          >
            {recipe.title}
          </p>
          <div className="flex flex-wrap gap-1 mt-1">
            {recipe.area && (
              <span
                className="text-xs px-2 py-0.5 rounded-full"
                style={{
                  background: "color-mix(in srgb, var(--accent) 12%, transparent)",
                  color: "var(--accent)",
                  border: "1px solid color-mix(in srgb, var(--accent) 30%, transparent)",
                }}
              >
                {recipe.area}
              </span>
            )}
            {recipe.category && (
              <span
                className="text-xs px-2 py-0.5 rounded-full"
                style={{
                  background: "var(--bg-card)",
                  color: "var(--text-soft)",
                  border: "1px solid var(--border)",
                }}
              >
                {recipe.category}
              </span>
            )}
            {recipe.readyInMinutes && (
              <span
                className="text-xs px-2 py-0.5 rounded-full"
                style={{
                  background: "var(--bg-card)",
                  color: "var(--text-soft)",
                  border: "1px solid var(--border)",
                }}
              >
                {recipe.readyInMinutes} min
              </span>
            )}
          </div>
        </div>
        <span aria-hidden style={{ color: "var(--text-muted)", flexShrink: 0 }}>
          ›
        </span>
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Composant vue détail recette
// ---------------------------------------------------------------------------

interface RecipeDetailViewProps {
  recipe: Recipe;
  currentStep: number;
  isSpeaking: boolean;
  onPrevStep: () => void;
  onNextStep: () => void;
  onReadStep: (stepIndex: number) => void;
  onBack: () => void;
}

function RecipeDetailView({
  recipe,
  currentStep,
  isSpeaking,
  onPrevStep,
  onNextStep,
  onReadStep,
  onBack,
}: RecipeDetailViewProps) {
  const stepRef = useRef<HTMLLIElement>(null);

  useEffect(() => {
    stepRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [currentStep]);

  return (
    <div className="flex flex-col gap-6">
      {/* Titre + retour */}
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="Retour aux résultats"
          className="rounded-xl p-2 flex-shrink-0 transition-opacity"
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border-hi)",
            color: "var(--text-soft)",
          }}
        >
          ←
        </button>
        <div className="flex-1 min-w-0">
          <h2
            className="font-bold text-lg leading-tight"
            style={{ color: "var(--text)" }}
          >
            {recipe.title}
          </h2>
          <div className="flex flex-wrap gap-1 mt-1">
            {recipe.area && (
              <span
                className="text-xs px-2 py-0.5 rounded-full"
                style={{
                  background: "color-mix(in srgb, var(--accent) 12%, transparent)",
                  color: "var(--accent)",
                  border: "1px solid color-mix(in srgb, var(--accent) 30%, transparent)",
                }}
              >
                {recipe.area}
              </span>
            )}
            {recipe.readyInMinutes && (
              <span
                className="text-xs px-2 py-0.5 rounded-full"
                style={{
                  background: "var(--bg-card)",
                  color: "var(--text-soft)",
                  border: "1px solid var(--border)",
                }}
              >
                {recipe.readyInMinutes} min
              </span>
            )}
          </div>
        </div>
        {recipe.imageUrl && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={recipe.imageUrl}
            alt={recipe.title}
            width={72}
            height={72}
            className="rounded-2xl object-cover flex-shrink-0"
          />
        )}
      </div>

      {/* Ingrédients */}
      {recipe.ingredients.length > 0 && (
        <section aria-label="Ingrédients" role="region">
          <h3
            className="font-semibold text-sm mb-2"
            style={{ color: "var(--text-soft)" }}
          >
            Ingrédients
          </h3>
          <ul className="grid grid-cols-2 gap-1" role="list">
            {recipe.ingredients.map((ing, i) => (
              <li
                key={i}
                className="text-sm flex gap-1"
                style={{ color: "var(--text)" }}
              >
                <span style={{ color: "var(--brass)", flexShrink: 0 }}>•</span>
                <span>
                  {ing.amount && (
                    <span
                      className="font-medium"
                      style={{ color: "var(--accent)" }}
                    >
                      {ing.amount}{" "}
                    </span>
                  )}
                  {ing.name}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Étapes */}
      {recipe.steps.length > 0 && (
        <section aria-label="Étapes de la recette" role="region">
          <div className="flex items-center justify-between mb-2">
            <h3
              className="font-semibold text-sm"
              style={{ color: "var(--text-soft)" }}
            >
              Étapes ({currentStep + 1} / {recipe.steps.length})
            </h3>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onPrevStep}
                disabled={currentStep === 0}
                aria-label="Étape précédente (P)"
                className="rounded-lg px-3 py-1 text-sm disabled:opacity-40 transition-opacity"
                style={{
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border-hi)",
                  color: "var(--text-soft)",
                }}
              >
                ← Préc.
              </button>
              <button
                type="button"
                onClick={onNextStep}
                disabled={currentStep >= recipe.steps.length - 1}
                aria-label="Étape suivante (N)"
                className="rounded-lg px-3 py-1 text-sm disabled:opacity-40 transition-opacity"
                style={{
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border-hi)",
                  color: "var(--text-soft)",
                }}
              >
                Suiv. →
              </button>
            </div>
          </div>
          <ol className="space-y-2" role="list">
            {recipe.steps.map((step, i) => {
              const isActive = i === currentStep;
              return (
                <li
                  key={step.number}
                  ref={isActive ? stepRef : undefined}
                  aria-current={isActive ? "step" : undefined}
                  className="rounded-xl p-3 cursor-pointer transition-all"
                  style={{
                    background: isActive
                      ? "color-mix(in srgb, var(--accent) 10%, var(--bg-surface))"
                      : "var(--bg-surface)",
                    border: isActive
                      ? "1px solid var(--accent)"
                      : "1px solid var(--border)",
                    outline: isActive ? "2px solid var(--accent)" : "none",
                    outlineOffset: "2px",
                  }}
                  onClick={() => onReadStep(i)}
                >
                  <div className="flex gap-2 items-start">
                    <span
                      className="text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{
                        background: isActive ? "var(--accent)" : "var(--bg-card)",
                        color: isActive ? "#fff" : "var(--text-muted)",
                        border: "1px solid var(--border)",
                      }}
                      aria-hidden
                    >
                      {step.number}
                    </span>
                    <p
                      className="text-sm leading-relaxed flex-1"
                      style={{
                        color: isActive ? "var(--text)" : "var(--text-soft)",
                        fontWeight: isActive ? 500 : 400,
                      }}
                    >
                      {step.text}
                    </p>
                    {isActive && (
                      <span
                        aria-label={isSpeaking ? "Koraly lit cette étape" : "Cliquer pour lire"}
                        className="flex-shrink-0 text-base"
                        style={{ opacity: 0.7 }}
                      >
                        {isSpeaking ? "🔊" : "▶"}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {/* Source */}
      {recipe.sourceUrl && (
        <a
          href={recipe.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs underline"
          style={{ color: "var(--accent)" }}
        >
          Voir la recette originale ↗
        </a>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Composant bulle de message
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Page principale
// ---------------------------------------------------------------------------

export default function RecettesPage() {
  useDocumentTitle("VoixRecettes — Recettes par la voix");

  const router = useRouter();
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

  const [helpOpen, setHelpOpen] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [inputText, setInputText] = useState("");
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<View>("search");
  const [currentRecipe, setCurrentRecipe] = useState<Recipe | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      id: "welcome",
      role: "koraly",
      text: "Bonjour ! Je suis Koraly. Quelle recette souhaitez-vous cuisiner ? Dites par exemple : \"ratatouille\", \"tarte tatin\", ou \"coq au vin\".",
    },
  ]);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const prevTranscriptRef = useRef("");

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (transcript && transcript !== prevTranscriptRef.current) {
      prevTranscriptRef.current = transcript;
      setInputText(transcript);
    }
  }, [transcript]);

  useEffect(() => {
    if (!isListening && inputText.trim() && inputText === transcript) {
      handleSearch(inputText);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isListening]);

  const orbStatus: KoralyOrbStatus = isListening
    ? "listening"
    : isSpeaking
    ? "speaking"
    : "idle";

  const announce = useCallback(
    async (text: string) => {
      setAnnouncement(text);
      cancelSpeech();
      await speak(text).catch((err: unknown) => {
        console.warn("[recettes] speak failed:", err);
      });
    },
    [speak, cancelSpeech]
  );

  const addMsg = useCallback((msg: ChatMsg) => {
    setMessages((prev) => {
      const withoutLoading = prev.filter((m) => !m.loading);
      return [...withoutLoading, msg];
    });
  }, []);

  // ---------------------------------------------------------------------------
  // Recherche de recettes
  // ---------------------------------------------------------------------------

  const handleSearch = useCallback(
    async (query: string) => {
      const q = query.trim();
      if (!q || busy) return;

      setInputText("");
      prevTranscriptRef.current = "";

      addMsg({ id: uid(), role: "user", text: q });
      const loadingId = uid();
      setMessages((prev) => [
        ...prev,
        { id: loadingId, role: "koraly", text: "", loading: true },
      ]);

      setBusy(true);
      cancelSpeech();

      try {
        const res = await fetch(`/api/recettes/search?q=${encodeURIComponent(q)}`);

        if (!res.ok) {
          const data = (await res.json()) as { error?: string };
          const errText =
            data.error ?? "Recherche impossible. Réessayez dans un instant.";
          setMessages((prev) => prev.filter((m) => m.id !== loadingId));
          addMsg({ id: uid(), role: "koraly", text: errText });
          await announce(errText);
          return;
        }

        const { results } = (await res.json()) as { results: RecipeSummary[] };

        setMessages((prev) => prev.filter((m) => m.id !== loadingId));

        if (!results || results.length === 0) {
          const txt = "Je n'ai pas trouvé de recette pour cette recherche. Essayez un autre terme comme \"ratatouille\" ou \"tarte tatin\".";
          addMsg({ id: uid(), role: "koraly", text: txt });
          await announce(txt);
        } else {
          const count = results.length;
          const txt = `J'ai trouvé ${count} recette${count > 1 ? "s" : ""} pour "${q}". Cliquez sur une recette pour voir les étapes.`;
          addMsg({
            id: uid(),
            role: "koraly",
            text: txt,
            results,
          });
          await announce(txt);
        }
      } catch (err) {
        console.error("[recettes] search error:", err);
        setMessages((prev) => prev.filter((m) => m.id !== loadingId));
        const errText = "Une erreur est survenue. Vérifiez votre connexion et réessayez.";
        addMsg({ id: uid(), role: "koraly", text: errText });
        await announce(errText);
      } finally {
        setBusy(false);
      }
    },
    [busy, addMsg, announce, cancelSpeech]
  );

  // ---------------------------------------------------------------------------
  // Chargement du détail d'une recette
  // ---------------------------------------------------------------------------

  const handleSelectRecipe = useCallback(
    async (id: string) => {
      if (busy) return;
      setBusy(true);
      cancelSpeech();

      const loadingText = "Chargement de la recette…";
      setAnnouncement(loadingText);

      try {
        const res = await fetch(`/api/recettes/${encodeURIComponent(id)}`);
        if (!res.ok) {
          const data = (await res.json()) as { error?: string };
          const errText = data.error ?? "Recette introuvable.";
          await announce(errText);
          return;
        }

        const { recipe } = (await res.json()) as {
          recipe: Recipe;
        };

        setCurrentRecipe(recipe);
        setCurrentStep(0);
        setView("detail");

        const intro = recipe.steps.length > 0
          ? `Recette : ${recipe.title}. ${recipe.ingredients.length} ingrédient${recipe.ingredients.length > 1 ? "s" : ""}, ${recipe.steps.length} étape${recipe.steps.length > 1 ? "s" : ""}. Étape 1 : ${recipe.steps[0].text}`
          : `Recette : ${recipe.title}. ${recipe.ingredients.length} ingrédient${recipe.ingredients.length > 1 ? "s" : ""}.`;
        await announce(intro);
      } catch (err) {
        console.error("[recettes] detail error:", err);
        await announce("Une erreur est survenue lors du chargement de la recette.");
      } finally {
        setBusy(false);
      }
    },
    [busy, announce, cancelSpeech]
  );

  // ---------------------------------------------------------------------------
  // Navigation étapes
  // ---------------------------------------------------------------------------

  const handleReadStep = useCallback(
    async (stepIndex: number) => {
      if (!currentRecipe) return;
      setCurrentStep(stepIndex);
      const step = currentRecipe.steps[stepIndex];
      const total = currentRecipe.steps.length;
      await announce(`Étape ${step.number} sur ${total} : ${step.text}`);
    },
    [currentRecipe, announce]
  );

  const handleNextStep = useCallback(async () => {
    if (!currentRecipe) return;
    const next = Math.min(currentStep + 1, currentRecipe.steps.length - 1);
    await handleReadStep(next);
  }, [currentRecipe, currentStep, handleReadStep]);

  const handlePrevStep = useCallback(async () => {
    const prev = Math.max(currentStep - 1, 0);
    await handleReadStep(prev);
  }, [currentStep, handleReadStep]);

  const handleBackToSearch = useCallback(() => {
    cancelSpeech();
    setView("search");
    setCurrentRecipe(null);
    setCurrentStep(0);
  }, [cancelSpeech]);

  // ---------------------------------------------------------------------------
  // Raccourcis clavier
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      if (e.key === "v" || e.key === "V") {
        e.preventDefault();
        if (isListening) {
          stopListening();
        } else {
          cancelSpeech();
          startListening();
        }
      }

      if (view === "detail") {
        if (e.key === "n" || e.key === "N") {
          e.preventDefault();
          handleNextStep();
        }
        if (e.key === "p" || e.key === "P") {
          e.preventDefault();
          handlePrevStep();
        }
        if (e.key === "Backspace" && e.altKey) {
          handleBackToSearch();
          return;
        }
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleReadStep(currentStep);
        }
      }

      if (e.key === "Escape") {
        cancelSpeech();
        stopListening();
      }
      if (e.key === "?" || (e.key === "h" && !e.ctrlKey && !e.metaKey)) {
        setHelpOpen(true);
      }
      if (e.key === "Backspace" && e.altKey) {
        router.push("/");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [
    isListening,
    view,
    currentStep,
    startListening,
    stopListening,
    cancelSpeech,
    handleNextStep,
    handlePrevStep,
    handleReadStep,
    handleBackToSearch,
    router,
  ]);

  // ---------------------------------------------------------------------------
  // Rendu
  // ---------------------------------------------------------------------------

  return (
    <KoralyPageShell
      service="recettes"
      announcement={announcement}
      helpOpen={helpOpen}
      onHelpClose={() => setHelpOpen(false)}
      mainStyle={{ minHeight: "100dvh" }}
    >
        <h1 className="sr-only">VoixRecettes — Recherche de recettes par la voix</h1>

        <div
          className="mx-auto max-w-2xl px-4 py-8 flex flex-col"
          style={{ minHeight: "calc(100dvh - 120px)" }}
        >
          {/* En-tête */}
          <div className="mb-6 text-center">
            <p className="vc-eyebrow mb-1">VoixRecettes</p>
            <p className="text-sm" style={{ color: "var(--text-soft)" }}>
              {view === "detail" && currentRecipe
                ? currentRecipe.title
                : "Recherchez et cuisinez par la voix"}
            </p>
          </div>

          {/* Orbe Koraly + bouton micro */}
          <div className="flex flex-col items-center gap-3 mb-6">
            <KoralyOrb status={orbStatus} />
            {view === "search" && (
              <button
                type="button"
                onClick={() => {
                  if (isListening) {
                    stopListening();
                  } else {
                    cancelSpeech();
                    startListening();
                  }
                }}
                disabled={!isSupported}
                aria-label={
                  isListening
                    ? "Arrêter l'écoute"
                    : isSpeaking
                    ? "Koraly parle…"
                    : "Démarrer la recherche vocale (V)"
                }
                className="rounded-xl px-5 py-2 text-sm font-medium transition-opacity disabled:opacity-40"
                style={{
                  background: isListening
                    ? "color-mix(in srgb, var(--danger) 15%, transparent)"
                    : "var(--bg-surface)",
                  border: `1px solid ${isListening ? "var(--danger)" : "var(--border-hi)"}`,
                  color: isListening ? "var(--danger)" : "var(--text-soft)",
                }}
              >
                {isListening ? "🎙 Arrêter" : "🎙 Parler (V)"}
              </button>
            )}
            {view === "detail" && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handlePrevStep}
                  disabled={currentStep === 0 || busy}
                  aria-label="Étape précédente (P)"
                  className="rounded-xl px-4 py-2 text-sm font-medium transition-opacity disabled:opacity-40"
                  style={{
                    background: "var(--bg-surface)",
                    border: "1px solid var(--border-hi)",
                    color: "var(--text-soft)",
                  }}
                >
                  ← (P)
                </button>
                <button
                  type="button"
                  onClick={() => handleReadStep(currentStep)}
                  disabled={busy}
                  aria-label="Lire l'étape actuelle (Entrée)"
                  className="rounded-xl px-4 py-2 text-sm font-medium transition-opacity disabled:opacity-40"
                  style={{
                    background: "var(--accent)",
                    color: "#fff",
                  }}
                >
                  {isSpeaking ? "🔊 Lecture…" : "▶ Lire"}
                </button>
                <button
                  type="button"
                  onClick={handleNextStep}
                  disabled={
                    !currentRecipe ||
                    currentStep >= (currentRecipe.steps.length - 1) ||
                    busy
                  }
                  aria-label="Étape suivante (N)"
                  className="rounded-xl px-4 py-2 text-sm font-medium transition-opacity disabled:opacity-40"
                  style={{
                    background: "var(--bg-surface)",
                    border: "1px solid var(--border-hi)",
                    color: "var(--text-soft)",
                  }}
                >
                  (N) →
                </button>
              </div>
            )}
          </div>

          {!isSupported && view === "search" && (
            <p
              role="alert"
              className="text-sm text-center mb-4 px-4 py-2 rounded-lg"
              style={{
                background: "color-mix(in srgb, var(--danger) 10%, transparent)",
                color: "var(--danger)",
                border: "1px solid var(--danger)",
              }}
            >
              La reconnaissance vocale n&apos;est pas disponible dans ce navigateur.
              Utilisez le champ texte ci-dessous.
            </p>
          )}

          {/* Contenu principal */}
          {view === "search" ? (
            <>
              {/* Fil de conversation */}
              <section
                aria-label="Conversation avec Koraly"
                role="region"
                className="flex-1 overflow-y-auto space-y-3 mb-4 pr-1"
                style={{ maxHeight: "50vh" }}
              >
                {messages.map((msg) => (
                  <KoralyMsgBubble
                    key={msg.id}
                    role={msg.role}
                    text={msg.text}
                    loading={msg.loading}
                    loadingLabel="Koraly cherche…"
                  >
                    {msg.results && msg.results.length > 0 && (
                      <div className="w-full mt-2 space-y-2">
                        {msg.results.map((r) => (
                          <RecipeCard
                            key={r.id}
                            recipe={r}
                            onSelect={handleSelectRecipe}
                            disabled={busy}
                          />
                        ))}
                      </div>
                    )}
                  </KoralyMsgBubble>
                ))}
                <div ref={chatEndRef} aria-hidden="true" />
              </section>

              {/* Zone de saisie */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSearch(inputText);
                }}
                className="flex gap-2 items-center"
                aria-label="Rechercher une recette"
              >
                <label htmlFor="recettes-input" className="sr-only">
                  Rechercher une recette
                </label>
                <input
                  id="recettes-input"
                  ref={inputRef}
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Rechercher une recette… (ou appuyez sur V)"
                  disabled={busy}
                  autoComplete="off"
                  className="flex-1 rounded-xl px-4 py-3 text-base"
                  style={{
                    background: "var(--bg-surface)",
                    border: "1px solid var(--border-hi)",
                    color: "var(--text)",
                    outline: "none",
                  }}
                  onFocus={(e) =>
                    (e.currentTarget.style.borderColor = "var(--accent)")
                  }
                  onBlur={(e) =>
                    (e.currentTarget.style.borderColor = "var(--border-hi)")
                  }
                />
                <button
                  type="submit"
                  disabled={busy || !inputText.trim()}
                  aria-label="Rechercher"
                  className="rounded-xl px-4 py-3 text-base font-semibold transition-opacity disabled:opacity-40"
                  style={{ background: "var(--accent)", color: "#fff" }}
                >
                  Chercher
                </button>
              </form>

              {/* Suggestions */}
              <nav aria-label="Recherches suggérées" className="mt-3 flex flex-wrap gap-2">
                {[
                  "ratatouille",
                  "tarte tatin",
                  "coq au vin",
                  "crêpes",
                  "quiche lorraine",
                ].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => handleSearch(s)}
                    disabled={busy}
                    className="text-xs px-3 py-1.5 rounded-full transition-opacity disabled:opacity-40"
                    style={{
                      background: "var(--bg-surface)",
                      border: "1px solid var(--border)",
                      color: "var(--text-soft)",
                    }}
                  >
                    {s}
                  </button>
                ))}
              </nav>
            </>
          ) : (
            currentRecipe && (
              <div
                className="flex-1 overflow-y-auto"
                style={{ maxHeight: "65vh" }}
              >
                <RecipeDetailView
                  recipe={currentRecipe}
                  currentStep={currentStep}
                  isSpeaking={isSpeaking}
                  onPrevStep={handlePrevStep}
                  onNextStep={handleNextStep}
                  onReadStep={handleReadStep}
                  onBack={handleBackToSearch}
                />
              </div>
            )
          )}

          {/* Aide raccourcis */}
          <p
            className="text-xs text-center mt-4"
            style={{ color: "var(--text-muted)" }}
          >
            {view === "search"
              ? "Raccourcis : V micro · Échap stop · ? aide"
              : "Raccourcis : N étape suiv. · P étape préc. · Entrée lire · V micro · ? aide"}
          </p>
        </div>
    </KoralyPageShell>
  );
}
