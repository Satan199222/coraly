import { NextRequest, NextResponse } from "next/server";
import { getCart, addToCart } from "@/lib/carrefour/client";

export async function GET() {
  try {
    const cart = await getCart();
    return NextResponse.json(cart);
  } catch (err) {
    console.error("[cart] GET failed:", err);
    return NextResponse.json(
      { error: "Impossible de lire le panier." },
      { status: 502 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  let body: { ean?: string; basketServiceId?: string; quantity?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide" }, { status: 400 });
  }

  const { ean, basketServiceId, quantity } = body;
  if (!ean || !basketServiceId) {
    return NextResponse.json(
      { error: "ean et basketServiceId requis" },
      { status: 400 }
    );
  }
  const finalQuantity = quantity ?? 1;
  if (
    !Number.isInteger(finalQuantity) ||
    finalQuantity < 1 ||
    finalQuantity > 99
  ) {
    return NextResponse.json(
      { error: "quantity doit être un entier entre 1 et 99" },
      { status: 400 }
    );
  }

  try {
    const cart = await addToCart(ean, basketServiceId, finalQuantity);
    return NextResponse.json(cart);
  } catch (err) {
    console.error("[cart] PATCH failed:", err);
    return NextResponse.json(
      { error: "Ajout au panier impossible. Veuillez réessayer." },
      { status: 502 }
    );
  }
}
