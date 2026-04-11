"use client";

import type { CarrefourProduct } from "@/lib/carrefour/types";

interface ProductResultsProps {
  items: {
    query: string;
    product: CarrefourProduct | null;
    alternatives: CarrefourProduct[];
  }[];
  onConfirm: (ean: string) => void;
  onReject: (query: string) => void;
  confirmedEans: Set<string>;
}

export function ProductResults({
  items,
  onConfirm,
  onReject,
  confirmedEans,
}: ProductResultsProps) {
  if (items.length === 0) return null;

  return (
    <section aria-label="Produits trouvés">
      <h2 className="text-xl font-bold mb-4">
        Produits trouvés ({items.length})
      </h2>
      <ul className="space-y-4">
        {items.map((item) => {
          const p = item.product;
          if (!p) {
            return (
              <li
                key={item.query}
                className="p-4 rounded-lg bg-[var(--bg-surface)] border border-[var(--danger)]"
              >
                <p>
                  Aucun résultat pour <strong>{item.query}</strong>
                </p>
              </li>
            );
          }

          const isConfirmed = confirmedEans.has(p.ean);

          return (
            <li
              key={p.ean}
              className={`p-4 rounded-lg bg-[var(--bg-surface)] border-2 transition-colors ${
                isConfirmed
                  ? "border-[var(--success)]"
                  : "border-[var(--border)]"
              }`}
            >
              <div className="flex justify-between items-start gap-4">
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">{p.title}</h3>
                  <p className="text-[var(--text-muted)]">
                    {p.brand} — {p.packaging}
                    {p.nutriscore && ` — Nutriscore ${p.nutriscore}`}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-[var(--accent)]">
                    {p.price?.toFixed(2)}€
                  </p>
                  {p.perUnitLabel && (
                    <p className="text-sm text-[var(--text-muted)]">
                      {p.perUnitLabel}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => onConfirm(p.ean)}
                  disabled={isConfirmed}
                  aria-label={`${isConfirmed ? "Confirmé" : "Confirmer"} ${p.title}`}
                  className={`px-4 py-2 rounded font-semibold transition-colors ${
                    isConfirmed
                      ? "bg-[var(--success)] text-[var(--bg)]"
                      : "bg-[var(--bg)] border border-[var(--success)] text-[var(--success)] hover:bg-[var(--success)] hover:text-[var(--bg)]"
                  }`}
                >
                  {isConfirmed ? "Confirmé" : "Confirmer"}
                </button>
                {!isConfirmed && (
                  <button
                    onClick={() => onReject(item.query)}
                    aria-label={`Refuser ${p.title}`}
                    className="px-4 py-2 rounded border border-[var(--danger)] text-[var(--danger)] hover:bg-[var(--danger)] hover:text-white transition-colors"
                  >
                    Autre choix
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
