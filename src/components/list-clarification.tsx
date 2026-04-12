"use client";

import { useMemo, useState } from "react";
import type { ParsedGroceryItem } from "@/lib/carrefour/types";

interface ListClarificationProps {
  items: ParsedGroceryItem[];
  onUpdate: (index: number, update: Partial<ParsedGroceryItem>) => void;
  onValidate: () => void;
  onRemove?: (index: number) => void;
  /** Bouton optionnel "Modifier ma liste" pour retourner à l'étape saisie. */
  onEditList?: () => void;
}

export function ListClarification({
  items,
  onUpdate,
  onValidate,
  onRemove,
  onEditList,
}: ListClarificationProps) {
  const allClear = items.every((i) => i.status === "clear");
  const toReviewCount = items.filter((i) => i.status !== "clear").length;

  // Afficher d'abord les items qui réclament une action, puis ceux déjà clairs.
  // Pour un utilisateur clavier, Tab tombe immédiatement sur le travail
  // restant au lieu de traverser N items validés inutilement.
  const orderedItems = useMemo(() => {
    return items
      .map((item, originalIndex) => ({ item, originalIndex }))
      .sort((a, b) => {
        const aToDo = a.item.status !== "clear" ? 0 : 1;
        const bToDo = b.item.status !== "clear" ? 0 : 1;
        return aToDo - bToDo;
      });
  }, [items]);

  return (
    <section aria-label="Vérification de la liste">
      {/* h3 pour rester en-dessous du h2 d'étape invisible de page.tsx */}
      <h3 className="text-xl font-bold mb-2">Vérification de votre liste</h3>
      <p className="text-[var(--text-muted)] mb-4">
        {allClear
          ? `${items.length} produits prêts pour la recherche.`
          : `${items.filter((i) => i.status === "clear").length} validés, ${toReviewCount} à préciser.`}
      </p>

      <ul className="space-y-3" role="list">
        {orderedItems.map(({ item, originalIndex }) => (
          <ClarificationItem
            key={`${item.originalText}-${originalIndex}`}
            item={item}
            index={originalIndex}
            total={items.length}
            onUpdate={(update) => onUpdate(originalIndex, update)}
            onRemove={onRemove ? () => onRemove(originalIndex) : undefined}
          />
        ))}
      </ul>

      <div className="flex gap-3 mt-6 flex-wrap">
        <button
          onClick={onValidate}
          disabled={!allClear}
          className="flex-1 px-6 py-4 rounded-lg bg-[var(--accent)] text-[var(--bg)] font-bold text-lg disabled:opacity-50 transition-colors"
          aria-label={
            allClear
              ? `Lancer la recherche pour ${items.length} produits`
              : `Précisez les ${toReviewCount} produits restants avant de lancer la recherche`
          }
        >
          {allClear
            ? "Lancer la recherche"
            : `Précisez les ${toReviewCount} produits restants`}
        </button>
        {onEditList && (
          <button
            type="button"
            onClick={onEditList}
            aria-label="Modifier ma liste — retour à la saisie"
            className="px-4 py-3 rounded-lg border-2 border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--text)] transition-colors"
          >
            Modifier ma liste
          </button>
        )}
      </div>
    </section>
  );
}

interface ClarificationItemProps {
  item: ParsedGroceryItem;
  index: number;
  total: number;
  onUpdate: (update: Partial<ParsedGroceryItem>) => void;
  onRemove?: () => void;
}

function ClarificationItem({
  item,
  index,
  total,
  onUpdate,
  onRemove,
}: ClarificationItemProps) {
  const [customValue, setCustomValue] = useState("");

  // Label concis pour items validés : pas besoin du détail de la query
  // technique ("lait demi écreme 1L"). L'utilisateur veut savoir que c'est OK.
  const clearItemLabel = `Article ${index + 1} sur ${total}, ${item.originalText}, validé`;

  const borderClass =
    item.status === "clear"
      ? "border-[var(--success)]"
      : item.status === "ambiguous"
        ? "border-[var(--accent)]"
        : "border-[var(--danger)]";

  const iconColor =
    item.status === "clear"
      ? "text-[var(--success)]"
      : item.status === "ambiguous"
        ? "text-[var(--accent)]"
        : "text-[var(--danger)]";

  const icon =
    item.status === "clear" ? "✓" : item.status === "ambiguous" ? "?" : "✗";

  function handleCustomSubmit(e: React.FormEvent) {
    e.preventDefault();
    const v = customValue.trim();
    if (!v) return;
    onUpdate({
      query: v,
      status: "clear",
      clarificationQuestion: undefined,
      suggestions: undefined,
    });
    setCustomValue("");
  }

  const clarifId = `clarif-q-${index}`;
  const customInputId = `clarif-custom-${index}`;

  return (
    <li
      {...(item.status === "clear"
        ? { tabIndex: 0, "aria-label": clearItemLabel }
        : {})}
      className={`p-4 rounded-lg border-2 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring)] bg-[var(--bg-surface)] ${borderClass}`}
    >
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className={`text-lg ${iconColor}`}>
          {icon}
        </span>
        <div className="flex-1">
          <div className="font-semibold">{item.originalText}</div>
          {/* On n'affiche plus "recherche : X" : c'est une info technique
              qui pollue l'aria-label et n'aide ni voyants ni non-voyants. */}
          {item.clarificationQuestion && (
            <div className="mt-2 font-medium" id={clarifId}>
              {item.clarificationQuestion}
            </div>
          )}

          {item.suggestions && item.suggestions.length > 0 && (
            <div
              className="flex flex-wrap gap-2 mt-2"
              role="group"
              aria-labelledby={clarifId}
            >
              {item.suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() =>
                    onUpdate({
                      query: suggestion,
                      status: "clear",
                      clarificationQuestion: undefined,
                      suggestions: undefined,
                    })
                  }
                  className="px-3 py-1.5 rounded border border-[var(--accent)] text-[var(--accent)] text-sm hover:bg-[var(--accent)] hover:text-[var(--bg)] transition-colors"
                  aria-label={`Pour ${item.originalText}, choisir : ${suggestion}`}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}

          {item.status !== "clear" && (
            <form
              onSubmit={handleCustomSubmit}
              className="flex gap-2 mt-3 flex-wrap"
              aria-label={`Correction libre pour ${item.originalText}`}
            >
              <label htmlFor={customInputId} className="sr-only">
                Autre réponse pour {item.originalText}
              </label>
              <input
                id={customInputId}
                type="text"
                value={customValue}
                onChange={(e) => setCustomValue(e.target.value)}
                placeholder="Autre réponse…"
                className="flex-1 min-w-[10rem] px-3 py-2 rounded border-2 border-[var(--border)] bg-[var(--bg)] text-[var(--text)] text-sm focus:border-[var(--accent)]"
              />
              <button
                type="submit"
                disabled={!customValue.trim()}
                className="px-3 py-2 rounded bg-[var(--accent)] text-[var(--bg)] text-sm font-semibold disabled:opacity-50"
                aria-label={`Valider la correction pour ${item.originalText}`}
              >
                OK
              </button>
              {onRemove && (
                <button
                  type="button"
                  onClick={onRemove}
                  aria-label={`Retirer ${item.originalText} de la liste`}
                  className="px-3 py-2 rounded border border-[var(--border)] text-[var(--text-muted)] text-sm hover:border-[var(--danger)] hover:text-[var(--danger)]"
                >
                  Retirer
                </button>
              )}
            </form>
          )}
        </div>
      </div>
    </li>
  );
}
