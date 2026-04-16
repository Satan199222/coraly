"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import {
  ConversationProvider,
  useConversationControls,
  useConversationStatus,
  useConversationMode,
} from "@elevenlabs/react";
import { AccessibilityBar } from "@/lib/shared/components/accessibility-bar";
import { SiteHeader } from "@/components/site-header";
import { LiveRegion } from "@/lib/shared/components/live-region";
import { Footer } from "@/components/footer";
import { useDocumentTitle } from "@/lib/useDocumentTitle";
import { ConversationOrb, StatusLabel } from "./conversation-orb";
import { useToolEvents } from "./use-tool-events";
import type { ConversationMessage, ConversationShellConfig, ToolEvent } from "./types";

interface ShellContextValue {
  pushToolEvent: (name: string, label: string) => void;
  setAnnounce: (msg: string) => void;
  setError: (err: string | null) => void;
  messages: ConversationMessage[];
  status: string;
  isActive: boolean;
}

const ShellContext = createContext<ShellContextValue | null>(null);

export function useShellContext(): ShellContextValue {
  const ctx = useContext(ShellContext);
  if (!ctx) throw new Error("useShellContext must be used inside ConversationShell");
  return ctx;
}

interface ConversationShellProps {
  config: ConversationShellConfig;
  dynamicVariables: Record<string, string>;
  contextualUpdateText?: string;
  /** Endpoint serveur qui retourne { signedUrl }. Défaut : /api/agent/signed-url */
  signedUrlEndpoint?: string;
  renderContext?: () => ReactNode;
  renderSidePanel?: () => ReactNode;
  children?: ReactNode;
}

export function ConversationShell({
  config,
  dynamicVariables,
  contextualUpdateText,
  signedUrlEndpoint = "/api/agent/signed-url",
  renderContext,
  renderSidePanel,
  children,
}: ConversationShellProps) {
  useDocumentTitle(`Coraly — ${config.title}`);
  const [announce, setAnnounce] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      <AccessibilityBar />
      <SiteHeader compact />
      <LiveRegion message={announce} />
      {error && <LiveRegion message={error} urgency="assertive" />}

      <main id="main" tabIndex={-1}>
        <ConversationProvider
          onConnect={() => setAnnounce("Connexion établie, vous pouvez parler.")}
          onDisconnect={() => setAnnounce("Conversation terminée.")}
          onError={(m) =>
            setError(typeof m === "string" ? m : "Erreur de communication")
          }
        >
          <ConversationInner
            config={config}
            dynamicVariables={dynamicVariables}
            contextualUpdateText={contextualUpdateText}
            signedUrlEndpoint={signedUrlEndpoint}
            announce={announce}
            setAnnounce={setAnnounce}
            error={error}
            setError={setError}
            renderContext={renderContext}
            renderSidePanel={renderSidePanel}
          >
            {children}
          </ConversationInner>
        </ConversationProvider>
      </main>

      <Footer />
    </>
  );
}

interface InnerProps {
  config: ConversationShellConfig;
  dynamicVariables: Record<string, string>;
  contextualUpdateText?: string;
  signedUrlEndpoint: string;
  announce: string;
  setAnnounce: (msg: string) => void;
  error: string | null;
  setError: (err: string | null) => void;
  renderContext?: () => ReactNode;
  renderSidePanel?: () => ReactNode;
  children?: ReactNode;
}

