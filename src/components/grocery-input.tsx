"use client";

import { useState } from "react";

interface GroceryInputProps {
  onSubmit: (text: string) => void;
  isLoading: boolean;
  isListening: boolean;
  onMicClick: () => void;
  transcript: string;
  isMicSupported: boolean;
}

export function GroceryInput({
  onSubmit,
  isLoading,
  isListening,
  onMicClick,
  transcript,
  isMicSupported,
}: GroceryInputProps) {
  const [text, setText] = useState("");
  const displayText = isListening ? transcript : text;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const value = displayText.trim();
    if (value) onSubmit(value);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <label htmlFor="grocery-list" className="block text-lg font-semibold">
        Votre liste de courses
      </label>
      <p id="grocery-help" className="text-sm text-[var(--text-muted)]">
        Tapez ou dictez vos produits. Exemple : 2 litres de lait, des pâtes, 6
        yaourts nature
      </p>
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
      <div className="flex gap-3">
        {isMicSupported && (
          <button
            type="button"
            onClick={onMicClick}
            aria-label={isListening ? "Arrêter la dictée" : "Dicter ma liste"}
            className={`px-6 py-3 rounded-lg font-semibold text-lg transition-colors ${
              isListening
                ? "bg-[var(--danger)] text-white"
                : "bg-[var(--bg-surface)] border-2 border-[var(--border)] text-[var(--text)] hover:border-[var(--accent)]"
            }`}
          >
            {isListening ? "Arrêter" : "Dicter"}
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
