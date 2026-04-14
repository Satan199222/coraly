import { NextRequest, NextResponse } from "next/server";
import { zenrowsFetchHtml as scrapeHtml } from "@/lib/carrefour/zenrows";
import {
  rateLimit,
  clientKey,
  rateLimitHeaders,
} from "@/lib/rate-limit";

/**
 * Récupère les détails complets d'un produit Carrefour (Nutriscore,
 * ingrédients, info nutritionnelle, allergènes) depuis la page produit.
 *
 * Approche : scrape /p/{slug} via ZenRows (js_render=true), extrait
 * le JSON __NEXT_DATA__ côté client. Ça contient toute la fiche produit
 * structurée — bien plus complet que /s?q= qui ne retourne qu'un résumé.
 *
 * Coût ZenRows : ~25 credits/appel (premium_proxy + js_render). À limiter
 * pour ne pas exploser le quota — rate limit 20/min/IP.
 */

const RATE_MAX = 20;
const RATE_WINDOW_MS = 60_000;

export async function GET(request: NextRequest) {
  const rl = await rateLimit(
    `product-details:${clientKey(request)}`,
    RATE_MAX,
    RATE_WINDOW_MS
  );
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Trop de requêtes détails produit." },
      {
        status: 429,
        headers: rateLimitHeaders(RATE_MAX, rl.remaining, rl.resetAt),
      }
    );
  }

  const slug = request.nextUrl.searchParams.get("slug");
  const ean = request.nextUrl.searchParams.get("ean");
  if (!slug && !ean) {
    return NextResponse.json(
      { error: "slug ou ean requis" },
      { status: 400 }
    );
  }

  // Construction de l'URL de fiche produit. Carrefour utilise /p/{slug}
  // où slug inclut déjà l'EAN. Si on n'a que l'EAN, on fallback sur /s?q
  // pour retrouver le slug.
  const path = slug
    ? `/p/${slug}`
    : `/p/ean-${ean}`; // slug par défaut si on n'a que l'EAN

  try {
    const html = await scrapeHtml(path);
    // Le Next.js SSR de Carrefour embarque les données produit dans
    // <script id="__NEXT_DATA__">...</script>
    const match = html.match(
      /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/
    );
    if (!match) {
      return NextResponse.json(
        { error: "Page produit sans __NEXT_DATA__" },
        { status: 502 }
      );
    }
    const nextData = JSON.parse(match[1]);
    const product =
      nextData?.props?.pageProps?.product?.data?.attributes ??
      nextData?.props?.pageProps?.initialProduct?.attributes ??
      null;

    if (!product) {
      return NextResponse.json(
        { error: "Produit non trouvé dans les données" },
        { status: 404 }
      );
    }

    // On retourne uniquement les champs utiles à l'agent pour économiser
    // les tokens LLM (certains champs font des centaines de kB).
    return NextResponse.json({
      ean: product.ean,
      title: product.title,
      brand: product.brand,
      packaging: product.packaging,
      format: product.format,
      nutriscore: product.nutriscore?.value ?? null,
      origin: product.origin ?? null,
      ingredients: product.ingredients ?? null,
      allergens: product.allergens ?? null,
      nutritionalValues: product.nutritionalValues ?? null,
      labels: product.labels ?? [],
      traceability: product.traceability ?? null,
      key_features: product.keyFeatures ?? null,
      sustainability: product.sustainabilityIndex ?? null,
      bio: /\bbio\b/i.test(product.title ?? "") ||
        (product.labels ?? []).some((l: { label?: string }) =>
          /bio|ab/i.test(l?.label ?? "")
        ),
    });
  } catch (err) {
    console.error("[product/details] error:", err);
    return NextResponse.json(
      { error: "Détails produit indisponibles" },
      { status: 502 }
    );
  }
}
