"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ConversationProvider,
  useConversationControls,
  useConversationStatus,
  useConversationMode,
  useConversationClientTool,
} from "@elevenlabs/react";
import { AccessibilityBar } from "@/components/accessibility-bar";
import { SiteHeader } from "@/components/site-header";
import { LiveRegion } from "@/components/live-region";
import { Footer } from "@/components/footer";
import { InstallExtensionBanner } from "@/components/install-extension-banner";
import { useDocumentTitle } from "@/lib/useDocumentTitle";
import { sendListToExtension, useExtension } from "@/lib/extension/use-extension";
import { usePreferences } from "@/lib/preferences/use-preferences";
import { useOrderHistory } from "@/lib/history/use-order-history";
import type { CarrefourProduct, CarrefourStore } from "@/lib/carrefour/types";

/**
 * Mode Conversation — UI custom avec SDK React ElevenLabs.
 *
 * Design objectif :
 * - Orb centrale animée qui réagit au statut (idle, connecting, listening,
 *   speaking) via classes CSS conditionnelles + scale/pulse
 * - Transcript temps réel en colonne droite (bulles user/agent)
 * - Panier live en colonne gauche (réagit aux tool calls)
 * - Contexte visible en haut (magasin, extension)
 * - Bouton principal gros et clair (démarrer / raccrocher)
 * - Fallback texte pour environnement bruyant ou accessibilité
 *
 * Pattern : ConversationProvider wrap + hooks granulaires. Pas de widget.
 * Client tools enregistrés via useConversationClientTool (closure toujours
 * fraîche grâce au ref pattern interne du SDK).
 */

const AGENT_ID =
  process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID ||
  "agent_5901kp17epppfa9rkqvdqfw0bh5p";

interface AgentCartItem {
  ean: string;
  title: string;
  quantity: number;
  price: number;
}

interface Message {
  role: "user" | "agent";
  text: string;
  at: number;
}

interface ToolEvent {
  name: string;
  label: string;
  at: number;
}

export default function ConversationPageClient() {
  useDocumentTitle("VoixCourses — Mode conversation");
  const [announce, setAnnounce] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      <AccessibilityBar />
      <SiteHeader compact />
      <LiveRegion message={announce} />
      {error && <LiveRegion message={error} urgency="assertive" />}

      <ConversationProvider
        onConnect={() => setAnnounce("Connexion établie, vous pouvez parler.")}
        onDisconnect={() => setAnnounce("Conversation terminée.")}
        onError={(m) =>
          setError(typeof m === "string" ? m : "Erreur de communication")
        }
      >
        <ConversationExperience
          setAnnounce={setAnnounce}
          error={error}
          setError={setError}
        />
      </ConversationProvider>

      <Footer />
    </>
  );
}

interface UIProps {
  setAnnounce: (msg: string) => void;
  error: string | null;
  setError: (err: string | null) => void;
}

