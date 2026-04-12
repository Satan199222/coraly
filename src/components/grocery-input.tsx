"use client";

import { useEffect, useRef, useState } from "react";
import type { OrderEntry } from "@/lib/history/use-order-history";

interface GroceryInputProps {
  onSubmit: (text: string) => void;
  isLoading: boolean;
  isListening: boolean;
  onMicClick: () => void;
  transcript: string;
  isMicSupported: boolean;
  /** Dernière commande validée — affiche un bouton "Reprendre" si présente */
  lastOrder?: OrderEntry | null;
  /** Synthèse vocale — pour le bouton "Écouter ma liste" avant de soumettre */
  onSpeak?: (text: string) => Promise<void> | void;
  /** Annulation de la synthèse en cours */
  onCancelSpeech?: () => void;
  /** Indique si la synthèse est en cours (bascule le bouton Écouter → Stop) */
  isSpeaking?: boolean;
}

/**
 * Formatte une date ISO en français lisible et prononçable
 * ("mardi 14 avril à 18 heures 42").
 */
function formatOrderDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export function GroceryInput({
  onSubmit,
  isLoading,
  isListening,
  onMicClick,
  transcript,
  isMicSupported,
  lastOrder,
  onSpeak,
  onCancelSpeech,
  isSpeaking = false,
}: GroceryInputProps) {
  const [text, setText] = useState("");

  // Pendant la dictée : on affiche le transcript live (non-éditable).
  // Dès qu'on arrête : on affiche text (éditable). La transition entre les
  // deux copie transcript → text pour ne pas perdre ce qui a été dicté.
  const displayText = isListening ? transcript : text;

  const wasListeningRef = useRef(false);
  useEffect(() => {
    const wasListening = wasListeningRef.current;
    wasListeningRef.current = isListening;

    // Transition true → false : on vient de stopper la dictée. Conserver le
    // transcript final dans le state éditable pour que le textarea ne se
    // vide pas visuellement et que l'utilisateur puisse corriger au clavier.
    if (wasListening && !isListening && transcript.trim()) {
      // Synchroniser le state du textarea avec le transcript reçu depuis le
      // hook de reconnaissance vocale — c'est un external state qui vient
      // d'ailleurs, il faut bien le recopier dans notre state ici.
      setText((prev) => {
        // Concaténer si l'utilisateur avait déjà tapé quelque chose avant
        // de dicter — évite d'écraser un contenu manuel.
        if (prev.trim() && !prev.includes(transcript.trim())) {
          return `${prev.trim()} ${transcript.trim()}`;
        }
        return transcript;
      });
    }
  }, [isListening, transcript]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const value = displayText.trim();
    if (value) onSubmit(value);
  }

  function reuseLast() {
    if (!lastOrder) return;
    setText(lastOrder.listText);
    // Annonce explicite : sans ça l'utilisateur non-voyant ne sait pas que
    // le textarea a été rempli. Le focus reste sur le bouton cliqué.
    if (onSpeak) {
      onSpeak(
        `Dernière liste chargée : ${lastOrder.count} produit${lastOrder.count > 1 ? "s" : ""}. Vous pouvez la modifier avant de valider.`
      );
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <label htmlFor="grocery-list" className="block text-lg font-semibold">
        Votre liste de courses
      </label>
      <p id="grocery-help" className="text-sm text-[var(--text-muted)]">
        Dictez ou tapez votre liste naturellement, comme si vous la disiez à
        quelqu&apos;un. Les mots inutiles (du, de la, quelques) seront ignorés
        automatiquement. Soyez précis sur le type et la quantité pour éviter
        les questions ensuite — par exemple «&nbsp;2 litres de lait demi-écrémé&nbsp;»
        plutôt que «&nbsp;du lait&nbsp;». Vous pourrez ajouter, remplacer ou ajuster la
        quantité de chaque produit après la recherche.
      </p>

      {/* Reprise de la dernière commande — gros gain UX pour les habitués.
          Affiché comme bouton dédié, placé AVANT le textarea pour que les
          utilisateurs qui naviguent au Tab y tombent immédiatement.
          Badge "ancienne" si > 7 jours : l'utilisateur peut préférer refaire. */}
      {lastOrder && (() => {
        // eslint-disable-next-line react-hooks/purity -- date display only, pas de useMemo car non critique pour re-render
        const ageMs = Date.now() - new Date(lastOrder.at).getTime();
        const isOld = ageMs > 7 * 24 * 60 * 60 * 1000;
        return (
          <div
            className="p-3 rounded-lg border-2 border-dashed border-[var(--accent)] bg-[var(--bg-surface)] flex items-center justify-between gap-3 flex-wrap"
            aria-label="Dernière commande disponible"
          >
            <div className="text-sm">
              <div className="font-semibold flex items-center gap-2 flex-wrap">
                Dernière commande : {lastOrder.count} produit
                {lastOrder.count > 1 ? "s" : ""} ({lastOrder.total.toFixed(2)}€)
                {isOld && (
                  <span
                    className="px-2 py-0.5 rounded bg-[var(--bg)] border border-[var(--accent)] text-xs text-[var(--accent)]"
                    aria-label="Commande datant de plus de 7 jours"
                  >
                    ancienne
                  </span>
                )}
              </div>
              <div className="text-[var(--text-muted)] text-xs">
                {formatOrderDate(lastOrder.at)}
                {lastOrder.storeName ? ` · ${lastOrder.storeName}` : ""}
              </div>
            </div>
            <button
              type="button"
              onClick={reuseLast}
              aria-label={`Reprendre la dernière commande ${isOld ? "(datant de plus de 7 jours) " : ""}: ${lastOrder.listText}`}
              className="px-4 py-2 rounded bg-[var(--accent)] text-[var(--bg)] font-semibold text-sm hover:bg-[var(--accent-hover)] transition-colors"
            >
              Reprendre cette liste
            </button>
          </div>
        );
      })()}

      <textarea
        id="grocery-list"
        aria-describedby="grocery-help"
        value={displayText}
        onChange={(e) => setText(e.target.value)}
        placeholder="2 litres de lait, des pâtes penne, 6 yaourts nature, du jambon blanc..."
        rows={4}
        className="w-full p-4 rounded-lg bg-[var(--bg-surface)] border-2 border-[var(--border)] text-[var(--text)] placeholder:text-[var(--text-muted)] text-lg resize-none focus:border-[var(--accent)]"
        disabled={isLoading}
      />
      <div className="flex gap-3 flex-wrap">
        {isMicSupported && (
          <button
            type="button"
            onClick={onMicClick}
            aria-label={
              isListening
                ? "Arrêter la dictée"
                : "Dicter ma liste — la synthèse vocale sera automatiquement mise en pause"
            }
            aria-pressed={isListening}
            className={`px-6 py-3 rounded-lg font-semibold text-lg transition-colors ${
              isListening
                ? "bg-[var(--danger)] text-white"
                : "bg-[var(--bg-surface)] border-2 border-[var(--border)] text-[var(--text)] hover:border-[var(--accent)]"
            }`}
          >
            {isListening ? "Arrêter" : "Dicter"}
          </button>
        )}

        {/* Écouter ma liste — réécoute avant de soumettre.
            Indispensable pour un utilisateur non-voyant : vérifier que la
            dictée a été correctement reconnue, ou que ce qui a été tapé au
            clavier est bien ce qu'il voulait, AVANT de lancer l'analyse. */}
        {onSpeak && (
          <button
            type="button"
            onClick={() => {
              if (isSpeaking) {
                onCancelSpeech?.();
              } else if (displayText.trim()) {
                // Pas de préfixe "Votre liste :" — redondant, l'utilisateur
                // vient de cliquer sur "Écouter" donc le contexte est clair.
                onSpeak(displayText.trim());
              }
            }}
            disabled={!displayText.trim() || isListening}
            aria-label={
              isSpeaking
                ? "Arrêter la lecture de ma liste"
                : "Écouter ma liste avant de la valider"
            }
            aria-pressed={isSpeaking}
            className={`px-6 py-3 rounded-lg font-semibold text-lg transition-colors ${
              isSpeaking
                ? "bg-[var(--danger)] text-white"
                : "bg-[var(--bg-surface)] border-2 border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent)] hover:text-[var(--bg)] disabled:opacity-50 disabled:cursor-not-allowed"
            }`}
          >
            {isSpeaking ? "Stop" : "Écouter"}
          </button>
        )}

        <button
          type="submit"
          disabled={isLoading || !displayText.trim()}
          className="flex-1 px-6 py-3 rounded-lg bg-[var(--accent)] text-[var(--bg)] font-bold text-lg hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? "Recherche en cours..." : "Trouver mes produits"}
        </button>
      </div>
    </form>
  );
}
