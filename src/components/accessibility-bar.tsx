"use client";

import { useEffect, useState } from "react";
import { useExtension } from "@/lib/extension/use-extension";
import {
  usePreferences,
  type DietaryRestriction,
  type SpeechLocale,
  type SpeechRate,
} from "@/lib/preferences/use-preferences";

interface AccessibilityBarProps {
  onVoiceToggle?: (enabled: boolean) => void;
  /** Ouvre le dialog d'aide — normalement déclenché aussi par `?`. */
  onHelpRequest?: () => void;
}

type Theme = "clair" | "sombre" | "jaune-noir" | "blanc-bleu";

const THEME_OPTIONS: { value: Theme; label: string; aria: string }[] = [
  { value: "clair", label: "Clair", aria: "Thème clair (par défaut)" },
  { value: "sombre", label: "Sombre", aria: "Thème sombre" },
  { value: "jaune-noir", label: "Jaune/Noir", aria: "Thème jaune sur noir, recommandé pour la DMLA" },
  { value: "blanc-bleu", label: "Blanc/Bleu", aria: "Thème blanc sur bleu, recommandé pour le glaucome" },
];

const FONT_SIZES = ["16px", "18px", "22px", "28px"] as const;

const DIET_OPTIONS: { value: DietaryRestriction; label: string }[] = [
  { value: "sans-gluten", label: "Sans gluten" },
  { value: "sans-lactose", label: "Sans lactose" },
  { value: "vegan", label: "Végan" },
  { value: "vegetarien", label: "Végétarien" },
  { value: "halal", label: "Halal" },
  { value: "casher", label: "Casher" },
];

const RATE_OPTIONS: { value: SpeechRate; label: string }[] = [
  { value: "slow", label: "Lent" },
  { value: "normal", label: "Normal" },
  { value: "fast", label: "Rapide" },
];

const LOCALE_OPTIONS: { value: SpeechLocale; label: string }[] = [
  { value: "fr-FR", label: "France" },
  { value: "fr-BE", label: "Belgique" },
  { value: "fr-CH", label: "Suisse" },
  { value: "fr-CA", label: "Canada" },
];

function isTheme(v: string | null): v is Theme {
  return v === "clair" || v === "sombre" || v === "jaune-noir" || v === "blanc-bleu";
}

/** localStorage.getItem avec garde contre private-browsing / quota. */
function safeLocalGet(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
/** localStorage.setItem avec garde contre private-browsing / quota. */
function safeLocalSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch (err) {
    console.warn(`[a11y] localStorage.setItem(${key}) failed:`, err);
  }
}

