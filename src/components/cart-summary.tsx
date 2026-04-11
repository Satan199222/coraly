"use client";

import type { Cart, DeliverySlot } from "@/lib/carrefour/types";

interface CartSummaryProps {
  cart: Cart | null;
  slot: DeliverySlot | null;
  onCheckout: () => void;
  isLoading: boolean;
}

export function CartSummary({
  cart,
  slot,
  onCheckout,
  isLoading,
}: CartSummaryProps) {
  if (!cart || cart.items.length === 0) return null;

  const slotText = slot
    ? `${new Date(slot.begDate).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })} de ${new Date(slot.begDate).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })} à ${new Date(slot.endDate).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`
    : "Aucun créneau disponible";

  return (
    <section
      aria-label="Résumé du panier"
      className="p-6 rounded-lg bg-[var(--bg-surface)] border-2 border-[var(--accent)]"
    >
      <h2 className="text-xl font-bold mb-4">Votre panier</h2>
      <ul className="space-y-2 mb-4">
        {cart.items.map((item) => (
          <li key={item.ean} className="flex justify-between">
            <span>
              {item.quantity}x {item.title}
            </span>
            <span className="font-semibold">{item.price.toFixed(2)}€</span>
          </li>
        ))}
      </ul>
      <div className="border-t border-[var(--border)] pt-4 space-y-2">
        <div className="flex justify-between text-lg font-bold">
          <span>Total</span>
          <span className="text-[var(--accent)]">
            {cart.totalAmount.toFixed(2)}€
          </span>
        </div>
        {slot && (
          <p className="text-[var(--text-muted)]">
            Premier créneau : {slotText}
          </p>
        )}
      </div>
      <button
        onClick={onCheckout}
        disabled={isLoading}
        className="w-full mt-4 px-6 py-4 rounded-lg bg-[var(--success)] text-[var(--bg)] font-bold text-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
      >
        Valider et payer sur Carrefour
      </button>
    </section>
  );
}
