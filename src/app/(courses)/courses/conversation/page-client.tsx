"use client";

import { useEffect, useRef, useState } from "react";
import {
  useConversationClientTool,
  useConversationControls,
} from "@elevenlabs/react";
import { ConversationShell, useShellContext } from "@/lib/conversation";
import { InstallExtensionBanner } from "@/components/install-extension-banner";
import { sendListToExtension, useExtension } from "@/lib/extension/use-extension";
import { usePreferences } from "@/lib/preferences/use-preferences";
import { useOrderHistory } from "@/lib/history/use-order-history";
import type { CarrefourProduct, CarrefourStore } from "@/lib/carrefour/types";

function safeLocalGet(key: string): string {
  try {
    return localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

interface AgentCartItem {
  ean: string;
  title: string;
  quantity: number;
  price: number;
}

function computeDaysAgo(dateStr: string): string {
  const ms = Date.now() - new Date(dateStr).getTime();
  return String(Math.round(ms / (24 * 60 * 60 * 1000)));
}

export default function ConversationPageClient() {
  const extension = useExtension();
  const { prefs } = usePreferences();
  const history = useOrderHistory();
  const [storeName, setStoreName] = useState<string | null>(() =>
    typeof window !== "undefined" ? localStorage.getItem("storeName") : null
  );
  const [cart, setCart] = useState<AgentCartItem[]>([]);

  const dynamicVariables = {
    store_name: storeName || "non sélectionné",
    store_ref: typeof window !== "undefined" ? safeLocalGet("storeRef") : "",
    extension_installed: extension.installed ? "oui" : "non",
    diet: prefs.diet.length > 0 ? prefs.diet.join(", ") : "aucun",
    allergens:
      prefs.allergens.length > 0 ? prefs.allergens.join(", ") : "aucun",
    last_order_count: history.lastEntry
      ? String(history.lastEntry.count)
      : "0",
    last_order_days_ago: history.lastEntry
      ? computeDaysAgo(history.lastEntry.at)
      : "",
    last_order_list: history.lastEntry ? history.lastEntry.listText : "",
  };

  const totalCart = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const articleCount = cart.reduce((n, i) => n + i.quantity, 0);

  return (
    <ConversationShell
      config={{
        title: "Mode conversation",
        description:
          "Parlez à Koraly comme à un humain. Elle cherche vos produits, répond à vos questions, et remplit votre panier Carrefour.",
        agentName: "Koraly",
        badge: "BETA",
        hintText:
          "Koraly peut chercher des produits, donner leurs détails (Nutriscore, ingrédients), gérer votre liste, et transférer votre panier. Dites « c\u2019est bon » quand vous avez terminé.",
        backHref: "/",
        backLabel: "Accueil Coraly",
      }}
      dynamicVariables={dynamicVariables}
      contextualUpdateText={`Contexte session : magasin=${dynamicVariables.store_name}, extension=${dynamicVariables.extension_installed}, régime=${dynamicVariables.diet}`}
      renderContext={() => (
        <>
          <InstallExtensionBanner />
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
        </>
      )}
      renderSidePanel={() => (
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
      )}
    >
      <CoursesClientTools
        cart={cart}
        setCart={setCart}
        storeName={storeName}
        setStoreName={setStoreName}
        extension={extension}
        prefs={prefs}
        history={history}
      />
    </ConversationShell>
  );
}

function CoursesClientTools({
  cart,
  setCart,
  setStoreName,
  extension,
  prefs,
  history,
}: {
  cart: AgentCartItem[];
  setCart: React.Dispatch<React.SetStateAction<AgentCartItem[]>>;
  storeName: string | null;
  setStoreName: (name: string | null) => void;
  extension: ReturnType<typeof useExtension>;
  prefs: ReturnType<typeof usePreferences>["prefs"];
  history: ReturnType<typeof useOrderHistory>;
}) {
  const { pushToolEvent, setAnnounce } = useShellContext();
  const { endSession } = useConversationControls();

  const cartRef = useRef<AgentCartItem[]>([]);
  useEffect(() => {
    cartRef.current = cart;
  }, [cart]);

  useConversationClientTool(
    "search_product",
    async (params: Record<string, unknown>): Promise<string> => {
      const query =
        typeof params.query === "string" ? params.query.trim() : "";
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
      const quantity =
        typeof params.quantity === "number" ? params.quantity : 1;
      const price = typeof params.price === "number" ? params.price : 0;
      if (!ean || !title)
        return JSON.stringify({ error: "ean et title requis" });
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
      const cp =
        typeof params.postal_code === "string" ? params.postal_code : "";
      if (!/^\d{5}$/.test(cp))
        return JSON.stringify({ error: "Code postal invalide" });
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
      const storeRef =
        typeof params.store_ref === "string" ? params.store_ref : "";
      const name =
        typeof params.store_name === "string" ? params.store_name : "";
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
          if (data.basketServiceId)
            localStorage.setItem("basketServiceId", data.basketServiceId);
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
    if (!history.lastEntry)
      return JSON.stringify({ error: "Aucune commande précédente." });
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
    if (items.length === 0)
      return JSON.stringify({ error: "Panier vide." });
    if (!extension.installed || !extension.extensionId) {
      return JSON.stringify({
        error: "Extension Coraly non installée.",
        action: "install_extension_needed",
      });
    }
    const storeRef =
      typeof window !== "undefined"
        ? localStorage.getItem("storeRef")
        : null;
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
      title: `${items.length} produits · Coraly conversation`,
      returnUrl:
        typeof window !== "undefined" ? window.location.origin : undefined,
    });
    if (!result.ok)
      return JSON.stringify({ error: `Erreur envoi : ${result.error}` });
    setAnnounce("Panier transféré à l'extension.");
    return JSON.stringify({
      success: true,
      message: "Panier envoyé à l'extension.",
    });
  });

  useConversationClientTool("end_conversation", (): string => {
    setAnnounce("Conversation terminée.");
    setTimeout(() => endSession(), 1500);
    return JSON.stringify({ success: true });
  });

  return null;
}