function ConversationInner({
  config,
  dynamicVariables,
  contextualUpdateText,
  signedUrlEndpoint,
  setAnnounce,
  error,
  setError,
  renderContext,
  renderSidePanel,
  children,
}: InnerProps) {
  const { startSession, endSession, sendUserMessage, sendContextualUpdate } =
    useConversationControls();
  const { status } = useConversationStatus();
  const { mode } = useConversationMode();

  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [textInput, setTextInput] = useState("");
  const { events: toolEvents, push: pushToolEvent } = useToolEvents();

  const dynamicVarsRef = useRef(dynamicVariables);
  useEffect(() => {
    dynamicVarsRef.current = dynamicVariables;
  }, [dynamicVariables]);

  const isActive = status === "connected";
  const isConnecting = status === "connecting";
  const isAgentSpeaking = mode === "speaking";
  const isAgentListening = isActive && !isAgentSpeaking;

  async function handleStart() {
    setError(null);
    setMessages([]);
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });

      const urlRes = await fetch(signedUrlEndpoint);
      if (!urlRes.ok) {
        const body = await urlRes.json().catch(() => ({}));
        throw new Error(
          (body as { error?: string }).error ?? `Erreur serveur (${urlRes.status})`
        );
      }
      const { signedUrl } = (await urlRes.json()) as { signedUrl: string };

      await startSession({
        signedUrl,
        dynamicVariables: dynamicVarsRef.current,
        onMessage: (m: { message: string; source: string }) => {
          setMessages((prev) => [
            ...prev,
            {
              role: m.source === "user" ? "user" : "agent",
              text: m.message,
              at: Date.now(),
            },
          ]);
        },
      });

      if (contextualUpdateText) {
        setTimeout(() => {
          try {
            sendContextualUpdate(contextualUpdateText);
          } catch (err) {
            console.error("[conversation] sendContextualUpdate failed:", err);
          }
        }, 500);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Impossible de démarrer la conversation."
      );
    }
  }

  function handleStop() {
    endSession();
  }

  function handleSendText() {
    const t = textInput.trim();
    if (!t || status !== "connected") return;
    sendUserMessage(t);
    setMessages((prev) => [...prev, { role: "user", text: t, at: Date.now() }]);
    setTextInput("");
  }

  const ctxValue: ShellContextValue = {
    pushToolEvent,
    setAnnounce,
    setError,
    messages,
    status,
    isActive,
  };

  return (
    <ShellContext.Provider value={ctxValue}>
      {children}

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {config.backHref && (
          <Link
            href={config.backHref}
            className="inline-block text-sm text-[var(--accent)] underline"
            aria-label={config.backLabel ?? "Retour"}
          >
            ← {config.backLabel ?? "Retour"}
          </Link>
        )}

        <header className="space-y-2">
          <h1 className="text-3xl font-bold flex items-center gap-2 flex-wrap">
            {config.title}
            {config.badge && (
              <span className="text-xs font-bold px-2 py-0.5 rounded bg-[var(--accent)] text-[var(--bg)]">
                {config.badge}
              </span>
            )}
          </h1>
          <p className="text-[var(--text-muted)]">{config.description}</p>
        </header>

        {renderContext?.()}

        <section
          aria-label={`Conversation avec l'assistante`}
          className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[var(--bg-surface)] to-[var(--bg)] border-2 border-[var(--border)] p-8"
        >
          <div className="flex flex-col items-center gap-6">
            <ConversationOrb
              status={status}
              isAgentSpeaking={isAgentSpeaking}
              isAgentListening={isAgentListening}
            />

            <StatusLabel
              status={status}
              isAgentSpeaking={isAgentSpeaking}
              agentName={config.agentName}
            />

            {!isActive && !isConnecting && (
              <button
                type="button"
                onClick={handleStart}
                aria-label={`Démarrer la conversation avec ${config.agentName}`}
                className="px-8 py-4 rounded-full bg-[var(--accent)] text-[var(--bg)] font-bold text-lg hover:bg-[var(--accent-hover)] transition-all hover:scale-105 shadow-lg"
              >
                🎤 Parler à {config.agentName}
              </button>
            )}

            {isActive && (
              <button
                type="button"
                onClick={handleStop}
                aria-label="Raccrocher"
                className="px-8 py-4 rounded-full bg-[var(--danger)] text-white font-bold text-lg hover:brightness-110 transition-all shadow-lg"
              >
                ⏹ Raccrocher
              </button>
            )}

            {error && (
              <p
                role="alert"
                className="p-3 rounded-lg bg-[var(--bg)] border-2 border-[var(--danger)] text-[var(--danger)] text-sm max-w-md"
              >
                {error}
              </p>
            )}
          </div>

          {toolEvents.length > 0 && (
            <div
              aria-live="polite"
              className="absolute bottom-4 left-4 right-4 flex flex-wrap gap-2 justify-center pointer-events-none"
            >
              {toolEvents.map((e: ToolEvent) => (
                <span
                  key={e.at}
                  className="px-3 py-1 rounded-full bg-[var(--bg-surface)] border border-[var(--accent)] text-[var(--accent)] text-xs font-semibold shadow-md animate-[fadeIn_0.3s_ease-out]"
                >
                  {e.label}
                </span>
              ))}
            </div>
          )}
        </section>

        {isActive && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendText();
            }}
            className="flex gap-2"
            aria-label="Envoyer un message texte à l'assistante"
          >
            <label htmlFor="text-fallback" className="sr-only">
              Message texte
            </label>
            <input
              id="text-fallback"
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Ou tapez si vous préférez…"
              className="flex-1 p-3 rounded-lg bg-[var(--bg-surface)] border-2 border-[var(--border)] text-[var(--text)] focus:border-[var(--accent)]"
            />
            <button
              type="submit"
              disabled={!textInput.trim()}
              className="px-4 py-3 rounded-lg bg-[var(--bg-surface)] border-2 border-[var(--accent)] text-[var(--accent)] font-semibold disabled:opacity-50"
            >
              Envoyer
            </button>
          </form>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          <section
            aria-label="Transcription de la conversation"
            className="p-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] min-h-[280px] max-h-[500px] overflow-y-auto"
          >
            <h2 className="text-lg font-bold mb-3 sticky top-0 bg-[var(--bg-surface)] pb-2 border-b border-[var(--border)]">
              💬 Conversation
            </h2>
            {messages.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)] italic">
                La conversation apparaîtra ici en temps réel.
              </p>
            ) : (
              <ul className="space-y-2">
                {messages.map((m, i) => (
                  <li
                    key={`${m.at}-${i}`}
                    className={`p-3 rounded-lg text-sm animate-[fadeIn_0.2s_ease-out] ${
                      m.role === "user"
                        ? "bg-[var(--bg)] border border-[var(--border)] ml-6"
                        : "bg-[var(--accent)]/10 border border-[var(--accent)] mr-6"
                    }`}
                  >
                    <span
                      className="text-xs font-bold uppercase text-[var(--text-muted)]"
                      aria-hidden="true"
                    >
                      {m.role === "user" ? "Vous" : config.agentName}
                    </span>
                    <p className="mt-1">{m.text}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {renderSidePanel?.()}
        </div>

        {config.hintText && (
          <p className="text-xs text-[var(--text-muted)] text-center">
            💡 {config.hintText}
          </p>
        )}
      </div>
    </ShellContext.Provider>
  );
}
