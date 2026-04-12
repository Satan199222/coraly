"use client";

import { useState, useEffect } from "react";

interface AccessibilityBarProps {
  onVoiceToggle?: (enabled: boolean) => void;
}

export function AccessibilityBar({ onVoiceToggle }: AccessibilityBarProps = {}) {
  // Lire les préférences depuis localStorage au mount
  const [theme, setTheme] = useState<string>(() => {
    if (typeof window === "undefined") return "dark";
    return localStorage.getItem("voixcourses-theme") || "dark";
  });
  const [fontSize, setFontSize] = useState<string>(() => {
    if (typeof window === "undefined") return "1.125rem";
    return localStorage.getItem("voixcourses-font-size") || "1.125rem";
  });
  const [voiceEnabled, setVoiceEnabled] = useState(false);

  useEffect(() => {
    // Le thème est appliqué sur <html> (par theme-init.ts au boot, et ici sur changement)
    const root = document.documentElement;
    root.classList.remove("theme-light", "theme-high-contrast");
    if (theme !== "dark") {
      root.classList.add(`theme-${theme}`);
    }
    localStorage.setItem("voixcourses-theme", theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.style.setProperty("--font-size-base", fontSize);
    localStorage.setItem("voixcourses-font-size", fontSize);
  }, [fontSize]);

  return (
    <div
      role="region"
      aria-label="Paramètres d'accessibilité"
      className="flex items-center gap-3 flex-wrap bg-[var(--bg-surface)] border-b border-[var(--border)] px-4 py-2 text-sm"
    >
      <label htmlFor="theme-select" className="font-semibold text-[var(--text-muted)]">
        Thème :
      </label>
      <select
        id="theme-select"
        value={theme}
        onChange={(e) => setTheme(e.target.value)}
        className="bg-[var(--bg)] text-[var(--text)] border border-[var(--border)] rounded px-2 py-1 text-sm"
      >
        <option value="dark">Sombre</option>
        <option value="light">Clair</option>
        <option value="high-contrast">Contraste élevé</option>
      </select>

      <div className="border-l border-[var(--border)] h-5" aria-hidden="true" />

      <label htmlFor="font-size" className="font-semibold text-[var(--text-muted)]">
        Taille :
      </label>
      <select
        id="font-size"
        value={fontSize}
        onChange={(e) => setFontSize(e.target.value)}
        className="bg-[var(--bg)] text-[var(--text)] border border-[var(--border)] rounded px-2 py-1 text-sm"
      >
        <option value="1.125rem">Normal</option>
        <option value="1.3rem">Grand</option>
        <option value="1.5rem">Très grand</option>
        <option value="1.8rem">Maximum</option>
      </select>

      <div className="border-l border-[var(--border)] h-5" aria-hidden="true" />

      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={voiceEnabled}
          onChange={(e) => {
            setVoiceEnabled(e.target.checked);
            onVoiceToggle?.(e.target.checked);
          }}
          className="w-4 h-4 accent-[var(--accent)]"
        />
        <span className="font-semibold text-[var(--text-muted)]">Retour vocal</span>
      </label>
    </div>
  );
}
