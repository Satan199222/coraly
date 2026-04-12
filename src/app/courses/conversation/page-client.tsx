"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Script from "next/script";
import { AccessibilityBar } from "@/components/accessibility-bar";
import { LiveRegion } from "@/components/live-region";
import { Footer } from "@/components/footer";
import { InstallExtensionBanner } from "@/components/install-extension-banner";
import { useDocumentTitle } from "@/lib/useDocumentTitle";
import { sendListToExtension, useExtension } from "@/lib/extension/use-extension";
import { usePreferences } from "@/lib/preferences/use-preferences";
import { useOrderHistory } from "@/lib/history/use-order-history";
import type { CarrefourProduct, CarrefourStore } from "@/lib/carrefour/types";

/**
 * Mode Conversation — widget officiel ElevenLabs Agents.
 *
 * Décisions :
 * - On n'utilise PAS le SDK React (useConversation) : le widget officiel
 *   expose déjà une UI complète (orb animé, micro, transcript), gère audio
 *   + auth + reconnect. Moins de code, comportement conforme aux best
 *   practices ElevenLabs.
 * - Le prompt système est géré dans le dashboard ElevenLabs (Julien peut
 *   l'itérer sans déployer). Côté code, juste l'agent_id + les client tools.
 * - Les client tools sont enregistrés sur `window.elevenlabsConvai.clientTools`
 *   AVANT le chargement du script widget pour être pris en compte.
 * - Autour du widget : une UI légère pour le contexte (magasin + extension
 *   + panier) et un lien retour. Le widget lui-même gère tout le dialogue.
 */

declare global {
  interface Window {
    elevenlabsConvai?: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      clientTools?: Record<string, (params: any) => Promise<unknown> | unknown>;
    };
  }
}

// Cast pour utiliser le custom element `<elevenlabs-convai>` en JSX sans
// avoir à étendre JSX.IntrinsicElements (incompatible Next 16 + React 19).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ConvaiWidget = "elevenlabs-convai" as any;

const AGENT_ID =
  process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID ||
  "agent_5901kp17epppfa9rkqvdqfw0bh5p";

interface CartItem {
  ean: string;
  title: string;
  quantity: number;
  price: number;
}

