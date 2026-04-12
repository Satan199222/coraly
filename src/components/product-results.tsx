"use client";

import { forwardRef } from "react";
import type { CarrefourProduct } from "@/lib/carrefour/types";

interface ProductResultsProps {
  items: {
    query: string;
    product: CarrefourProduct | null;
    alternatives: CarrefourProduct[];
    allCandidates: CarrefourProduct[];
    currentIndex: number;
    quantity: number;
    /** false pendant la recherche, true quand l'API a répondu (même vide). */
    searched: boolean;
  }[];
  onConfirm: (ean: string) => void;
  onReject: (query: string) => void;
  onIncrement: (query: string) => void;
  onDecrement: (query: string) => void;
  confirmedEans: Set<string>;
  /** Refs des boutons Confirmer par ean — pour le focus auto "prochain à confirmer". */
  confirmRefs?: React.MutableRefObject<Map<string, HTMLButtonElement | null>>;
}

function priceToSpeech(price: number | null | undefined): string {
  if (price == null) return "prix indisponible";
  const [int, decimal] = price.toFixed(2).split(".");
  if (decimal === "00") return `${int} euros`;
  return `${int} euros ${parseInt(decimal, 10)} centimes`;
}

export const ProductResults = forwardRef<HTMLDivElement, ProductResultsProps>(
  function ProductResults(
    { items, onConfirm, onReject, onIncrement, onDecrement, confirmedEans, confirmRefs },
    ref
  ) {
    if (items.length === 0) return null;

    return (
      <section aria-label="Produits trouvés" ref={ref}>
        {/* h3 : sous le h2 d'étape invisible. Garde une hiérarchie propre. */}
        <h3 className="text-xl font-bold mb-4">
          Produits trouvés ({items.length})
        </h3>
        <ul className="space-y-4">
          {items.map((item, index) => {
            const p = item.product;
            const titleId = `product-title-${index}`;

            if (!p) {
              // Pendant la recherche : état "loading" visuel + annonce SR
              // distincte de "aucun résultat". Ne montre PAS le bouton Retirer
              // tant que la recherche n'est pas finie (l'utilisateur pourrait
              // retirer un item qui allait se résoudre dans 2s).
              if (!item.searched) {
                return (
                  <li
                    key={item.query}
                    aria-busy="true"
                    aria-label={`Recherche en cours pour ${item.query}`}
                    className="p-4 rounded-lg bg-[var(--bg-surface)] border border-[var(--border)] opacity-80"
                  >
                    <p id={titleId} className="flex items-center gap-3">
                      <span
                        aria-hidden="true"
                        className="inline-block w-3 h-3 rounded-full bg-[var(--accent)] animate-pulse"
                      />
                      <span>
                        Recherche en cours pour <strong>{item.query}</strong>…
                      </span>
                    </p>
                  </li>
                );
              }

              // Recherche terminée, vraiment aucun résultat
              return (
                <li
                  key={item.query}
                  className="p-4 rounded-lg bg-[var(--bg-surface)] border border-[var(--danger)]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p id={titleId}>
                      Aucun résultat pour <strong>{item.query}</strong>
                    </p>
                    <button
                      type="button"
                      onClick={() => onDecrement(item.query)}
                      aria-label={`Retirer ${item.query} de la liste`}
                      className="px-3 py-1 rounded border border-[var(--text-muted)] text-[var(--text-muted)] hover:border-[var(--danger)] hover:text-[var(--danger)] transition-colors text-sm shrink-0"
                    >
                      Retirer
                    </button>
                  </div>
                </li>
              );
            }

            const isConfirmed = confirmedEans.has(p.ean);
            const total = item.allCandidates.length;
            const altInfo =
              total > 1 ? ` Choix ${item.currentIndex + 1} sur ${total}.` : "";

            const priceVocal = priceToSpeech(p.price);
            const perUnit = p.perUnitLabel ? `, soit ${p.perUnitLabel}` : "";
            const pkg = p.packaging ? `, ${p.packaging}` : "";
            const nutri = p.nutriscore ? `, Nutriscore ${p.nutriscore}` : "";
            // Quantité au DÉBUT du résumé pour que l'utilisateur l'entende avant
            // de décider de confirmer — il ne doit pas confirmer à l'aveugle.
            const qtyPrefix = item.quantity > 1 ? `Quantité ${item.quantity}, ` : "";
            const productSummary = `${qtyPrefix}${p.title}${pkg}, ${priceVocal}${perUnit}${nutri}`;

            return (
              <li
                key={p.ean}
                className={`p-4 rounded-lg bg-[var(--bg-surface)] border-2 transition-colors ${
                  isConfirmed
                    ? "border-[var(--success)]"
                    : "border-[var(--border)]"
                }`}
              >
                <div className="flex justify-between items-start gap-4 mb-3">
                  <div className="flex-1">
                    <h4
                      id={titleId}
                      className="font-semibold text-lg"
                      aria-label={`Article ${index + 1} sur ${items.length}.${altInfo} ${productSummary}${isConfirmed ? ". Confirmé." : ""}`}
                    >
                      {p.title}
                    </h4>
                    <p className="text-[var(--text-muted)]">
                      {p.brand} — {p.packaging}
                      {p.nutriscore && ` — Nutriscore ${p.nutriscore}`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-[var(--accent)]">
                      {p.price != null ? `${p.price.toFixed(2)}€` : "—"}
                    </p>
                    {p.perUnitLabel && (
                      <p className="text-sm text-[var(--text-muted)]">
                        {p.perUnitLabel}
                      </p>
                    )}
                  </div>
                </div>

                <div
                  role="group"
                  aria-labelledby={titleId}
                  className="flex gap-2 flex-wrap items-center"
                >
                  {/* Quantité EN PREMIER : l'utilisateur doit connaître la
                      quantité proposée AVANT de pouvoir confirmer. Tab tombe
                      sur −, +, puis Confirmer. */}
                  <div
                    className="flex items-center gap-1"
                    role="group"
                    aria-label={`Quantité : ${item.quantity}`}
                  >
                    <button
                      type="button"
                      onClick={() => onDecrement(item.query)}
                      aria-label={
                        item.quantity === 1
                          ? "Retirer ce produit de la liste"
                          : `Diminuer la quantité. Actuellement ${item.quantity}`
                      }
                      className="w-11 h-11 rounded-full border border-[var(--border)] text-[var(--text)] font-bold text-lg hover:bg-[var(--bg)] hover:border-[var(--danger)] hover:text-[var(--danger)] transition-colors flex items-center justify-center"
                    >
                      {item.quantity === 1 ? "×" : "−"}
                    </button>
                    <span
                      className="w-10 text-center font-bold text-lg"
                      aria-hidden="true"
                    >
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => onIncrement(item.query)}
                      aria-label={`Augmenter la quantité. Actuellement ${item.quantity}`}
                      className="w-11 h-11 rounded-full border border-[var(--border)] text-[var(--text)] font-bold text-lg hover:bg-[var(--bg)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors flex items-center justify-center"
                    >
                      +
                    </button>
                  </div>

                  <button
                    ref={(el) => {
                      if (confirmRefs) confirmRefs.current.set(p.ean, el);
                    }}
                    type="button"
                    onClick={() => onConfirm(p.ean)}
                    disabled={isConfirmed}
                    aria-label={
                      isConfirmed
                        ? "Déjà confirmé"
                        : `Confirmer ${item.quantity > 1 ? `${item.quantity} fois ` : ""}${p.title}`
                    }
                    className={`px-4 py-2 rounded font-semibold transition-colors ${
                      isConfirmed
                        ? "bg-[var(--success)] text-[var(--bg)]"
                        : "bg-[var(--bg)] border border-[var(--success)] text-[var(--success)] hover:bg-[var(--success)] hover:text-[var(--bg)]"
                    }`}
                  >
                    {isConfirmed ? "Confirmé" : "Confirmer"}
                  </button>

                  {!isConfirmed && total > 1 && (
                    <button
                      type="button"
                      onClick={() => onReject(item.query)}
                      aria-label={`Voir une autre alternative. Actuellement choix ${item.currentIndex + 1} sur ${total}`}
                      className="px-4 py-2 rounded border border-[var(--danger)] text-[var(--danger)] hover:bg-[var(--danger)] hover:text-white transition-colors ml-auto"
                    >
                      Autre choix ({item.currentIndex + 1}/{total})
                    </button>
                  )}
                </div>

                {item.quantity > 1 && p.price != null && (
                  <p
                    className="mt-2 text-sm text-[var(--text-muted)] text-right"
                    aria-label={`Sous-total : ${priceToSpeech(p.price * item.quantity)}`}
                  >
                    Sous-total : {(p.price * item.quantity).toFixed(2)}€
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    );
  }
);
