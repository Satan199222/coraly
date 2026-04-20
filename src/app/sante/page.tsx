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

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { KoralyOrb } from "@/lib/shared/components/koraly-orb";
import { KoralyPageShell } from "@/lib/shared/components/koraly-page-shell";
import { KoralyChatInput } from "@/lib/shared/components/koraly-chat-input";
import { KoralyMsgBubble } from "@/lib/shared/components/koraly-msg-bubble";
import { useKoralyChat } from "@/lib/shared/hooks/use-koraly-chat";
import { useDocumentTitle } from "@/lib/useDocumentTitle";
import type { PharmaProduct, PharmaSearchResult } from "@/lib/sante/types";

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
              <span className="text-base font-bold" style={{ color: "var(--brass)" }}>
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
            <p className="text-xs mt-2 line-clamp-2" style={{ color: "var(--text-soft)" }}>
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
// Méta-données de message étendues pour Santé
// ---------------------------------------------------------------------------

interface SanteMsg {
  id: string;
  role: "user" | "koraly";
  text: string;
  loading?: boolean;
  product?: PharmaProduct;
  categorySlugs?: string[];
}

// ---------------------------------------------------------------------------
// Page principale
// ---------------------------------------------------------------------------

export default function SantePage() {
  useDocumentTitle("VoixSanté — Médicaments par la voix");

  const router = useRouter();
  const [helpOpen, setHelpOpen] = useState(false);

  // Messages enrichis (avec product/categorySlugs) en parallèle des messages du hook
  const [richMessages, setRichMessages] = useState<SanteMsg[]>([]);

  const onQuery = useCallback(async (query: string): Promise<string> => {
    const res = await fetch(`/api/sante/search?q=${encodeURIComponent(query)}`);
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      throw new Error(data.error ?? "Recherche impossible. Réessayez dans un instant.");
    }

    const result = (await res.json()) as PharmaSearchResult;

    if (result.type === "product" && result.product) {
      const p = result.product;
      const speech = productToSpeech(p);
      // Stocker les métadonnées enrichies
      setRichMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "koraly", text: speech, product: p }]);
      return speech;
    }

    if (result.type === "category" && result.categorySlugs?.length) {
      const count = result.categorySlugs.length;
      const txt = `J'ai trouvé ${count} produit${count > 1 ? "s" : ""} dans cette catégorie. Pouvez-vous préciser le nom du médicament souhaité ?`;
      setRichMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "koraly", text: txt, categorySlugs: result.categorySlugs },
      ]);
      return txt;
    }

    return "Je n'ai pas trouvé de résultat pour cette recherche. Essayez un autre terme ou le nom commercial du médicament.";
  }, []);

  const {
    cancelSpeech,
    startListening,
    stopListening,
    isListening,
    isSpeaking,
    isSupported,
    orbStatus,
    messages,
    inputText,
    setInputText,
    busy,
    announcement,
    chatEndRef,
    submitQuery,
  } = useKoralyChat({
    welcomeMessage:
      "Bonjour ! Je suis Koraly. Quel médicament ou produit de santé recherchez-vous ? Dites par exemple : \"doliprane\", \"vitamine C\", ou \"j'ai mal à la gorge\".",
    onQuery,
    logNamespace: "[sante]",
  });

  // Raccourcis clavier
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      if (e.key === "v" || e.key === "V") {
        e.preventDefault();
        if (isListening) stopListening();
        else { cancelSpeech(); startListening(); }
      }
      if (e.key === "Escape") { cancelSpeech(); stopListening(); }
      if (e.key === "?" || (e.key === "h" && !e.ctrlKey && !e.metaKey)) setHelpOpen(true);
      if (e.key === "Backspace" && e.altKey) router.push("/");
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isListening, startListening, stopListening, cancelSpeech, router]);

  // Construire un index des métadonnées par texte de message
  const richByText = new Map(richMessages.map((r) => [r.text, r]));

  // ---------------------------------------------------------------------------
  // Rendu
  // ---------------------------------------------------------------------------

  return (
    <KoralyPageShell
      service="sante"
      announcement={announcement}
      helpOpen={helpOpen}
      onHelpClose={() => setHelpOpen(false)}
      onHelpOpen={() => setHelpOpen(true)}
      mainClassName=""
      mainStyle={{ minHeight: "100dvh" }}
    >
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
              if (isListening) stopListening();
              else { cancelSpeech(); startListening(); }
            }}
            disabled={!isSupported}
            aria-label={
              isListening ? "Arrêter l'écoute"
              : isSpeaking ? "Koraly parle…"
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
          {messages.map((msg) => {
            const rich = richByText.get(msg.text);
            return (
              <KoralyMsgBubble
                key={msg.id}
                role={msg.role}
                text={msg.text}
                loading={msg.loading}
                loadingLabel="Koraly cherche…"
              >
                {rich?.product && <ProductCard product={rich.product} />}
                {rich?.categorySlugs && rich.categorySlugs.length > 0 && !rich.product && (
                  <div className="mt-2 text-xs" style={{ color: "var(--text-soft)" }}>
                    <p>Produits trouvés : {rich.categorySlugs.slice(0, 5).join(", ")}</p>
                    <p className="mt-1">Précisez votre recherche pour obtenir les détails d&apos;un produit.</p>
                  </div>
                )}
              </KoralyMsgBubble>
            );
          })}
          <div ref={chatEndRef} aria-hidden="true" />
        </section>

        {/* Zone de saisie */}
        <KoralyChatInput
          inputId="sante-input"
          inputLabel="Rechercher un médicament ou produit de santé"
          formLabel="Rechercher un médicament"
          placeholder="Rechercher un médicament… (ou appuyez sur V)"
          submitLabel="Chercher"
          value={inputText}
          onChange={setInputText}
          onSubmit={() => submitQuery(inputText)}
          onMicToggle={() => {
            if (isListening) stopListening();
            else { cancelSpeech(); startListening(); }
          }}
          isListening={isListening}
          isSupported={isSupported}
          busy={busy}
        />

        {/* Suggestions rapides */}
        <nav aria-label="Recherches suggérées" className="mt-3 flex flex-wrap gap-2">
          {["doliprane", "ibuprofène", "vitamine C", "antiseptique gorge", "sirop toux"].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => submitQuery(s)}
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
        <p className="text-xs text-center mt-4" style={{ color: "var(--text-muted)" }}>
          ⚠ Informations non médicales — consultez un pharmacien ou médecin avant toute automédication.
        </p>

        <p className="text-xs text-center mt-2" style={{ color: "var(--text-muted)" }}>
          Raccourcis : <kbd>V</kbd> micro · <kbd>Échap</kbd> stop · <kbd>?</kbd> aide
        </p>
      </div>
    </KoralyPageShell>
  );
}