export default function ConversationPageClient() {
  useDocumentTitle("VoixCourses — Mode conversation");

  const extension = useExtension();
  const { prefs } = usePreferences();
  const history = useOrderHistory();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [storeName, setStoreName] = useState<string | null>(null);
  const [announce, setAnnounce] = useState("");

  const cartRef = useRef<CartItem[]>([]);
  useEffect(() => {
    cartRef.current = cart;
  }, [cart]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setStoreName(localStorage.getItem("storeName"));
    }
  }, []);

  // Enregistrement des client tools AVANT que le script widget se charge.
  // ElevenLabs lit window.elevenlabsConvai.clientTools au moment de la
  // connexion — on doit donc poser les handlers ici, au mount, avant <Script>.
  useEffect(() => {
    if (typeof window === "undefined") return;

    window.elevenlabsConvai = window.elevenlabsConvai || {};
    window.elevenlabsConvai.clientTools = {
      async search_product(params: { query?: string; quantity?: number }) {
        const q = params.query?.trim();
        if (!q) return { error: "query manquant" };
        const urlParams = new URLSearchParams({ q });
        if (prefs.diet.length > 0) urlParams.set("diet", prefs.diet.join(","));
        try {
          const res = await fetch(`/api/search?${urlParams}`);
          if (!res.ok) return { error: `HTTP ${res.status}` };
          const data = await res.json();
          const products: CarrefourProduct[] = data.products ?? [];
          return {
            products: products.slice(0, 3).map((p) => ({
              ean: p.ean,
              title: p.title,
              price: p.price,
              brand: p.brand,
              packaging: p.packaging,
            })),
            total: data.total ?? 0,
          };
        } catch (err) {
          return {
            error: err instanceof Error ? err.message : "fetch failed",
          };
        }
      },

      add_to_cart(params: {
        ean: string;
        title: string;
        quantity?: number;
        price?: number;
      }) {
        const { ean, title, quantity = 1, price = 0 } = params;
        if (!ean || !title) return { error: "ean et title requis" };
        setCart((prev) => {
          const existing = prev.find((i) => i.ean === ean);
          if (existing) {
            return prev.map((i) =>
              i.ean === ean ? { ...i, quantity: i.quantity + quantity } : i
            );
          }
          return [...prev, { ean, title, quantity, price }];
        });
        return { success: true };
      },

      remove_from_cart(params: { ean: string }) {
        setCart((prev) => prev.filter((i) => i.ean !== params.ean));
        return { success: true };
      },

      get_cart_summary() {
        const items = cartRef.current;
        const total = items.reduce(
          (s, i) => s + (i.price ?? 0) * i.quantity,
          0
        );
        return {
          count: items.length,
          articles: items.reduce((n, i) => n + i.quantity, 0),
          total_euros: Math.round(total * 100) / 100,
          items: items.map((i) => ({
            title: i.title,
            quantity: i.quantity,
            price: i.price,
          })),
        };
      },

      get_user_context() {
        const storeRef =
          typeof window !== "undefined"
            ? localStorage.getItem("storeRef")
            : null;
        const sName =
          typeof window !== "undefined"
            ? localStorage.getItem("storeName")
            : null;
        return {
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
        };
      },

      async list_stores_by_postal_code(params: { postal_code: string }) {
        const cp = params.postal_code;
        if (!/^\d{5}$/.test(cp)) {
          return { error: "Code postal invalide (5 chiffres)" };
        }
        try {
          const res = await fetch(`/api/stores?postalCode=${cp}`);
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            return { error: err.error ?? `HTTP ${res.status}` };
          }
          const data = await res.json();
          const stores: CarrefourStore[] = data.stores ?? [];
          return {
            stores: stores.slice(0, 5).map((s) => ({
              ref: s.ref,
              name: s.name,
              format: s.format,
              distance_km: s.distance,
            })),
          };
        } catch (err) {
          return {
            error: err instanceof Error ? err.message : "fetch failed",
          };
        }
      },

      async select_store(params: { store_ref: string; store_name?: string }) {
        const { store_ref: storeRef, store_name: name } = params;
        if (!storeRef) return { error: "store_ref requis" };
        try {
          const res = await fetch("/api/stores", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ storeRef }),
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            return { error: err.error ?? `HTTP ${res.status}` };
          }
          const data = await res.json();
          if (typeof window !== "undefined") {
            localStorage.setItem("storeRef", storeRef);
            if (data.basketServiceId) {
              localStorage.setItem("basketServiceId", data.basketServiceId);
            }
            if (name) localStorage.setItem("storeName", name);
          }
          setStoreName(name || null);
          return { success: true, store_name: name };
        } catch (err) {
          return {
            error: err instanceof Error ? err.message : "fetch failed",
          };
        }
      },

      get_last_order() {
        if (!history.lastEntry) {
          return { error: "Aucune commande précédente." };
        }
        return {
          list_text: history.lastEntry.listText,
          count: history.lastEntry.count,
          total: history.lastEntry.total,
          days_ago: Math.round(
            (Date.now() - new Date(history.lastEntry.at).getTime()) /
              (24 * 60 * 60 * 1000)
          ),
        };
      },

      async finalize_cart() {
        const items = cartRef.current;
        if (items.length === 0) return { error: "Panier vide." };
        if (!extension.installed || !extension.extensionId) {
          return {
            error:
              "Extension VoixCourses non installée. Invitez l'utilisateur à l'installer sur voixcourses.vercel.app slash installer.",
            action: "install_extension_needed",
          };
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
          return {
            error: "Aucun magasin sélectionné.",
            action: "select_store_needed",
          };
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
        if (!result.ok) return { error: `Erreur envoi : ${result.error}` };
        setAnnounce("Panier transféré à l'extension.");
        return {
          success: true,
          message: "Panier envoyé à l'extension.",
        };
      },
    };
  }, [extension, prefs, history]);

  const totalCart = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const articleCount = cart.reduce((n, i) => n + i.quantity, 0);

  return (
    <>
      <AccessibilityBar />
      <LiveRegion message={announce} />

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
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
            Cliquez sur l&apos;assistante en bas à droite de l&apos;écran et
            parlez-lui comme à un humain. Elle cherche vos produits, pose des
            questions, et remplit votre panier.
          </p>
        </header>

        <InstallExtensionBanner />

        {/* Contexte visible — aide l'utilisateur à vérifier avant de démarrer */}
        <div
          className="flex gap-3 flex-wrap text-sm"
          aria-label="Contexte actuel"
        >
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
              : "Aucun magasin — l'assistante vous aidera à en choisir un"}
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

        {/* Panier en cours — alimenté par les client tools */}
        <section
          aria-label="Panier en cours de constitution"
          className="p-4 rounded-lg bg-[var(--bg-surface)] border-2 border-[var(--accent)]"
          aria-live="polite"
        >
          <h2 className="text-lg font-bold mb-2">
            Panier ({articleCount} article{articleCount !== 1 ? "s" : ""})
          </h2>
          {cart.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">
              Votre panier est vide. L&apos;assistante ajoutera les produits au
              fur et à mesure de la conversation.
            </p>
          ) : (
            <>
              <ul className="space-y-1 text-sm">
                {cart.map((item) => (
                  <li key={item.ean} className="flex justify-between">
                    <span>
                      {item.quantity}× {item.title}
                    </span>
                    <span className="font-semibold">
                      {(item.price * item.quantity).toFixed(2)}€
                    </span>
                  </li>
                ))}
              </ul>
              <div className="flex justify-between font-bold mt-2 pt-2 border-t border-[var(--border)]">
                <span>Total</span>
                <span className="text-[var(--accent)]">
                  {totalCart.toFixed(2)}€
                </span>
              </div>
            </>
          )}
        </section>

        <p className="text-xs text-[var(--text-muted)]">
          💡 Prononcez clairement. Pour terminer, dites « c&apos;est bon »
          ou « termine » et l&apos;assistante transférera votre panier à
          Carrefour.
        </p>
      </div>

      <Footer />

      {/* Widget ElevenLabs — pastille flottante bottom-right. Le script init
          se lance après le montage. Les client tools sont enregistrés sur
          window.elevenlabsConvai via useEffect ci-dessus. */}
      <ConvaiWidget
        agent-id={AGENT_ID}
        action-text="Parlez à l'assistante"
        start-call-text="Démarrer la conversation"
        end-call-text="Arrêter"
        listening-text="Je vous écoute…"
        speaking-text="Je vous réponds…"
      />
      <Script
        src="https://unpkg.com/@elevenlabs/convai-widget-embed"
        strategy="lazyOnload"
        async
      />
    </>
  );
}
