"use client";

/**
 * KoralyChatInput — zone de saisie partagée pour les 4 pages conversationnelles.
 *
 * Inclut :
 *  - Champ texte avec focus/blur styles
 *  - Bouton micro (conditionnel sur isSupported)
 *  - Bouton envoi
 *
 * GROA-496
 */

interface KoralyChatInputProps {
  inputId: string;
  inputLabel: string;
  formLabel: string;
  placeholder: string;
  submitLabel?: string;
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onMicToggle: () => void;
  isListening: boolean;
  isSupported: boolean;
  busy: boolean;
}

export function KoralyChatInput({
  inputId,
  inputLabel,
  formLabel,
  placeholder,
  submitLabel = "Envoyer",
  value,
  onChange,
  onSubmit,
  onMicToggle,
  isListening,
  isSupported,
  busy,
}: KoralyChatInputProps) {
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit();
  }

  return (
    <form onSubmit={handleSubmit} aria-label={formLabel} className="flex items-center gap-2">
      <label htmlFor={inputId} className="sr-only">
        {inputLabel}
      </label>
      <input
        id={inputId}
        type="text"
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={busy}
        placeholder={isListening ? "Parlez maintenant…" : placeholder}
        aria-label={inputLabel}
        className="flex-1 rounded-xl px-4 py-3 text-base border"
        style={{
          background: "var(--bg-surface)",
          color: "var(--text)",
          borderColor: isListening ? "var(--brass)" : "var(--border-hi)",
          outline: "none",
          boxShadow: isListening ? "0 0 0 3px rgba(181,136,66,0.3)" : undefined,
        }}
        onFocus={(e) =>
          (e.currentTarget.style.boxShadow = isListening
            ? "0 0 0 3px rgba(181,136,66,0.3)"
            : "0 0 0 3px var(--focus-ring)")
        }
        onBlur={(e) => (e.currentTarget.style.boxShadow = "")}
      />

      {isSupported && (
        <button
          type="button"
          onClick={onMicToggle}
          disabled={busy}
          aria-label={
            isListening
              ? "Arrêter la reconnaissance vocale (raccourci V)"
              : "Activer la reconnaissance vocale (raccourci V)"
          }
          aria-pressed={isListening}
          className="rounded-xl px-3 py-3 shrink-0"
          style={{
            background: isListening ? "var(--brass)" : "var(--bg-surface)",
            color: isListening ? "#fff" : "var(--text-soft)",
            border: "1px solid var(--border-hi)",
            cursor: busy ? "not-allowed" : "pointer",
            fontSize: "1.25rem",
            lineHeight: 1,
            opacity: busy ? 0.5 : 1,
          }}
        >
          🎤
        </button>
      )}

      <button
        type="submit"
        disabled={!value.trim() || busy}
        aria-label={submitLabel}
        className="rounded-xl px-4 py-3 font-semibold text-sm shrink-0"
        style={{
          background:
            value.trim() && !busy ? "var(--accent)" : "var(--bg-surface)",
          color: value.trim() && !busy ? "#fff" : "var(--text-muted)",
          border:
            value.trim() && !busy ? "none" : "1px solid var(--border-hi)",
          cursor: value.trim() && !busy ? "pointer" : "not-allowed",
        }}
      >
        {submitLabel}
      </button>
    </form>
  );
}
