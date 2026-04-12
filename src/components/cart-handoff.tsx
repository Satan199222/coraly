"use client";

import { useState } from "react";
import type { Cart, DeliverySlot } from "@/lib/carrefour/types";
import {
  generateBookmarklet,
  generateReadableScript,
  type BookmarkletPayload,
} from "@/lib/bookmarklet/generate";

interface CartHandoffProps {
  cart: Cart | null;
  slot: DeliverySlot | null;
  storeRef: string;
  basketServiceId: string;
}

/**
 * Écran final du flow : remet la liste à l'utilisateur pour qu'il la
 * récupère sur carrefour.fr dans sa propre session.
 *
 * Deux options présentées :
 * 1. Bookmarklet — méthode recommandée (1 clic sur carrefour.fr)
 * 2. Liste manuelle — fallback, l'utilisateur suit les liens un à un
 */
export function CartHandoff({
  cart,
  slot,
  storeRef,
  basketServiceId,
}: CartHandoffProps) {
  const [copied, setCopied] = useState(false);
  const [showScript, setShowScript] = useState(false);

  if (!cart || cart.items.length === 0) return null;

  const payload: BookmarkletPayload = {
    storeRef,
    basketServiceId,
    eans: cart.items.map((i) => i.ean),
  };
  const bookmarkletUrl = generateBookmarklet(payload);

  const [openedTab, setOpenedTab] = useState(false);

  async function handleCopyAndOpen() {
    try {
      await navigator.clipboard.writeText(bookmarkletUrl);
      setCopied(true);

      // Ouvrir carrefour.fr dans un nouvel onglet
      const newWindow = window.open(
        "https://www.carrefour.fr",
        "_blank",
        "noopener,noreferrer"
      );
      if (newWindow) setOpenedTab(true);

      // Reset après 10s pour que le message reste lisible
      setTimeout(() => {
        setCopied(false);
        setOpenedTab(false);
      }, 10000);
    } catch {
      // Fallback si Clipboard API échoue (rare, mais sur certains browsers
      // sans HTTPS ou sans permission, ça peut arriver)
    }
  }

  const slotText = slot
    ? `${new Date(slot.begDate).toLocaleDateString("fr-FR", {
        weekday: "long",
        day: "numeric",
        month: "long",
      })} de ${new Date(slot.begDate).toLocaleTimeString("fr-FR", {
        hour: "2-digit",
        minute: "2-digit",
      })} à ${new Date(slot.endDate).toLocaleTimeString("fr-FR", {
        hour: "2-digit",
        minute: "2-digit",
      })}`
    : null;

  return (
    <section
      aria-label="Récupérer votre panier sur Carrefour"
      className="space-y-6"
    >
      {/* Résumé panier */}
      <div className="p-6 rounded-lg bg-[var(--bg-surface)] border-2 border-[var(--accent)]">
        <h3 className="text-lg font-bold mb-3">Votre sélection</h3>
        <ul className="space-y-2 mb-4">
          {cart.items.map((item) => (
            <li key={item.ean} className="flex justify-between text-sm">
              <span>
                {item.quantity}× {item.title}
              </span>
              <span className="font-semibold">
                {item.price.toFixed(2)}€
              </span>
            </li>
          ))}
        </ul>
        <div className="flex justify-between text-lg font-bold pt-3 border-t border-[var(--border)]">
          <span>Total</span>
          <span
            className="text-[var(--accent)]"
            aria-label={`Total : ${cart.totalAmount.toFixed(2).replace(".", " euros ")}`}
          >
            {cart.totalAmount.toFixed(2)}€
          </span>
        </div>
        {slotText && (
          <p className="text-sm text-[var(--text-muted)] mt-2">
            Créneau disponible : {slotText}
          </p>
        )}
      </div>

      {/* Instructions bookmarklet */}
      <div className="p-6 rounded-lg bg-[var(--bg-surface)] border-2 border-[var(--border)]">
        <h3 className="text-lg font-bold mb-3">
          Ajouter à mon panier Carrefour
        </h3>
        <p className="text-[var(--text-muted)] mb-4">
          Votre panier est prêt. Pour le retrouver dans votre session Carrefour
          personnelle, suivez ces étapes :
        </p>

        <ol className="space-y-3 list-decimal list-inside mb-4">
          <li>
            <strong>Cliquez sur le bouton ci-dessous</strong> — il copie le
            lien magique ET ouvre carrefour.fr dans un nouvel onglet
          </li>
          <li>
            Dans le nouvel onglet carrefour.fr, appuyez sur{" "}
            <kbd className="px-2 py-0.5 bg-[var(--bg)] rounded border border-[var(--border)]">
              Ctrl+L
            </kbd>{" "}
            pour placer le curseur dans la barre d'adresse
          </li>
          <li>
            Appuyez sur{" "}
            <kbd className="px-2 py-0.5 bg-[var(--bg)] rounded border border-[var(--border)]">
              Ctrl+V
            </kbd>{" "}
            pour coller le lien magique, puis{" "}
            <kbd className="px-2 py-0.5 bg-[var(--bg)] rounded border border-[var(--border)]">
              Entrée
            </kbd>
          </li>
          <li>
            Le panier se remplit automatiquement, vous arrivez sur la page
            panier Carrefour
          </li>
        </ol>

        <div className="flex gap-3 flex-wrap">
          <button
            type="button"
            onClick={handleCopyAndOpen}
            aria-label={
              copied && openedTab
                ? `Lien copié et carrefour.fr ouvert dans un nouvel onglet. Dans l'onglet Carrefour : Ctrl+L puis Ctrl+V puis Entrée pour remplir votre panier.`
                : copied
                  ? "Lien copié. Ouvrez carrefour.fr et collez dans la barre d'adresse"
                  : `Copier le lien magique et ouvrir Carrefour pour ajouter ${cart.items.length} produit${cart.items.length > 1 ? "s" : ""}`
            }
            className={`px-6 py-3 rounded-lg font-bold text-lg transition-colors ${
              copied
                ? "bg-[var(--success)] text-[var(--bg)]"
                : "bg-[var(--accent)] text-[var(--bg)] hover:bg-[var(--accent-hover)]"
            }`}
          >
            {copied && openedTab
              ? "✓ Prêt ! Allez dans l'onglet Carrefour → Ctrl+L → Ctrl+V → Entrée"
              : copied
                ? "✓ Copié ! Ouvrez carrefour.fr"
                : "Copier et ouvrir Carrefour"}
          </button>
        </div>

        <details className="mt-4">
          <summary className="cursor-pointer text-sm text-[var(--text-muted)] hover:text-[var(--text)]">
            Voir le code technique du lien magique
          </summary>
          <pre className="mt-2 p-3 rounded bg-[var(--bg)] border border-[var(--border)] text-xs overflow-auto">
            {showScript ? generateReadableScript(payload) : bookmarkletUrl.slice(0, 200) + "..."}
          </pre>
          <button
            type="button"
            onClick={() => setShowScript((s) => !s)}
            className="mt-2 text-sm underline text-[var(--text-muted)]"
          >
            {showScript ? "Masquer" : "Afficher"} le code lisible
          </button>
        </details>
      </div>

      {/* Fallback liste manuelle */}
      <details className="p-4 rounded-lg bg-[var(--bg-surface)] border border-[var(--border)]">
        <summary className="cursor-pointer font-semibold">
          Ça ne fonctionne pas ? Voir la liste manuelle
        </summary>
        <p className="text-sm text-[var(--text-muted)] mt-3 mb-3">
          Voici la liste des produits avec leurs liens directs sur
          carrefour.fr. Cliquez sur chacun pour ouvrir la fiche produit et
          ajouter au panier manuellement.
        </p>
        <ul className="space-y-2">
          {cart.items.map((item) => (
            <li key={item.ean}>
              <a
                href={`https://www.carrefour.fr/s?q=${encodeURIComponent(item.title)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--accent)] underline"
              >
                {item.title} — {item.price.toFixed(2)}€
              </a>
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}
