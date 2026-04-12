"use client";

import type { CarrefourProduct } from "@/lib/carrefour/types";

interface ProductResultsProps {
  items: {
    query: string;
    product: CarrefourProduct | null;
    alternatives: CarrefourProduct[];
    allCandidates: CarrefourProduct[];
    currentIndex: number;
    quantity: number;
  }[];
  onConfirm: (ean: string) => void;
  onReject: (query: string) => void;
  onIncrement: (query: string) => void;
  onDecrement: (query: string) => void;
  confirmedEans: Set<string>;
}

/**
 * Convertit un prix (ex: 1.26) en texte prononçable "1 euros 26 centimes".
 * Meilleur que laisser le TTS lire "1.26 €" brut.
 */
function priceToSpeech(price: number | null | undefined): string {
  if (price == null) return "prix indisponible";
  const [int, decimal] = price.toFixed(2).split(".");
  if (decimal === "00") return `${int} euros`;
  return `${int} euros ${parseInt(decimal, 10)} centimes`;
}

export function ProductResults({
  items,
  onConfirm,
  onReject,
  onIncrement,
  onDecrement,
  confirmedEans,
}: ProductResultsProps) {
  if (items.length === 0) return null;

  return (
    <section aria-label="Produits trouvés">
      <h2 className="text-xl font-bold mb-4">
        Produits trouvés ({items.length})
      </h2>
      <ul className="space-y-4">
        {items.map((item, index) => {
          const p = item.product;
          const titleId = `product-title-${index}`;

          if (!p) {
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

          // Description concise du produit, réutilisée pour les aria-labels
          // des boutons et le contexte lu au focus de la carte.
          const priceVocal = priceToSpeech(p.price);
          const perUnit = p.perUnitLabel ? `, soit ${p.perUnitLabel}` : "";
          const pkg = p.packaging ? `, ${p.packaging}` : "";
          const nutri = p.nutriscore ? `, Nutriscore ${p.nutriscore}` : "";
          const productSummary = `${p.title}${pkg}, ${priceVocal}${perUnit}${nutri}`;

          return (
            <li
              key={p.ean}
              className={`p-4 rounded-lg bg-[var(--bg-surface)] border-2 transition-colors ${
                isConfirmed
                  ? "border-[var(--success)]"
                  : "border-[var(--border)]"
              }`}
            >
              {/* Carte focusable avec description globale — screen readers
                  annoncent le produit complet avant d'atteindre les boutons.
                  Pattern aria-labelledby pour réduire répétition dans les boutons. */}
              <div className="flex justify-between items-start gap-4 mb-3">
                <div className="flex-1">
                  <h3
                    id={titleId}
                    className="font-semibold text-lg"
                    aria-label={`Article ${index + 1} sur ${items.length}.${altInfo} ${productSummary}${isConfirmed ? ". Confirmé." : ""}`}
                  >
                    {p.title}
                  </h3>
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

              {/* Groupe d'actions — aria-labelledby = pointe vers le h3 pour que
                  le screen reader annonce "[nom produit] group" quand le focus
                  entre dans la zone, puis juste l'action de chaque bouton.
                  Réduit la répétition "pour 2L de lait, article X". */}
              <div
                role="group"
                aria-labelledby={titleId}
                className="flex gap-2 flex-wrap items-center"
              >
                <button
                  type="button"
                  onClick={() => onConfirm(p.ean)}
                  disabled={isConfirmed}
                  aria-label={
                    isConfirmed
                      ? "Déjà confirmé"
                      : "Confirmer ce produit"
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
                    className="px-4 py-2 rounded border border-[var(--danger)] text-[var(--danger)] hover:bg-[var(--danger)] hover:text-white transition-colors"
                  >
                    Autre choix ({item.currentIndex + 1}/{total})
                  </button>
                )}

                {/* Contrôles de quantité */}
                <div
                  className="flex items-center gap-1 ml-auto"
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
                    className="w-10 h-10 rounded-full border border-[var(--border)] text-[var(--text)] font-bold text-lg hover:bg-[var(--bg)] hover:border-[var(--danger)] hover:text-[var(--danger)] transition-colors flex items-center justify-center"
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
                    className="w-10 h-10 rounded-full border border-[var(--border)] text-[var(--text)] font-bold text-lg hover:bg-[var(--bg)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors flex items-center justify-center"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Total ligne si quantité > 1 */}
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
