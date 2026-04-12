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

      {/* Remise du panier — approche bookmarklet.
          ATTENTION : les navigateurs modernes suppriment le préfixe "javascript:"
          quand on le colle dans la barre d'adresse. On ne peut donc PAS se
          contenter de copier/coller — il faut glisser-déposer le lien dans
          la barre de favoris, ou le sauvegarder comme marque-page. */}
      <div className="p-6 rounded-lg bg-[var(--bg-surface)] border-2 border-[var(--border)]">
        <h3 className="text-lg font-bold mb-3">
          Ajouter à mon panier Carrefour
        </h3>
        <p className="text-[var(--text-muted)] mb-4">
          Votre liste est prête. Pour la transférer dans votre panier
          Carrefour, il faut utiliser un lien spécial qui s'exécute sur
          carrefour.fr avec vos cookies.
        </p>

        <div className="p-4 rounded border border-[var(--danger)] bg-[var(--bg)] mb-4">
          <p className="text-sm">
            <strong>Important :</strong> ce lien ne fonctionne PAS en le
            collant dans la barre d'adresse (les navigateurs le bloquent pour
            des raisons de sécurité). Vous devez le{" "}
            <strong>glisser dans votre barre de favoris</strong>, puis le
            cliquer une fois sur carrefour.fr.
          </p>
        </div>

        <h4 className="font-semibold mb-2">Marche à suivre :</h4>
        <ol className="space-y-2 list-decimal list-inside mb-4 text-sm">
          <li>
            <strong>Glissez le lien ci-dessous</strong> vers votre barre de
            favoris (maintenez le clic sur le lien et déplacez-le vers la
            barre en haut du navigateur)
          </li>
          <li>
            Ouvrez{" "}
            <a
              href="https://www.carrefour.fr"
              target="_blank"
              rel="noopener noreferrer"
              className="underline text-[var(--accent)]"
            >
              carrefour.fr
            </a>{" "}
            dans un nouvel onglet
          </li>
          <li>
            Cliquez sur le favori "VoixCourses" que vous venez d'ajouter —
            le panier se remplit automatiquement
          </li>
        </ol>

        <div className="flex gap-3 flex-wrap items-center mb-4">
          {/* Lien drag-drop vers la barre de favoris */}
          <a
            href={bookmarkletUrl}
            className="px-6 py-3 rounded-lg bg-[var(--accent)] text-[var(--bg)] font-bold text-lg inline-block cursor-grab active:cursor-grabbing"
            onClick={(e) => e.preventDefault()}
            draggable
            aria-label={`Lien magique VoixCourses pour ${cart.items.length} produit${cart.items.length > 1 ? "s" : ""}. À glisser dans la barre de favoris.`}
          >
            ↓ VoixCourses — Glisser dans les favoris
          </a>

          <button
            type="button"
            onClick={handleCopyAndOpen}
            aria-label="Copier le code dans le presse-papiers (utilisation avancée)"
            className="px-4 py-2 rounded border border-[var(--border)] text-[var(--text-muted)] text-sm hover:border-[var(--accent)] hover:text-[var(--text)] transition-colors"
          >
            {copied ? "✓ Copié" : "Copier le code"}
          </button>
        </div>

        <div className="p-4 rounded bg-[var(--bg)] border border-[var(--border)] text-sm">
          <p className="font-semibold mb-1">
            Navigation clavier uniquement ?
          </p>
          <p className="text-[var(--text-muted)]">
            Le glisser-déposer n'est pas accessible au clavier. Dans ce cas :
          </p>
          <ol className="list-decimal list-inside mt-2 space-y-1">
            <li>
              Appuyez sur{" "}
              <kbd className="px-1.5 py-0.5 bg-[var(--bg-surface)] rounded border border-[var(--border)] text-xs">
                Ctrl+D
              </kbd>{" "}
              sur le lien "VoixCourses" ci-dessus pour ouvrir la boîte de
              dialogue "Ajouter un favori"
            </li>
            <li>
              Validez avec{" "}
              <kbd className="px-1.5 py-0.5 bg-[var(--bg-surface)] rounded border border-[var(--border)] text-xs">
                Entrée
              </kbd>
            </li>
            <li>
              Allez sur carrefour.fr, puis{" "}
              <kbd className="px-1.5 py-0.5 bg-[var(--bg-surface)] rounded border border-[var(--border)] text-xs">
                Ctrl+Maj+B
              </kbd>{" "}
              pour ouvrir la liste des favoris, trouvez "VoixCourses" et{" "}
              <kbd className="px-1.5 py-0.5 bg-[var(--bg-surface)] rounded border border-[var(--border)] text-xs">
                Entrée
              </kbd>{" "}
              dessus
            </li>
          </ol>
          <p className="mt-2 text-[var(--text-muted)]">
            <em>
              Une extension navigateur dédiée arrive bientôt pour simplifier
              cette étape.
            </em>
          </p>
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
