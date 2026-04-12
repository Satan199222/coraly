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

export function AccessibilityBar({
  onVoiceToggle,
  onHelpRequest,
}: AccessibilityBarProps = {}) {
  const [theme, setTheme] = useState<string>(() => {
    if (typeof window === "undefined") return "dark";
    return localStorage.getItem("voixcourses-theme") || "dark";
  });
  // Par défaut : "Grand" (1.3rem). VoixCourses cible les utilisateurs
  // malvoyants — l'expérience initiale doit être confortable sans avoir
  // à chercher le réglage.
  const [fontSize, setFontSize] = useState<string>(() => {
    if (typeof window === "undefined") return "1.3rem";
    return localStorage.getItem("voixcourses-font-size") || "1.3rem";
  });
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const extension = useExtension();
  const { prefs, update } = usePreferences();

  useEffect(() => {
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

  function toggleDiet(d: DietaryRestriction) {
    const next = prefs.diet.includes(d)
      ? prefs.diet.filter((x) => x !== d)
      : [...prefs.diet, d];
    update({ diet: next });
  }

  return (
    <div
      role="region"
      aria-label="Paramètres d'accessibilité"
      className="bg-[var(--bg-surface)] border-b border-[var(--border)]"
    >
      {/* Ligne compacte — réglages rapides.
          Thème et Taille sont mis en avant (fond contrasté fort, bordure
          épaisse) pour rester trouvables même pour un utilisateur qui
          découvre l'interface. Pas de "petit select discret". */}
      <div className="flex items-center gap-2 flex-wrap px-4 py-3 text-base">
        <div className="flex items-center gap-2 px-2 py-1 rounded-lg bg-[var(--bg)] border-2 border-[var(--accent)]">
          <label htmlFor="theme-select" className="font-bold text-[var(--text)]">
            🎨 Thème :
          </label>
          <select
            id="theme-select"
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            className="bg-[var(--bg-surface)] text-[var(--text)] border-2 border-[var(--accent)] rounded px-2 py-1 font-semibold cursor-pointer"
          >
            <option value="dark">Sombre</option>
            <option value="light">Clair</option>
            <option value="high-contrast">Contraste élevé</option>
          </select>
        </div>

        <div className="flex items-center gap-2 px-2 py-1 rounded-lg bg-[var(--bg)] border-2 border-[var(--accent)]">
          <label htmlFor="font-size" className="font-bold text-[var(--text)]">
            🔠 Taille :
          </label>
          <select
            id="font-size"
            value={fontSize}
            onChange={(e) => setFontSize(e.target.value)}
            className="bg-[var(--bg-surface)] text-[var(--text)] border-2 border-[var(--accent)] rounded px-2 py-1 font-semibold cursor-pointer"
          >
            <option value="1.125rem">Normal</option>
            <option value="1.3rem">Grand</option>
            <option value="1.5rem">Très grand</option>
            <option value="1.8rem">Maximum</option>
          </select>
        </div>

        <label className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--bg)] border-2 border-[var(--border)] cursor-pointer hover:border-[var(--accent)] transition-colors">
          <input
            type="checkbox"
            checked={voiceEnabled}
            onChange={(e) => {
              setVoiceEnabled(e.target.checked);
              onVoiceToggle?.(e.target.checked);
            }}
            className="w-5 h-5 accent-[var(--accent)]"
            aria-describedby="voice-help"
          />
          <span className="font-semibold text-[var(--text)]">🔊 Synthèse vocale</span>
        </label>
        <span id="voice-help" className="sr-only">
          Quand activé, VoixCourses lit à voix haute le contenu de chaque bouton ou champ que vous survolez au clavier, en plus des annonces automatiques du lecteur d&apos;écran.
        </span>

        {extension.installed && (
          <span
            className="px-3 py-2 rounded-lg bg-[var(--success)] text-[var(--bg)] font-bold text-sm"
            aria-label={`Extension VoixCourses version ${extension.version} détectée`}
            title={`Extension v${extension.version}`}
          >
            ✓ Extension OK
          </span>
        )}

        {onHelpRequest && (
          <button
            type="button"
            onClick={onHelpRequest}
            aria-label="Afficher l'aide et les raccourcis clavier"
            className="ml-auto px-3 py-2 rounded-lg border-2 border-[var(--border)] text-[var(--text)] font-bold hover:border-[var(--accent)] transition-colors"
          >
            ? Aide
          </button>
        )}
      </div>

      {/* Préférences avancées — repliées par défaut, chargées en lazy pour l'utilisateur qui en a besoin */}
      <details className="px-4 pb-2">
        <summary className="cursor-pointer text-sm text-[var(--text-muted)] hover:text-[var(--text)] py-1 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring)] rounded">
          Préférences avancées (vitesse vocale, régime alimentaire, variante du français)
        </summary>

        <div className="grid gap-4 mt-3 md:grid-cols-2 text-sm">
          {/* Régime alimentaire */}
          <fieldset className="border border-[var(--border)] rounded p-3">
            <legend className="px-2 font-semibold text-[var(--text-muted)]">
              Régime alimentaire
            </legend>
            <p className="text-xs text-[var(--text-muted)] mb-2">
              Ces contraintes sont appliquées automatiquement à toutes vos recherches.
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
                    className={`px-3 py-1 rounded border text-sm transition-colors ${
                      active
                        ? "bg-[var(--accent)] text-[var(--bg)] border-[var(--accent)]"
                        : "border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--accent)]"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </fieldset>

          {/* Vocal : vitesse + variante */}
          <fieldset className="border border-[var(--border)] rounded p-3">
            <legend className="px-2 font-semibold text-[var(--text-muted)]">
              Synthèse vocale
            </legend>

            <div className="flex items-center gap-2 mb-2">
              <label htmlFor="speech-rate" className="text-[var(--text-muted)] min-w-[80px]">
                Vitesse :
              </label>
              <select
                id="speech-rate"
                value={prefs.speechRate}
                onChange={(e) => update({ speechRate: e.target.value as SpeechRate })}
                className="bg-[var(--bg)] text-[var(--text)] border border-[var(--border)] rounded px-2 py-1 text-sm"
              >
                {RATE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="speech-locale" className="text-[var(--text-muted)] min-w-[80px]">
                Variante :
              </label>
              <select
                id="speech-locale"
                value={prefs.speechLocale}
                onChange={(e) =>
                  update({ speechLocale: e.target.value as SpeechLocale })
                }
                className="bg-[var(--bg)] text-[var(--text)] border border-[var(--border)] rounded px-2 py-1 text-sm"
              >
                {LOCALE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            <p className="text-xs text-[var(--text-muted)] mt-2">
              Affecte la reconnaissance vocale et la synthèse vocale.
            </p>
          </fieldset>

          {/* Allergènes — input libre */}
          <fieldset className="border border-[var(--border)] rounded p-3 md:col-span-2">
            <legend className="px-2 font-semibold text-[var(--text-muted)]">
              Allergènes à éviter
            </legend>
            <p className="text-xs text-[var(--text-muted)] mb-2">
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
              className="w-full px-3 py-2 rounded border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] text-sm focus:border-[var(--accent)]"
              aria-label="Liste des allergènes à éviter, séparés par des virgules"
            />
          </fieldset>
        </div>
      </details>
    </div>
  );
}
