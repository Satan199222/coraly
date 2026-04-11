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
  const [selectedRef, setSelectedRef] = useState<string | null>(null);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!postalCode.trim()) return;
    setIsLoading(true);
    const res = await fetch(`/api/stores?postalCode=${postalCode}`);
    const data = await res.json();
    setStores(data.stores || []);
    setIsLoading(false);
  }

  async function handleSelect(store: CarrefourStore) {
    setSelectedRef(store.ref);
    const res = await fetch("/api/stores", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ storeRef: store.ref }),
    });
    const data = await res.json();
    onStoreSelected(store, data.basketServiceId);
  }

  return (
    <section aria-label="Choix du magasin">
      <h2 className="text-xl font-bold mb-4">Choisir votre magasin</h2>
      <form onSubmit={handleSearch} className="flex gap-3 mb-4">
        <label htmlFor="postal-code" className="sr-only">
          Code postal
        </label>
        <input
          id="postal-code"
          type="text"
          inputMode="numeric"
          pattern="[0-9]{5}"
          value={postalCode}
          onChange={(e) => setPostalCode(e.target.value)}
          placeholder="Code postal (ex: 57360)"
          className="flex-1 p-3 rounded-lg bg-[var(--bg-surface)] border-2 border-[var(--border)] text-[var(--text)] text-lg"
          aria-describedby="cp-help"
        />
        <button
          type="submit"
          disabled={isLoading || postalCode.length < 5}
          className="px-6 py-3 rounded-lg bg-[var(--accent)] text-[var(--bg)] font-bold disabled:opacity-50"
        >
          {isLoading ? "Recherche..." : "Chercher"}
        </button>
      </form>
      <p id="cp-help" className="text-sm text-[var(--text-muted)] mb-4">
        Entrez votre code postal pour trouver les magasins Carrefour proches.
      </p>

      {stores.length > 0 && (
        <fieldset>
          <legend className="font-semibold mb-2">
            {stores.length} magasin(s) trouvé(s) :
          </legend>
          <div className="space-y-2" role="radiogroup">
            {stores.map((store) => (
              <label
                key={store.ref}
                className={`flex items-center gap-3 p-4 rounded-lg cursor-pointer border-2 transition-colors ${
                  selectedRef === store.ref
                    ? "border-[var(--success)] bg-[var(--bg-surface)]"
                    : "border-[var(--border)] hover:border-[var(--accent)]"
                }`}
              >
                <input
                  type="radio"
                  name="store"
                  value={store.ref}
                  checked={selectedRef === store.ref}
                  onChange={() => handleSelect(store)}
                  className="w-5 h-5 accent-[var(--accent)]"
                />
                <div>
                  <div className="font-semibold">{store.name}</div>
                  <div className="text-sm text-[var(--text-muted)]">
                    {store.format} — {store.distance} km
                  </div>
                </div>
              </label>
            ))}
          </div>
        </fieldset>
      )}
    </section>
  );
}