export function AccessibilityBar({
  onVoiceToggle,
  onHelpRequest,
}: AccessibilityBarProps = {}) {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === "undefined") return "clair";
    const saved = safeLocalGet("voixcourses-theme");
    return isTheme(saved) ? saved : "clair";
  });
  const [fontSize, setFontSize] = useState<string>(() => {
    if (typeof window === "undefined") return "18px";
    return safeLocalGet("voixcourses-font-size") || "18px";
  });
  const [voiceEnabled, setVoiceEnabled] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const saved = safeLocalGet("voixcourses-voice-enabled");
    return saved === null ? true : saved === "true";
  });

  // Notifier le parent au 1er mount avec la valeur lue depuis localStorage.
  useEffect(() => {
    onVoiceToggle?.(voiceEnabled);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const extension = useExtension();
  const { prefs, update } = usePreferences();

  // Applique le thème : retire toutes les classes theme-*, ajoute la bonne.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("theme-sombre", "theme-jaune-noir", "theme-blanc-bleu");
    if (theme !== "clair") root.classList.add(`theme-${theme}`);
    safeLocalSet("voixcourses-theme", theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.style.setProperty("--font-size-base", fontSize);
    safeLocalSet("voixcourses-font-size", fontSize);
  }, [fontSize]);

  function toggleDiet(d: DietaryRestriction) {
    const next = prefs.diet.includes(d)
      ? prefs.diet.filter((x) => x !== d)
      : [...prefs.diet, d];
    update({ diet: next });
  }

  const currentSizeIdx = FONT_SIZES.indexOf(fontSize as (typeof FONT_SIZES)[number]);
  const decreaseDisabled = currentSizeIdx <= 0;
  const increaseDisabled = currentSizeIdx >= FONT_SIZES.length - 1;

  return (
    <div
      role="region"
      aria-label="Préférences d'accessibilité"
      className="border-b"
      style={{
        background: "var(--accent-ink)",
        color: "var(--text-on-ink)",
        borderColor: "var(--text-on-ink-faint)",
      }}
    >
      {/* Ligne compacte : Aa-/+ · 4 thèmes · voix · préférences · aide */}
      <div className="flex items-center justify-between gap-4 flex-wrap px-6 py-3 text-[15px]">
        <div className="flex items-center gap-3 font-semibold">
          <span
            aria-hidden="true"
            className="inline-flex items-center justify-center w-7 h-7 rounded-full border-2 text-sm font-bold"
            style={{ borderColor: "var(--text-on-ink)" }}
          >
            Aa
          </span>
          <span>Confort de lecture</span>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Taille de texte */}
          <button
            type="button"
            aria-label="Diminuer la taille du texte"
            disabled={decreaseDisabled}
            onClick={() =>
              setFontSize(FONT_SIZES[Math.max(0, currentSizeIdx - 1)])
            }
            className="px-3 py-1.5 rounded border text-sm font-semibold disabled:opacity-40"
            style={{ borderColor: "var(--text-on-ink-faint)", color: "var(--text-on-ink)" }}
          >
            Aa −
          </button>
          <button
            type="button"
            aria-label="Augmenter la taille du texte"
            disabled={increaseDisabled}
            onClick={() =>
              setFontSize(FONT_SIZES[Math.min(FONT_SIZES.length - 1, currentSizeIdx + 1)])
            }
            className="px-3 py-1.5 rounded border text-sm font-semibold disabled:opacity-40"
            style={{ borderColor: "var(--text-on-ink-faint)", color: "var(--text-on-ink)" }}
          >
            Aa +
          </button>

          <span aria-hidden="true" className="opacity-40 mx-1">·</span>

          {/* 4 thèmes visibles */}
          {THEME_OPTIONS.map((opt) => {
            const active = theme === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                aria-label={opt.aria}
                aria-pressed={active}
                onClick={() => setTheme(opt.value)}
                className="px-3 py-1.5 rounded border text-sm"
                style={{
                  borderColor: active ? "var(--brass)" : "var(--text-on-ink-faint)",
                  background: active ? "var(--brass)" : "transparent",
                  color: active ? "var(--accent-ink)" : "var(--text-on-ink)",
                  fontWeight: active ? 700 : 600,
                }}
              >
                {opt.label}
              </button>
            );
          })}

          <span aria-hidden="true" className="opacity-40 mx-1">·</span>

          {/* Voix */}
          <button
            type="button"
            aria-pressed={voiceEnabled}
            onClick={() => {
              const next = !voiceEnabled;
              setVoiceEnabled(next);
              safeLocalSet("voixcourses-voice-enabled", String(next));
              onVoiceToggle?.(next);
            }}
            className="px-3 py-1.5 rounded border text-sm font-semibold"
            style={{
              borderColor: voiceEnabled ? "var(--brass)" : "var(--text-on-ink-faint)",
              background: voiceEnabled ? "var(--brass)" : "transparent",
              color: voiceEnabled ? "var(--accent-ink)" : "var(--text-on-ink)",
            }}
          >
            🔊 Voix {voiceEnabled ? "active" : "coupée"}
          </button>

          {extension.installed && (
            <span
              className="px-2 py-1 rounded text-xs font-bold"
              style={{ background: "var(--brass)", color: "var(--accent-ink)" }}
              aria-label={`Extension VoixCourses version ${extension.version} détectée`}
              title={`Extension v${extension.version}`}
            >
              ✓ Extension
            </span>
          )}

          {onHelpRequest && (
            <button
              type="button"
              onClick={onHelpRequest}
              aria-label="Afficher l'aide et les raccourcis clavier"
              className="px-3 py-1.5 rounded border text-sm font-semibold"
              style={{ borderColor: "var(--text-on-ink-faint)", color: "var(--text-on-ink)" }}
            >
              ? Aide
            </button>
          )}
        </div>
      </div>

      {/* Préférences avancées — repliées par défaut */}
      <details className="px-6 pb-3">
        <summary
          className="cursor-pointer text-sm py-2 font-semibold"
          style={{ color: "var(--text-on-ink-muted)" }}
          aria-label="Préférences avancées : vitesse vocale, régime alimentaire, variante du français, allergènes. Dépliez pour modifier."
        >
          ⚙ Préférences avancées (vitesse vocale, régime, variante, allergènes)
        </summary>

        <div
          className="grid gap-4 mt-3 md:grid-cols-2 text-sm"
          style={{ color: "var(--text-on-ink)" }}
        >
          {/* Régime alimentaire */}
          <fieldset
            className="rounded p-3"
            style={{ border: "1px solid var(--text-on-ink-faint)" }}
          >
            <legend className="px-2 font-semibold">Régime alimentaire</legend>
            <p className="text-xs mb-2" style={{ color: "var(--text-on-ink-muted)" }}>
              Appliqué à toutes vos recherches.
            </p>
            <div className="flex flex-wrap gap-2">
              {DIET_OPTIONS.map((opt) => {
                const active = prefs.diet.includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => toggleDiet(opt.value)}
                    aria-pressed={active}
                    aria-label={`Régime ${opt.label}${active ? ", activé" : ", désactivé"}`}
                    className="px-3 py-1 rounded border text-sm"
                    style={{
                      borderColor: active ? "var(--brass)" : "var(--text-on-ink-faint)",
                      background: active ? "var(--brass)" : "transparent",
                      color: active ? "var(--accent-ink)" : "var(--text-on-ink)",
                      fontWeight: active ? 700 : 500,
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </fieldset>

          {/* Synthèse vocale */}
          <fieldset
            className="rounded p-3"
            style={{ border: "1px solid var(--text-on-ink-faint)" }}
          >
            <legend className="px-2 font-semibold">Synthèse vocale</legend>

            <div className="flex items-center gap-2 mb-2">
              <label htmlFor="speech-rate" className="min-w-[80px]">
                Vitesse :
              </label>
              <select
                id="speech-rate"
                value={prefs.speechRate}
                onChange={(e) => update({ speechRate: e.target.value as SpeechRate })}
                className="rounded px-2 py-1 text-sm"
                style={{
                  background: "var(--text-on-ink-faint)",
                  color: "var(--text-on-ink)",
                  border: "1px solid var(--text-on-ink-faint)",
                }}
              >
                {RATE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value} style={{ color: "#000" }}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 mb-2">
              <label htmlFor="speech-locale" className="min-w-[80px]">
                Variante :
              </label>
              <select
                id="speech-locale"
                value={prefs.speechLocale}
                onChange={(e) => update({ speechLocale: e.target.value as SpeechLocale })}
                className="rounded px-2 py-1 text-sm"
                style={{
                  background: "var(--text-on-ink-faint)",
                  color: "var(--text-on-ink)",
                  border: "1px solid var(--text-on-ink-faint)",
                }}
              >
                {LOCALE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value} style={{ color: "#000" }}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            <label className="flex items-center gap-2 mt-3 cursor-pointer">
              <input
                type="checkbox"
                checked={prefs.premiumVoice}
                onChange={(e) => update({ premiumVoice: e.target.checked })}
                className="w-4 h-4"
                aria-describedby="premium-voice-help"
              />
              <span className="font-semibold">✨ Voix premium (ElevenLabs)</span>
            </label>
            <p id="premium-voice-help" className="text-xs mt-1 ml-6" style={{ color: "var(--text-on-ink-muted)" }}>
              Voix studio en ligne. Désactivez pour la voix native du navigateur (offline).
            </p>
          </fieldset>

          {/* Allergènes */}
          <fieldset
            className="rounded p-3 md:col-span-2"
            style={{ border: "1px solid var(--text-on-ink-faint)" }}
          >
            <legend className="px-2 font-semibold">Allergènes à éviter</legend>
            <p className="text-xs mb-2" style={{ color: "var(--text-on-ink-muted)" }}>
              Séparés par des virgules — ex : arachide, fruits à coque, moutarde.
            </p>
            <input
              type="text"
              defaultValue={prefs.allergens.join(", ")}
              onBlur={(e) => {
                const list = e.target.value
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean);
                update({ allergens: list });
              }}
              className="w-full px-3 py-2 rounded text-sm"
              style={{
                background: "var(--text-on-ink-faint)",
                color: "var(--text-on-ink)",
                border: "1px solid var(--text-on-ink-faint)",
              }}
              aria-label="Liste des allergènes à éviter, séparés par des virgules"
            />
          </fieldset>
        </div>
      </details>
    </div>
  );
}
