"use client";

import { useState } from "react";
import type { CarrefourStore } from "@/lib/carrefour/types";

interface StoreSelectorProps {
  onStoreSelected: (store: CarrefourStore, basketServiceId: string) => void;
}

export function StoreSelector({ onStoreSelected }: StoreSelectorProps) {
  const [postalCode, setPostalCode] = useState("");
  const [stores, setStores] = useState<CarrefourStore[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectingRef, setSelectingRef] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [postalError, setPostalError] = useState<string | null>(null);

  function validatePostalCode(value: string): string | null {
    if (!value.trim()) return null;
    if (!/^\d{5}$/.test(value.trim())) {
      return "Le code postal doit contenir exactement 5 chiffres";
    }
    return null;
  }

  function handlePostalBlur() {
    setPostalError(validatePostalCode(postalCode));
  }

  function handlePostalChange(e: React.ChangeEvent<HTMLInputElement>) {
    setPostalCode(e.target.value);
    // Effacer l'erreur dès que l'utilisateur recommence à taper
    if (postalError) setPostalError(null);
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!postalCode.trim()) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/stores?postalCode=${postalCode}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Aucun magasin trouvé pour ce code postal");
        setStores([]);
      } else {
        const data = await res.json();
        setStores(data.stores || []);
        if ((data.stores || []).length === 0) {
          setError("Aucun magasin Carrefour trouvé pour ce code postal");
        }
      }
    } catch {
      setError("Erreur de connexion");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSelect(store: CarrefourStore) {
    setSelectingRef(store.ref);
    try {
      const res = await fetch("/api/stores", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ storeRef: store.ref }),
      });
      const data = await res.json();
      onStoreSelected(store, data.basketServiceId);
    } catch {
      setError("Impossible de sélectionner ce magasin");
      setSelectingRef(null);
    }
  }

  return (
    <section aria-label="Choix du magasin">
      <h2 className="text-2xl font-bold mb-2">Choisir votre magasin</h2>
      <p className="text-[var(--text-muted)] mb-4">
        Entrez votre code postal pour trouver les magasins Carrefour proches.
      </p>

      <form onSubmit={handleSearch} className="mb-6">
        <div className="flex gap-3 mb-2">
          <label htmlFor="postal-code" className="sr-only">
            Code postal
          </label>
          <input
            id="postal-code"
            type="text"
            inputMode="numeric"
            pattern="[0-9]{5}"
            maxLength={5}
            value={postalCode}
            onChange={handlePostalChange}
            onBlur={handlePostalBlur}
            placeholder="Code postal (ex: 57360)"
            className={`flex-1 p-3 rounded-lg bg-[var(--bg-surface)] border-2 text-[var(--text)] text-lg ${
              postalError
                ? "border-[var(--danger)]"
                : "border-[var(--border)]"
            }`}
            autoComplete="postal-code"
            aria-invalid={postalError ? "true" : "false"}
            aria-describedby={postalError ? "postal-error" : undefined}
          />
          <button
            type="submit"
            disabled={isLoading || postalCode.length < 5 || !!postalError}
            className="px-6 py-3 rounded-lg bg-[var(--accent)] text-[var(--bg)] font-bold disabled:opacity-50"
          >
            {isLoading ? "Recherche..." : "Chercher"}
          </button>
        </div>
        {postalError && (
          <p
            id="postal-error"
            role="alert"
            className="text-[var(--danger)] text-sm"
          >
            {postalError}
          </p>
        )}
      </form>

      {error && (
        <div
          role="alert"
          className="p-4 mb-4 rounded-lg border-2 border-[var(--danger)] text-[var(--danger)]"
        >
          {error}
        </div>
      )}

      {stores.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3">
            {stores.length} magasin{stores.length > 1 ? "s" : ""} trouvé
            {stores.length > 1 ? "s" : ""} :
          </h3>
          <ul role="list" className="space-y-3">
            {stores.map((store) => (
              <li key={store.ref}>
                <button
                  type="button"
                  onClick={() => handleSelect(store)}
                  disabled={selectingRef !== null}
                  aria-pressed={selectingRef === store.ref}
                  aria-label={`Choisir ${store.name}, ${store.format}, à ${store.distance} kilomètres`}
                  className="w-full flex items-center justify-between gap-4 p-4 rounded-lg border-2 border-[var(--border)] bg-[var(--bg-surface)] text-left hover:border-[var(--accent)] disabled:opacity-50 transition-colors"
                >
                  <div>
                    <div className="font-semibold text-lg">{store.name}</div>
                    <div className="text-sm text-[var(--text-muted)]">
                      {store.format} — {store.distance} km
                    </div>
                  </div>
                  <span
                    className="px-4 py-2 rounded bg-[var(--accent)] text-[var(--bg)] font-bold"
                    aria-hidden="true"
                  >
                    {selectingRef === store.ref ? "..." : "Choisir"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
