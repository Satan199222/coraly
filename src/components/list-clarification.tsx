"use client";

import type { ParsedGroceryItem } from "@/lib/carrefour/types";

interface ListClarificationProps {
  items: ParsedGroceryItem[];
  onUpdate: (index: number, update: Partial<ParsedGroceryItem>) => void;
  onValidate: () => void;
}

export function ListClarification({
  items,
  onUpdate,
  onValidate,
}: ListClarificationProps) {
  const needsClarification = items.some((i) => i.status !== "clear");
  const allClear = items.every((i) => i.status === "clear");

  return (
    <section aria-label="Vérification de la liste">
      <h2 className="text-xl font-bold mb-2">Vérification de votre liste</h2>
      <p className="text-[var(--text-muted)] mb-4">
        {allClear
          ? `${items.length} produits prêts pour la recherche.`
          : `${items.filter((i) => i.status === "clear").length} clairs, ${items.filter((i) => i.status !== "clear").length} à préciser.`}
      </p>

      <ul className="space-y-3" role="list">
        {items.map((item, index) => {
          const statusLabel =
            item.status === "clear"
              ? "validé"
              : item.status === "ambiguous"
                ? "à préciser"
                : "incompris";
          // aria-label complet pour les items CLEAR (pas d'action possible,
          // juste de l'info) — pour que le SR annonce "1 sur 5, lait demi-écrémé,
          // validé, recherche : lait demi ecreme"
          const clearItemLabel = `Article ${index + 1} sur ${items.length}, ${item.originalText}, ${statusLabel}${item.status === "clear" ? `, recherche : ${item.query}` : ""}`;

          return (
            <li
              key={index}
              {...(item.status === "clear"
                ? { tabIndex: 0, "aria-label": clearItemLabel }
                : {})}
              className={`p-4 rounded-lg border-2 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring)] ${
                item.status === "clear"
                  ? "border-[var(--success)] bg-[var(--bg-surface)]"
                  : item.status === "ambiguous"
                    ? "border-[var(--accent)] bg-[var(--bg-surface)]"
                    : "border-[var(--danger)] bg-[var(--bg-surface)]"
              }`}
            >
              <div className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className={`text-lg ${
                    item.status === "clear"
                      ? "text-[var(--success)]"
                      : item.status === "ambiguous"
                        ? "text-[var(--accent)]"
                        : "text-[var(--danger)]"
                  }`}
                >
                  {item.status === "clear"
                    ? "✓"
                    : item.status === "ambiguous"
                      ? "?"
                      : "✗"}
                </span>
                <div className="flex-1">
                  <div className="font-semibold">{item.originalText}</div>
                  {item.status === "clear" && (
                    <div className="text-sm text-[var(--text-muted)]">
                      Recherche : {item.query}
                    </div>
                  )}
                  {item.clarificationQuestion && (
                    <div
                      className="mt-2 font-medium"
                      id={`clarif-q-${index}`}
                    >
                      {item.clarificationQuestion}
                    </div>
                  )}
                  {item.suggestions && item.suggestions.length > 0 && (
                    <div
                      className="flex flex-wrap gap-2 mt-2"
                      role="group"
                      aria-labelledby={`clarif-q-${index}`}
                    >
                      {item.suggestions.map((suggestion) => (
                        <button
                          key={suggestion}
                          type="button"
                          onClick={() =>
                            onUpdate(index, {
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
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <button
        onClick={onValidate}
        disabled={!allClear}
        className="w-full mt-6 px-6 py-4 rounded-lg bg-[var(--accent)] text-[var(--bg)] font-bold text-lg disabled:opacity-50 transition-colors"
        aria-label={
          allClear
            ? `Lancer la recherche pour ${items.length} produits`
            : "Précisez tous les produits avant de lancer la recherche"
        }
      >
        {allClear ? "Lancer la recherche" : "Précisez les produits marqués pour continuer"}
      </button>
    </section>
  );
}
