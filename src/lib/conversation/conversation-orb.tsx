"use client";

export function ConversationOrb({
  status,
  isAgentSpeaking,
  isAgentListening,
}: {
  status: string;
  isAgentSpeaking: boolean;
  isAgentListening: boolean;
}) {
  const baseClass =
    "relative w-40 h-40 rounded-full transition-all duration-500 flex items-center justify-center";

  let stateClass = "";
  let ringClass = "";
  if (status === "disconnected") {
    stateClass = "bg-gradient-to-br from-[var(--border)] to-[var(--bg-surface)]";
  } else if (status === "connecting") {
    stateClass =
      "bg-gradient-to-br from-[var(--accent)] to-[var(--accent-hover)] animate-pulse";
  } else if (isAgentSpeaking) {
    stateClass =
      "bg-gradient-to-br from-[var(--success)] to-[var(--accent-hover)] scale-105";
    ringClass = "animate-[pingSlow_1.5s_ease-out_infinite]";
  } else if (isAgentListening) {
    stateClass =
      "bg-gradient-to-br from-[var(--accent)] to-[var(--accent-hover)] animate-[breathe_2.5s_ease-in-out_infinite]";
  }

  return (
    <div className="relative">
      {ringClass && (
        <div
          className={`absolute inset-0 rounded-full bg-[var(--success)] opacity-30 ${ringClass}`}
          aria-hidden="true"
        />
      )}
      <div className={`${baseClass} ${stateClass}`} aria-hidden="true">
        <span className="text-6xl">
          {status === "disconnected"
            ? "⚪"
            : status === "connecting"
              ? "🔄"
              : isAgentSpeaking
                ? "🔊"
                : "🎤"}
        </span>
      </div>
    </div>
  );
}

export function StatusLabel({
  status,
  isAgentSpeaking,
  agentName = "Koraly",
}: {
  status: string;
  isAgentSpeaking: boolean;
  agentName?: string;
}) {
  const label =
    status === "disconnected"
      ? "Prêt à démarrer"
      : status === "connecting"
        ? "Connexion en cours…"
        : isAgentSpeaking
          ? `${agentName} parle…`
          : `${agentName} vous écoute — parlez !`;

  return (
    <p
      role="status"
      aria-live="polite"
      className="text-lg font-semibold text-center"
    >
      {label}
    </p>
  );
}
