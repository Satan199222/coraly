import { NextRequest, NextResponse } from "next/server";
import {
  findStores,
  setStore,
  getBasketServiceId,
} from "@/lib/carrefour/client";

const WOOSMAP_API_KEY = process.env.WOOSMAP_API_KEY;

export async function GET(request: NextRequest) {
  const postalCode = request.nextUrl.searchParams.get("postalCode");
  if (!postalCode) {
    return NextResponse.json({ error: "postalCode requis" }, { status: 400 });
  }
  if (!WOOSMAP_API_KEY) {
    return NextResponse.json(
      { error: "Configuration serveur incomplète (WOOSMAP_API_KEY manquante)." },
      { status: 500 }
    );
  }

  try {
    const geoRes = await fetch(
      `https://api.woosmap.com/localities/autocomplete/?key=${WOOSMAP_API_KEY}&input=${postalCode}&components=country:fr`,
      {
        headers: {
          origin: "https://www.carrefour.fr",
          referer: "https://www.carrefour.fr/",
        },
      }
    );
    const geoData = await geoRes.json();
    const location = geoData.localities?.[0]?.location;
    if (!location) {
      return NextResponse.json(
        { error: "Code postal introuvable" },
        { status: 404 }
      );
    }

    const stores = await findStores(location.lat, location.lng, postalCode);
    return NextResponse.json({ stores, location });
  } catch (err) {
    console.error("[stores] GET failed:", err);
    return NextResponse.json(
      { error: "Recherche des magasins impossible." },
      { status: 502 }
    );
  }
}

export async function POST(request: NextRequest) {
  let body: { storeRef?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide" }, { status: 400 });
  }

  if (!body.storeRef) {
    return NextResponse.json({ error: "storeRef requis" }, { status: 400 });
  }

  try {
    await setStore(body.storeRef);
    const basketServiceId = await getBasketServiceId(body.storeRef);
    return NextResponse.json({ ok: true, basketServiceId });
  } catch (err) {
    console.error("[stores] POST failed:", err);
    return NextResponse.json(
      { error: "Sélection du magasin impossible." },
      { status: 502 }
    );
  }
}
