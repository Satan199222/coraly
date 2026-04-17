"use client";

/**
 * VoixSanté — Page /sante
 * Interface vocale Koraly pour la recherche de médicaments sans ordonnance.
 *
 * Fonctionnalités :
 * - Koraly guide l'utilisateur dans la recherche de médicaments OTC
 * - Recherche vocale : "J'ai mal à la tête" → suggestion + prix + disponibilité
 * - Annonce vocale des résultats (nom, prix, disponibilité, note)
 * - Pas d'ordonnance requise — produits parapharmacie uniquement
 * - WCAG AAA, police Luciole, design system marine
 *
 * Limite V1 : produits sur ordonnance non disponibles (scraping public uniquement).
 * GROA-246 — Phase 4b VoixSanté interface conversationnelle Koraly
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { AccessibilityBar } from "@/lib/shared/components/accessibility-bar";
import { LiveRegion } from "@/lib/shared/components/live-region";
import { KoralyOrb } from "@/lib/shared/components/koraly-orb";
import type { KoralyOrbStatus } from "@/lib/shared/components/koraly-orb";
import { SiteHeader } from "@/components/site-header";
import { Footer } from "@/components/footer";
import { HelpDialog } from "@/components/help-dialog";
import { useSpeech } from "@/lib/shared/speech/use-speech";
import { usePreferences, SPEECH_RATE_VALUE } from "@/lib/preferences/use-preferences";
import { useDocumentTitle } from "@/lib/useDocumentTitle";
import type { PharmaProduct, PharmaSearchResult } from "@/lib/sante/types";

// ---------------------------------------------------------------------------
// Types internes
// ---------------------------------------------------------------------------

interface ChatMsg {
  id: string;
  role: "user" | "koraly";
  text: string;
  loading?: boolean;
  product?: PharmaProduct;
  categorySlugs?: string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatPrice(price: number): string {
  return price.toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  });
}

function productToSpeech(p: PharmaProduct): string {
  const stock = p.inStock ? "disponible" : "indisponible actuellement";
  const price = p.price > 0 ? `, prix ${formatPrice(p.price)}` : "";
  const rating =
    p.ratingValue != null && p.reviewCount != null
      ? `, noté ${p.ratingValue.toFixed(1)} sur 5 par ${p.reviewCount} avis`
      : "";
  return `${p.name}${price}, ${stock}${rating}.`;
}

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

// ---------------------------------------------------------------------------
// Composant carte produit
// ---------------------------------------------------------------------------

interface ProductCardProps {
  product: PharmaProduct;
}

function ProductCard({ product }: ProductCardProps) {
  return (
    <div
      role="article"
      aria-label={product.name}
      className="rounded-2xl p-4 mt-2"
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border-hi)",
      }}
    >
      <div className="flex gap-3 items-start">
        {product.imageUrl && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={product.imageUrl}
            alt={product.name}
            width={64}
            height={64}
            className="rounded-lg object-contain flex-shrink-0"
            style={{ background: "#fff", border: "1px solid var(--border)" }}
          />
        )}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm leading-tight" style={{ color: "var(--text)" }}>
            {product.name}
          </p>
          {product.brand && (
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
              {product.brand}
            </p>
          )}
          <div className="flex flex-wrap gap-2 mt-2 items-center">
            {product.price > 0 && (
              <span
                className="text-base font-bold"
                style={{ color: "var(--brass)" }}
              >
                {formatPrice(product.price)}
              </span>
            )}
            <span
              className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{
                background: product.inStock
                  ? "color-mix(in srgb, var(--success) 15%, transparent)"
                  : "color-mix(in srgb, var(--danger) 15%, transparent)",
                color: product.inStock ? "var(--success)" : "var(--danger)",
                border: `1px solid ${product.inStock ? "var(--success)" : "var(--danger)"}`,
              }}
            >
              {product.inStock ? "En stock" : "Indisponible"}
            </span>
            {product.ratingValue != null && (
              <span className="text-xs" style={{ color: "var(--text-soft)" }}>
                ★ {product.ratingValue.toFixed(1)}
                {product.reviewCount != null && ` (${product.reviewCount} avis)`}
              </span>
            )}
          </div>
          {product.description && (
            <p
              className="text-xs mt-2 line-clamp-2"
              style={{ color: "var(--text-soft)" }}
            >
              {product.description}
            </p>
          )}
          <a
            href={product.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs mt-2 inline-block underline"
            style={{ color: "var(--accent)" }}
            aria-label={`Voir ${product.name} sur Pharma GDD (nouvelle fenêtre)`}
          >
            Voir sur Pharma GDD ↗
          </a>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Composant bulle de message
// ---------------------------------------------------------------------------

interface MsgBubbleProps {
  msg: ChatMsg;
}

function MsgBubble({ msg }: MsgBubbleProps) {
  const isKoraly = msg.role === "koraly";
  return (
    <div className={`flex flex-col ${isKoraly ? "items-start" : "items-end"}`}>
      <div
        className="max-w-prose rounded-2xl px-4 py-3 text-base leading-relaxed"
        style={{
          background: isKoraly ? "var(--bg-card)" : "var(--accent)",
          color: isKoraly ? "var(--text)" : "#fff",
          border: isKoraly ? "1px solid var(--border)" : "none",
          borderRadius: isKoraly ? "4px 18px 18px 18px" : "18px 4px 18px 18px",
        }}
      >
        {msg.loading ? (
          <span aria-label="Koraly cherche…" style={{ opacity: 0.6 }}>…</span>
        ) : (
          msg.text
        )}
      </div>
      {msg.product && <ProductCard product={msg.product} />}
      {msg.categorySlugs && msg.categorySlugs.length > 0 && !msg.product && (
        <div className="mt-2 text-xs" style={{ color: "var(--text-soft)" }}>
          <p>Produits trouvés : {msg.categorySlugs.slice(0, 5).join(", ")}</p>
          <p className="mt-1">Précisez votre recherche pour obtenir les détails d&apos;un produit.</p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page principale
// ---------------------------------------------------------------------------

export default function SantePage() {
  useDocumentTitle("VoixSanté — Médicaments par la voix");

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

  const [voiceEnabled] = useState(true);
  const [helpOpen, setHelpOpen] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [inputText, setInputText] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      id: "welcome",
      role: "koraly",
      text: "Bonjour ! Je suis Koraly. Quel médicament ou produit de santé recherchez-vous ? Dites par exemple : \"doliprane\", \"vitamine C\", ou \"j'ai mal à la gorge\".",
    },
  ]);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const prevTranscriptRef = useRef("");

  // Scroll automatique en bas
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

  // Auto-soumission quand la reconnaissance s'arrête
  useEffect(() => {
    if (!isListening && inputText.trim() && inputText === transcript) {
      handleSubmit(inputText);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isListening]);

  const orbStatus: KoralyOrbStatus = isListening
    ? "listening"
    : isSpeaking
    ? "speaking"
    : "idle";

  // Annonce et lecture TTS
  const announce = useCallback(
    async (text: string) => {
      setAnnouncement(text);
      if (voiceEnabled) {
        cancelSpeech();
        await speak(text).catch((err: unknown) => {
          console.warn("[sante] speak failed:", err);
        });
      }
    },
    [voiceEnabled, speak, cancelSpeech]
  );

  // Ajout d'un message dans le fil
  const addMsg = useCallback((msg: ChatMsg) => {
    setMessages((prev) => {
      const withoutLoading = prev.filter((m) => !m.loading);
      return [...withoutLoading, msg];
    });
  }, []);

  // ---------------------------------------------------------------------------
  // Logique de recherche
  // ---------------------------------------------------------------------------

  const handleSubmit = useCallback(
    async (query: string) => {
      const q = query.trim();
      if (!q || busy) return;

      setInputText("");
      prevTranscriptRef.current = "";

      addMsg({ id: uid(), role: "user", text: q });

      // Message de chargement
      const loadingId = uid();
      setMessages((prev) => [
        ...prev,
        { id: loadingId, role: "koraly", text: "", loading: true },
      ]);

      setBusy(true);
      cancelSpeech();

      try {
        const res = await fetch(
          `/api/sante/search?q=${encodeURIComponent(q)}`
        );

        if (!res.ok) {
          const data = (await res.json()) as { error?: string };
          const errText =
            data.error ?? "Recherche impossible. Réessayez dans un instant.";
          setMessages((prev) => prev.filter((m) => m.id !== loadingId));
          addMsg({ id: uid(), role: "koraly", text: errText });
          await announce(errText);
          return;
        }

        const result = (await res.json()) as PharmaSearchResult;

        setMessages((prev) => prev.filter((m) => m.id !== loadingId));

        if (result.type === "product" && result.product) {
          const p = result.product;
          const speech = productToSpeech(p);
          addMsg({
            id: uid(),
            role: "koraly",
            text: speech,
            product: p,
          });
          await announce(speech);
        } else if (result.type === "category" && result.categorySlugs?.length) {
          const count = result.categorySlugs.length;
          const txt = `J'ai trouvé ${count} produit${count > 1 ? "s" : ""} dans cette catégorie. Pouvez-vous préciser le nom du médicament souhaité ?`;
          addMsg({
            id: uid(),
            role: "koraly",
            text: txt,
            categorySlugs: result.categorySlugs,
          });
          await announce(txt);
        } else {
          const txt = "Je n'ai pas trouvé de résultat pour cette recherche. Essayez un autre terme ou le nom commercial du médicament.";
          addMsg({ id: uid(), role: "koraly", text: txt });
          await announce(txt);
        }
      } catch (err) {
        console.error("[sante] search error:", err);
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
  }, [isListening, startListening, stopListening, cancelSpeech, router]);

  // ---------------------------------------------------------------------------
  // Rendu
  // ---------------------------------------------------------------------------

  return (
    <>
      <AccessibilityBar service="sante" />
      <LiveRegion message={announcement} />
      <SiteHeader />
      <main id="main" tabIndex={-1}>
        <h1 className="sr-only">VoixSanté — Médicaments sans ordonnance par la voix</h1>

        <div
          className="mx-auto max-w-2xl px-4 py-8 flex flex-col"
          style={{ minHeight: "calc(100dvh - 120px)" }}
        >
          {/* En-tête */}
          <div className="mb-6 text-center">
            <p className="vc-eyebrow mb-1">VoixSanté</p>
            <p className="text-sm" style={{ color: "var(--text-soft)" }}>
              Médicaments et produits sans ordonnance — données Pharma GDD
            </p>
          </div>

          {/* Orbe Koraly + bouton micro */}
          <div className="flex flex-col items-center gap-3 mb-6">
            <KoralyOrb status={orbStatus} />
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
          </div>

          {!isSupported && (
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

          {/* Fil de conversation */}
          <section
            aria-label="Conversation avec Koraly"
            role="region"
            className="flex-1 overflow-y-auto space-y-3 mb-4 pr-1"
            style={{ maxHeight: "55vh" }}
          >
            {messages.map((msg) => (
              <MsgBubble key={msg.id} msg={msg} />
            ))}
            <div ref={chatEndRef} aria-hidden="true" />
          </section>

          {/* Zone de saisie */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSubmit(inputText);
            }}
            className="flex gap-2 items-center"
            aria-label="Rechercher un médicament"
          >
            <label htmlFor="sante-input" className="sr-only">
              Rechercher un médicament ou produit de santé
            </label>
            <input
              id="sante-input"
              ref={inputRef}
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Rechercher un médicament… (ou appuyez sur V)"
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
              style={{
                background: "var(--accent)",
                color: "#fff",
              }}
            >
              Chercher
            </button>
          </form>

          {/* Suggestions rapides */}
          <nav aria-label="Recherches suggérées" className="mt-3 flex flex-wrap gap-2">
            {[
              "doliprane",
              "ibuprofène",
              "vitamine C",
              "antiseptique gorge",
              "sirop toux",
            ].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => handleSubmit(s)}
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

          {/* Mention légale */}
          <p
            className="text-xs text-center mt-4"
            style={{ color: "var(--text-muted)" }}
          >
            ⚠ Informations non médicales — consultez un pharmacien ou médecin
            avant toute automédication.
          </p>

          {/* Aide raccourcis */}
          <p
            className="text-xs text-center mt-2"
            style={{ color: "var(--text-muted)" }}
          >
            Raccourcis : <kbd>V</kbd> micro · <kbd>Échap</kbd> stop ·{" "}
            <kbd>?</kbd> aide
          </p>
        </div>
      </main>
      <Footer />
      <HelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
    </>
  );
}