function ConversationExperience({ setAnnounce, error, setError }: UIProps) {
  const extension = useExtension();
  const { prefs } = usePreferences();
  const history = useOrderHistory();
  const { startSession, endSession, sendUserMessage, sendContextualUpdate } =
    useConversationControls();
  const { status } = useConversationStatus();
  const { mode } = useConversationMode();

  const [messages, setMessages] = useState<Message[]>([]);
  const [toolEvents, setToolEvents] = useState<ToolEvent[]>([]);
  const [cart, setCart] = useState<AgentCartItem[]>([]);
  const [textInput, setTextInput] = useState("");
  const [storeName, setStoreName] = useState<string | null>(null);

  const cartRef = useRef<AgentCartItem[]>([]);
  useEffect(() => {
    cartRef.current = cart;
  }, [cart]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setStoreName(localStorage.getItem("storeName"));
    }
  }, []);

  // Push un petit badge d'événement tool pour feedback UX (disparaît après 4s)
  function pushToolEvent(name: string, label: string) {
    const ev = { name, label, at: Date.now() };
    setToolEvents((prev) => [...prev.slice(-4), ev]);
    setTimeout(() => {
      setToolEvents((prev) => prev.filter((e) => e.at !== ev.at));
    }, 4000);
  }

  // ── CLIENT TOOLS ──────────────────────────────────────────────────────────

  useConversationClientTool(
    "search_product",
    async (params: Record<string, unknown>): Promise<string> => {
      const query = typeof params.query === "string" ? params.query.trim() : "";
      if (!query) return JSON.stringify({ error: "query manquant" });
      pushToolEvent("search", `🔍 ${query}`);
      const urlParams = new URLSearchParams({ q: query });
      if (prefs.diet.length > 0) urlParams.set("diet", prefs.diet.join(","));
      try {
        const res = await fetch(`/api/search?${urlParams}`);
        if (!res.ok) return JSON.stringify({ error: `HTTP ${res.status}` });
        const data = await res.json();
        const products: CarrefourProduct[] = data.products ?? [];
        return JSON.stringify({
          products: products.slice(0, 3).map((p) => ({
            ean: p.ean,
            title: p.title,
            price: p.price,
            brand: p.brand,
            packaging: p.packaging,
          })),
          total: data.total ?? 0,
        });
      } catch (err) {
        return JSON.stringify({
          error: err instanceof Error ? err.message : "fetch failed",
        });
      }
    }
  );

  useConversationClientTool(
    "get_product_details",
    async (params: Record<string, unknown>): Promise<string> => {
      const ean = typeof params.ean === "string" ? params.ean : "";
      if (!ean) return JSON.stringify({ error: "ean requis" });
      pushToolEvent("details", `📋 Détails`);
      try {
        const res = await fetch(`/api/product/details?ean=${ean}`);
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          return JSON.stringify({ error: err.error ?? `HTTP ${res.status}` });
        }
        return JSON.stringify(await res.json());
      } catch (err) {
        return JSON.stringify({
          error: err instanceof Error ? err.message : "fetch failed",
        });
      }
    }
  );

  useConversationClientTool(
    "add_to_cart",
    (params: Record<string, unknown>): string => {
      const ean = typeof params.ean === "string" ? params.ean : "";
      const title = typeof params.title === "string" ? params.title : "";
      const quantity = typeof params.quantity === "number" ? params.quantity : 1;
      const price = typeof params.price === "number" ? params.price : 0;
      if (!ean || !title) return JSON.stringify({ error: "ean et title requis" });
      pushToolEvent("add", `✅ ${title}`);
      setCart((prev) => {
        const existing = prev.find((i) => i.ean === ean);
        if (existing) {
          return prev.map((i) =>
            i.ean === ean ? { ...i, quantity: i.quantity + quantity } : i
          );
        }
        return [...prev, { ean, title, quantity, price }];
      });
      return JSON.stringify({ success: true });
    }
  );

  useConversationClientTool(
    "remove_from_cart",
    (params: Record<string, unknown>): string => {
      const ean = typeof params.ean === "string" ? params.ean : "";
      pushToolEvent("remove", "❌ Retiré");
      setCart((prev) => prev.filter((i) => i.ean !== ean));
      return JSON.stringify({ success: true });
    }
  );

  useConversationClientTool("get_cart_summary", (): string => {
    pushToolEvent("summary", "📊 Récap panier");
    const items = cartRef.current;
    const total = items.reduce((s, i) => s + (i.price ?? 0) * i.quantity, 0);
    return JSON.stringify({
      count: items.length,
      articles: items.reduce((n, i) => n + i.quantity, 0),
      total_euros: Math.round(total * 100) / 100,
      items: items.map((i) => ({
        title: i.title,
        quantity: i.quantity,
        price: i.price,
      })),
    });
  });

  useConversationClientTool("get_user_context", (): string => {
    const storeRef =
      typeof window !== "undefined" ? localStorage.getItem("storeRef") : null;
    const sName =
      typeof window !== "undefined" ? localStorage.getItem("storeName") : null;
    return JSON.stringify({
      store: storeRef ? { ref: storeRef, name: sName } : null,
      extension_installed: extension.installed,
      diet: prefs.diet,
      allergens: prefs.allergens,
      last_order: history.lastEntry
        ? {
            count: history.lastEntry.count,
            total: history.lastEntry.total,
            list_text: history.lastEntry.listText,
            days_ago: Math.round(
              (Date.now() - new Date(history.lastEntry.at).getTime()) /
                (24 * 60 * 60 * 1000)
            ),
          }
        : null,
    });
  });

  useConversationClientTool(
    "list_stores_by_postal_code",
    async (params: Record<string, unknown>): Promise<string> => {
      const cp = typeof params.postal_code === "string" ? params.postal_code : "";
      if (!/^\d{5}$/.test(cp)) return JSON.stringify({ error: "Code postal invalide" });
      pushToolEvent("stores", `📍 ${cp}`);
      try {
        const res = await fetch(`/api/stores?postalCode=${cp}`);
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          return JSON.stringify({ error: err.error ?? `HTTP ${res.status}` });
        }
        const data = await res.json();
        const stores: CarrefourStore[] = data.stores ?? [];
        return JSON.stringify({
          stores: stores.slice(0, 5).map((s) => ({
            ref: s.ref,
            name: s.name,
            format: s.format,
            distance_km: s.distance,
          })),
        });
      } catch (err) {
        return JSON.stringify({
          error: err instanceof Error ? err.message : "fetch failed",
        });
      }
    }
  );

  useConversationClientTool(
    "select_store",
    async (params: Record<string, unknown>): Promise<string> => {
      const storeRef = typeof params.store_ref === "string" ? params.store_ref : "";
      const name = typeof params.store_name === "string" ? params.store_name : "";
      if (!storeRef) return JSON.stringify({ error: "store_ref requis" });
      pushToolEvent("selectStore", `🏬 ${name || storeRef}`);
      try {
        const res = await fetch("/api/stores", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ storeRef }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          return JSON.stringify({ error: err.error ?? `HTTP ${res.status}` });
        }
        const data = await res.json();
        if (typeof window !== "undefined") {
          localStorage.setItem("storeRef", storeRef);
          if (data.basketServiceId) localStorage.setItem("basketServiceId", data.basketServiceId);
          if (name) localStorage.setItem("storeName", name);
        }
        setStoreName(name || null);
        return JSON.stringify({ success: true, store_name: name });
      } catch (err) {
        return JSON.stringify({
          error: err instanceof Error ? err.message : "fetch failed",
        });
      }
    }
  );

  useConversationClientTool("get_last_order", (): string => {
    if (!history.lastEntry) return JSON.stringify({ error: "Aucune commande précédente." });
    return JSON.stringify({
      list_text: history.lastEntry.listText,
      count: history.lastEntry.count,
      total: history.lastEntry.total,
      days_ago: Math.round(
        (Date.now() - new Date(history.lastEntry.at).getTime()) /
          (24 * 60 * 60 * 1000)
      ),
    });
  });

  useConversationClientTool("finalize_cart", async (): Promise<string> => {
    pushToolEvent("finalize", "🚀 Transfert...");
    const items = cartRef.current;
    if (items.length === 0) return JSON.stringify({ error: "Panier vide." });
    if (!extension.installed || !extension.extensionId) {
      return JSON.stringify({
        error: "Extension VoixCourses non installée.",
        action: "install_extension_needed",
      });
    }
    const storeRef =
      typeof window !== "undefined" ? localStorage.getItem("storeRef") : null;
    const basketServiceId =
      typeof window !== "undefined"
        ? localStorage.getItem("basketServiceId")
        : null;
    if (!storeRef || !basketServiceId) {
      return JSON.stringify({
        error: "Aucun magasin sélectionné.",
        action: "select_store_needed",
      });
    }
    const result = await sendListToExtension(extension.extensionId, {
      storeRef,
      basketServiceId,
      items: items.map((i) => ({
        ean: i.ean,
        quantity: i.quantity,
        title: i.title,
        price: i.price,
      })),
      title: `${items.length} produits · VoixCourses conversation`,
      returnUrl:
        typeof window !== "undefined" ? window.location.origin : undefined,
    });
    if (!result.ok) return JSON.stringify({ error: `Erreur envoi : ${result.error}` });
    setAnnounce("Panier transféré à l'extension.");
    return JSON.stringify({ success: true, message: "Panier envoyé à l'extension." });
  });

  useConversationClientTool("end_conversation", (): string => {
    setAnnounce("Conversation terminée.");
    // Laisse l'agent dire au revoir puis termine doucement
    setTimeout(() => endSession(), 1500);
    return JSON.stringify({ success: true });
  });

  // ── Handlers ─────────────────────────────────────────────────────────────

  const dynamicVariables = useMemo(
    () => ({
      store_name: storeName || "non sélectionné",
      store_ref:
        (typeof window !== "undefined" && localStorage.getItem("storeRef")) ||
        "",
      extension_installed: extension.installed ? "oui" : "non",
      diet: prefs.diet.length > 0 ? prefs.diet.join(", ") : "aucun",
      allergens:
        prefs.allergens.length > 0 ? prefs.allergens.join(", ") : "aucun",
      last_order_count: history.lastEntry ? String(history.lastEntry.count) : "0",
      last_order_days_ago: history.lastEntry
        ? String(
            Math.round(
              // eslint-disable-next-line react-hooks/purity -- Date.now() dans useMemo, recalculé aux changements de lastEntry, précision "jours" suffisante pour l'agent
              (Date.now() - new Date(history.lastEntry.at).getTime()) /
                (24 * 60 * 60 * 1000)
            )
          )
        : "",
      last_order_list: history.lastEntry ? history.lastEntry.listText : "",
    }),
    [storeName, extension.installed, prefs.diet, prefs.allergens, history.lastEntry]
  );

  async function handleStart() {
    setError(null);
    setMessages([]);
    setToolEvents([]);
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      await startSession({
        agentId: AGENT_ID,
        dynamicVariables,
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
      // Push context une fois connecté
      setTimeout(() => {
        try {
          sendContextualUpdate(
            `Contexte session : magasin=${dynamicVariables.store_name}, extension=${dynamicVariables.extension_installed}, régime=${dynamicVariables.diet}`
          );
        } catch {}
      }, 500);
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

  const isActive = status === "connected";
  const isConnecting = status === "connecting";
  const isAgentSpeaking = mode === "speaking";
  const isAgentListening = isActive && !isAgentSpeaking;

  const totalCart = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const articleCount = cart.reduce((n, i) => n + i.quantity, 0);

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      <Link
        href="/"
        className="inline-block text-sm text-[var(--accent)] underline"
        aria-label="Retour à l'accueil VoixCourses"
      >
        ← Accueil VoixCourses
      </Link>

      <header className="space-y-2">
        <h1 className="text-3xl font-bold flex items-center gap-2 flex-wrap">
          Mode conversation
          <span className="text-xs font-bold px-2 py-0.5 rounded bg-[var(--accent)] text-[var(--bg)]">
            BETA
          </span>
        </h1>
        <p className="text-[var(--text-muted)]">
          Parlez à Koraly comme à un humain. Elle cherche vos produits, répond
          à vos questions, et remplit votre panier Carrefour.
        </p>
      </header>

      <InstallExtensionBanner />

      {/* Contexte actuel */}
      <div className="flex gap-3 flex-wrap text-sm">
        <span
          className={`px-3 py-1.5 rounded-lg ${
            storeName
              ? "bg-[var(--bg-surface)] border border-[var(--border)]"
              : "bg-[var(--bg-surface)] border-2 border-[var(--accent)]"
          }`}
        >
          📍{" "}
          {storeName
            ? `Magasin : ${storeName}`
            : "Aucun magasin — Koraly vous aidera à en choisir un"}
        </span>
        {extension.installed ? (
          <span className="px-3 py-1.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--success)] text-[var(--success)]">
            ✓ Extension OK
          </span>
        ) : (
          <span className="px-3 py-1.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--accent)] text-[var(--accent)]">
            ⚠ Extension absente
          </span>
        )}
      </div>

      {/* ═══ SCÈNE PRINCIPALE : Orb + contrôles ═══ */}
      <section
        aria-label="Conversation avec l'assistante"
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[var(--bg-surface)] to-[var(--bg)] border-2 border-[var(--border)] p-8"
      >
        {/* Orb central animé */}
        <div className="flex flex-col items-center gap-6">
          <ConversationOrb
            status={status}
            isAgentSpeaking={isAgentSpeaking}
            isAgentListening={isAgentListening}
          />

          <StatusLabel status={status} isAgentSpeaking={isAgentSpeaking} />

          {!isActive && !isConnecting && (
            <button
              type="button"
              onClick={handleStart}
              aria-label="Démarrer la conversation avec Koraly"
              className="px-8 py-4 rounded-full bg-[var(--accent)] text-[var(--bg)] font-bold text-lg hover:bg-[var(--accent-hover)] transition-all hover:scale-105 shadow-lg"
            >
              🎤 Parler à Koraly
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

        {/* Tool events : badges éphémères en bas */}
        {toolEvents.length > 0 && (
          <div
            aria-live="polite"
            className="absolute bottom-4 left-4 right-4 flex flex-wrap gap-2 justify-center pointer-events-none"
          >
            {toolEvents.map((e) => (
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

      {/* Fallback texte quand active */}
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

      {/* ═══ SPLIT : transcript + panier ═══ */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Transcript */}
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
                    {m.role === "user" ? "Vous" : "Koraly"}
                  </span>
                  <p className="mt-1">{m.text}</p>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Panier live */}
        <section
          aria-label="Panier en cours de constitution"
          aria-live="polite"
          className="p-4 rounded-xl bg-[var(--bg-surface)] border-2 border-[var(--accent)] min-h-[280px]"
        >
          <h2 className="text-lg font-bold mb-3 sticky top-0 bg-[var(--bg-surface)] pb-2 border-b border-[var(--border)]">
            🛒 Panier ({articleCount} article{articleCount !== 1 ? "s" : ""})
          </h2>
          {cart.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)] italic">
              Le panier se remplira au fur et à mesure de la conversation.
            </p>
          ) : (
            <>
              <ul className="space-y-2">
                {cart.map((item) => (
                  <li
                    key={item.ean}
                    className="flex justify-between items-start gap-3 text-sm animate-[fadeIn_0.2s_ease-out] pb-2 border-b border-[var(--border)]/50"
                  >
                    <span>
                      <strong>{item.quantity}×</strong> {item.title}
                    </span>
                    <span className="font-semibold text-[var(--accent)] shrink-0">
                      {(item.price * item.quantity).toFixed(2)}€
                    </span>
                  </li>
                ))}
              </ul>
              <div className="flex justify-between items-center font-bold mt-3 pt-2">
                <span>Total</span>
                <span className="text-[var(--accent)] text-xl">
                  {totalCart.toFixed(2)}€
                </span>
              </div>
            </>
          )}
        </section>
      </div>

      <p className="text-xs text-[var(--text-muted)] text-center">
        💡 Koraly peut chercher des produits, donner leurs détails (Nutriscore,
        ingrédients), gérer votre liste, et transférer votre panier. Dites
        « c&apos;est bon » quand vous avez terminé.
      </p>
    </div>
  );
}

/**
 * Orb animé réactif. Plusieurs états avec des animations CSS distinctes :
 * - disconnected : orb statique bleu-gris
 * - connecting : orb pulse doux
 * - listening : orb "respire" (scale 1 ↔ 1.05)
 * - speaking : orb vibre avec halo
 */
function ConversationOrb({
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
      {/* Halo externe quand speaking */}
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

function StatusLabel({
  status,
  isAgentSpeaking,
}: {
  status: string;
  isAgentSpeaking: boolean;
}) {
  const label =
    status === "disconnected"
      ? "Prêt à démarrer"
      : status === "connecting"
        ? "Connexion en cours…"
        : isAgentSpeaking
          ? "Koraly parle…"
          : "Koraly vous écoute — parlez !";

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
