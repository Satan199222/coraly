# VoixCourses MVP — Plan d'Implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un assistant courses vocal accessible qui transforme une liste en langage naturel en un panier Carrefour rempli, sans authentification.

**Architecture:** Next.js App Router sur Vercel. Les API routes utilisent `@sparticuz/chromium` + `playwright-core` pour appeler l'API interne Carrefour (contournement Cloudflare). Claude Sonnet parse la liste de courses et sélectionne les meilleurs produits. L'UI est 100% accessible (WCAG AAA) avec dictée vocale via Web Speech API.

**Tech Stack:** Next.js 15 (App Router), TypeScript, Tailwind CSS, `@sparticuz/chromium`, `playwright-core`, `@anthropic-ai/sdk`, Web Speech API

**Référence API Carrefour :** `docs/CARREFOUR-API.md` — tous les endpoints, formats et flow validés.

**Référence UX :** `docs/USER-FLOW.html` — flow utilisateur validé (12 étapes, 4 phases + clarification).

**Référence Accessibilité :** `docs/ACCESSIBILITY.md` — patterns WCAG AAA, aria-live, focus management.

---

## Flow utilisateur (12 étapes)

```
Phase 1 — Onboarding
  1. Arrivée → bienvenue vocale
  2. Code postal → sélection magasin → créneau annoncé

Phase 2 — Saisie
  3. Saisie texte ou dictée vocale
  4. Clic "Trouver mes produits" → Claude parse la liste

Phase 2.5 — Clarification (skippée si tout est clair)
  5. Claude classe : ✓ clair / ? ambigu / ✗ incompris
  6. Écran de clarification (suggestions cliquables)
  7. Corrections par l'utilisateur
  8. Liste validée → "Lancer la recherche"

Phase 3 — Sélection
  9. Résultats Carrefour affichés
  → Confirmer / Autre choix / Supprimer par produit
  → Ajouter un produit (champ en bas de liste)
  10. Récap → "Ajouter au panier"

Phase 4 — Panier
  11. Ajout progressif → PATCH /api/cart × N
  12. Résumé panier → redirect carrefour.fr/mon-panier
```

---

## File Structure

```
src/
├── app/
│   ├── layout.tsx                  — Layout racine, meta, polices accessibles
│   ├── page.tsx                    — Page unique MVP (state machine 4 phases)
│   ├── globals.css                 — Tailwind + thème haute accessibilité (3 thèmes)
│   └── api/
│       ├── stores/route.ts         — GET/POST: géoloc + sélection magasin
│       ├── search/route.ts         — GET: recherche produits Carrefour
│       ├── cart/route.ts           — GET: lire panier, PATCH: ajouter/modifier
│       ├── parse-list/route.ts     — POST: Claude parse + détecte ambiguïtés
│       └── slots/route.ts          — GET: créneaux livraison
├── lib/
│   ├── carrefour/
│   │   ├── browser.ts              — Singleton Chromium (@sparticuz/chromium)
│   │   ├── client.ts               — CarrefourClient (search, cart, stores, slots)
│   │   └── types.ts                — Types TypeScript pour l'API Carrefour
│   ├── claude/
│   │   └── parse-grocery-list.ts   — Parsing + détection ambiguïtés via Claude Sonnet
│   └── speech/
│       └── use-speech.ts           — Hook React : dictée vocale + synthèse vocale (opt-in)
├── components/
│   ├── store-selector.tsx          — Saisie CP + liste magasins (radio buttons)
│   ├── grocery-input.tsx           — Champ texte + bouton micro + bouton lancer
│   ├── list-clarification.tsx      — Clarification items ambigus/incompris (Phase 2.5)
│   ├── product-results.tsx         — Résultats avec confirmer/autre/supprimer + ajout produit
│   ├── cart-summary.tsx            — Résumé vocal du panier + total + créneau
│   ├── accessibility-bar.tsx       — Barre thème + taille texte + toggle voix
│   └── live-region.tsx             — Zone aria-live pour annonces vocales
├── tailwind.config.ts
├── next.config.ts
└── package.json
```

---

### Task 1: Initialisation du projet Next.js

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`
- Create: `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`

- [ ] **Step 1: Initialiser le projet**

```bash
cd /home/julien/projects/blind-shop
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --no-git --yes
```

Note : répondre "no" à Turbopack si demandé. Le `--no-git` évite d'écraser le repo existant.

- [ ] **Step 2: Installer les dépendances**

```bash
npm install @anthropic-ai/sdk playwright-core @sparticuz/chromium
```

- [ ] **Step 3: Configurer next.config.ts pour serverless**

```ts
// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["playwright-core", "@sparticuz/chromium"],
};

export default nextConfig;
```

- [ ] **Step 4: Configurer le thème accessibilité dans globals.css**

Remplacer le contenu de `src/app/globals.css` par :

```css
@import "tailwindcss";

:root {
  --bg: #1a1a2e;
  --bg-surface: #16213e;
  --text: #edf2f4;
  --text-muted: #8d99ae;
  --accent: #4cc9f0;
  --accent-hover: #7ae0ff;
  --danger: #ef476f;
  --success: #06d6a0;
  --border: #2b3a55;
  --focus-ring: #4cc9f0;
}

* {
  box-sizing: border-box;
}

html {
  font-size: 112.5%; /* 18px base — meilleure lisibilité */
}

body {
  background: var(--bg);
  color: var(--text);
  font-family: system-ui, -apple-system, sans-serif;
  line-height: 1.6;
}

/* Focus visible pour navigation clavier */
:focus-visible {
  outline: 3px solid var(--focus-ring);
  outline-offset: 2px;
}

/* Contraste AAA minimum 7:1 */
::selection {
  background: var(--accent);
  color: var(--bg);
}
```

- [ ] **Step 5: Configurer le layout racine**

```tsx
// src/app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VoixCourses — Assistant Courses Accessible",
  description:
    "Faites vos courses en ligne par la voix. Dictez votre liste, l'IA s'occupe du reste.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:bg-[var(--accent)] focus:text-[var(--bg)] focus:px-4 focus:py-2 focus:rounded"
        >
          Aller au contenu principal
        </a>
        <main id="main" tabIndex={-1}>
          {children}
        </main>
      </body>
    </html>
  );
}
```

- [ ] **Step 6: Page d'accueil placeholder**

```tsx
// src/app/page.tsx
export default function Home() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-4">VoixCourses</h1>
      <p className="text-[var(--text-muted)]">
        Dictez ou tapez votre liste de courses. L'IA trouve les produits et
        remplit votre panier Carrefour.
      </p>
    </div>
  );
}
```

- [ ] **Step 7: Vérifier que le projet démarre**

```bash
npm run dev
```

Vérifier dans le navigateur : `http://localhost:3000` — la page s'affiche avec le titre "VoixCourses".

- [ ] **Step 8: Commit**

```bash
git init && git add -A && git commit -m "feat: init Next.js project with accessible theme"
```

---

### Task 2: Types TypeScript pour l'API Carrefour

**Files:**
- Create: `src/lib/carrefour/types.ts`

- [ ] **Step 1: Définir les types**

```ts
// src/lib/carrefour/types.ts

/** Produit extrait de la réponse search Carrefour */
export interface CarrefourProduct {
  ean: string;
  title: string;
  brand: string;
  slug: string;
  price: number | null;
  perUnitLabel: string | null;
  unitOfMeasure: string | null;
  purchasable: boolean;
  nutriscore: string | null;
  format: string | null;
  packaging: string | null;
  categories: string[];
  imageUrl: string | null;
  offerServiceId: string | null;
}

/** Résultat de recherche */
export interface SearchResult {
  products: CarrefourProduct[];
  total: number;
  keyword: string;
}

/** Magasin Carrefour */
export interface CarrefourStore {
  ref: string;
  name: string;
  format: string;
  distance: string;
  isDrive?: boolean;
  isDelivery?: boolean;
  address?: {
    address1: string;
    city: string;
    postalCode: string;
  };
}

/** Créneau de livraison */
export interface DeliverySlot {
  begDate: string;
  endDate: string;
}

/** Produit dans le panier */
export interface CartItem {
  ean: string;
  title: string;
  brand: string;
  quantity: number;
  price: number;
  available: boolean;
}

/** Panier complet */
export interface Cart {
  totalAmount: number;
  totalFees: number;
  items: CartItem[];
}

/** Item parsé par Claude depuis la liste en langage naturel */
export interface ParsedGroceryItem {
  query: string;
  originalText: string;
  quantity?: number;
  unit?: string;
  brand?: string;
  status: "clear" | "ambiguous" | "unrecognized";
  /** Question pour l'utilisateur si ambigu */
  clarificationQuestion?: string;
  /** Suggestions si ambigu ou incompris */
  suggestions?: string[];
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/carrefour/types.ts && git commit -m "feat: add Carrefour API types"
```

---

### Task 3: Singleton Chromium pour Vercel Functions

**Files:**
- Create: `src/lib/carrefour/browser.ts`

- [ ] **Step 1: Créer le gestionnaire de browser**

```ts
// src/lib/carrefour/browser.ts
import type { Browser, Page } from "playwright-core";

let browser: Browser | null = null;
let page: Page | null = null;
let cloudflareReady = false;

/**
 * Retourne une page Playwright prête (Cloudflare passé).
 * Réutilise l'instance entre les appels (Fluid Compute).
 */
export async function getPage(): Promise<Page> {
  if (page && cloudflareReady) {
    return page;
  }

  if (!browser) {
    const chromium = await import("@sparticuz/chromium");
    const { chromium: pw } = await import("playwright-core");

    browser = await pw.launch({
      args: chromium.default.args,
      executablePath:
        process.env.CHROMIUM_PATH ||
        (await chromium.default.executablePath()),
      headless: true,
    });
  }

  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    locale: "fr-FR",
  });
  page = await context.newPage();

  // Passer Cloudflare
  await page.goto("https://www.carrefour.fr", {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });
  cloudflareReady = true;

  return page;
}

/**
 * Exécute un fetch dans le contexte du navigateur (avec session Cloudflare).
 */
export async function browserFetch<T>(
  path: string,
  options?: { method?: string; body?: string; headers?: Record<string, string> }
): Promise<T> {
  const p = await getPage();
  return p.evaluate(
    async ({ path, options }) => {
      const res = await fetch(path, {
        method: options?.method || "GET",
        headers: {
          "x-requested-with": "XMLHttpRequest",
          accept: "application/json",
          ...options?.headers,
        },
        ...(options?.body ? { body: options.body } : {}),
      });
      return res.json();
    },
    { path, options }
  );
}
```

- [ ] **Step 2: Tester en local que le browser se lance**

Créer un fichier de test temporaire :
```bash
npx tsx -e "
import { getPage } from './src/lib/carrefour/browser';
(async () => {
  const page = await getPage();
  console.log('Page title:', await page.title());
  process.exit(0);
})();
"
```

Expected: `Page title: Carrefour : Magasins et Courses en ligne ...`

- [ ] **Step 3: Commit**

```bash
git add src/lib/carrefour/browser.ts && git commit -m "feat: add Chromium singleton for Vercel Functions"
```

---

### Task 4: Client Carrefour (search, cart, stores)

**Files:**
- Create: `src/lib/carrefour/client.ts`

- [ ] **Step 1: Implémenter le client**

```ts
// src/lib/carrefour/client.ts
import { browserFetch, getPage } from "./browser";
import type {
  CarrefourProduct,
  SearchResult,
  CarrefourStore,
  DeliverySlot,
  Cart,
  CartItem,
} from "./types";

/**
 * Extraire un CarrefourProduct depuis la réponse JSON:API brute.
 * Ref: docs/CARREFOUR-API.md § "Structure Product"
 */
function extractProduct(raw: any): CarrefourProduct {
  const a = raw.attributes;
  const ean: string = a.ean;
  const offers = a.offers?.[ean] || {};
  const [offerServiceId, offerData] = Object.entries(offers)[0] || [null, null];
  const offer = (offerData as any)?.attributes;

  return {
    ean,
    title: a.title,
    brand: a.brand,
    slug: a.slug,
    price: offer?.price?.price ?? null,
    perUnitLabel: offer?.price?.perUnitLabel ?? null,
    unitOfMeasure: offer?.price?.unitOfMeasure ?? null,
    purchasable: offer?.availability?.purchasable ?? false,
    nutriscore: a.nutriscore?.value ?? null,
    format: a.format ?? null,
    packaging: a.packaging ?? null,
    categories: a.categories?.map((c: any) => c.label) ?? [],
    imageUrl: a.images?.main ?? null,
    offerServiceId: offerServiceId as string | null,
  };
}

/** Recherche produits. Ref: GET /s?q={query} */
export async function searchProducts(query: string): Promise<SearchResult> {
  const params = new URLSearchParams({ q: query });
  const data = await browserFetch<any>(`/s?${params}`);
  return {
    products: (data.data || []).map(extractProduct),
    total: data.meta?.total ?? 0,
    keyword: data.meta?.keyword ?? query,
  };
}

/** Magasins proches. Ref: GET /geoloc */
export async function findStores(
  lat: number,
  lng: number,
  postalCode: string
): Promise<CarrefourStore[]> {
  const params = new URLSearchParams({
    lat: lat.toString(),
    lng: lng.toString(),
    page: "1",
    limit: "5",
    postal_code: postalCode,
  });
  params.append("array_postal_codes[]", postalCode);
  params.append("modes[]", "delivery");
  params.append("modes[]", "picking");

  const data = await browserFetch<any>(`/geoloc?${params}`);
  return (data.data?.stores || []).map((s: any) => ({
    ref: s.ref,
    name: s.name,
    format: s.format,
    distance: s.distance,
    isDrive: s.isDrive,
    isDelivery: s.isLad,
    address: s.address,
  }));
}

/** Sélectionner un magasin. Ref: GET /set-store/{ref} */
export async function setStore(storeRef: string): Promise<void> {
  await browserFetch<any>(`/set-store/${storeRef}`);
}

/**
 * Extraire le basketServiceId depuis une fiche produit.
 * Format: XXXX-NNN-{storeRef}. Ref: docs/CARREFOUR-API.md § "Identifiants"
 */
export async function getBasketServiceId(
  storeRef: string
): Promise<string | null> {
  const p = await getPage();
  await p.goto(
    "https://www.carrefour.fr/p/lait-demi-ecreme-uht-vitamine-d-lactel-3252210390014",
    { waitUntil: "domcontentloaded", timeout: 30000 }
  );
  await p.waitForTimeout(2000);
  return p.evaluate((ref: string) => {
    const html = document.documentElement.innerHTML;
    const pattern = new RegExp(`[A-Z0-9]{4}-\\d{3}-${ref}`, "g");
    return html.match(pattern)?.[0] || null;
  }, storeRef);
}

/** Lire le panier. Ref: GET /api/cart */
export async function getCart(): Promise<Cart> {
  const data = await browserFetch<any>("/api/cart");
  const cart = data.cart || {};
  const items: CartItem[] = [];
  for (const category of cart.items || []) {
    for (const p of category.products || []) {
      items.push({
        ean: p.product?.attributes?.ean ?? "",
        title: p.product?.attributes?.title ?? "",
        brand: p.product?.attributes?.brand ?? "",
        quantity: p.counter ?? 0,
        price: p.totalItemPrice ?? 0,
        available: p.available ?? true,
      });
    }
  }
  return {
    totalAmount: cart.totalAmount ?? 0,
    totalFees: cart.totalFees ?? 0,
    items,
  };
}

/**
 * Ajouter un produit au panier.
 * Ref: PATCH /api/cart — docs/CARREFOUR-API.md § "Panier — Ajout"
 */
export async function addToCart(
  ean: string,
  basketServiceId: string,
  quantity: number = 1
): Promise<Cart> {
  const body = JSON.stringify({
    trackingRequest: { pageType: "search", pageId: "search" },
    items: [
      {
        basketServiceId,
        counter: quantity,
        ean,
        subBasketType: "drive_clcv",
      },
    ],
  });
  const data = await browserFetch<any>("/api/cart", {
    method: "PATCH",
    body,
    headers: { "content-type": "application/json" },
  });
  // Réutiliser le parseur getCart sur la réponse
  const cart = data.cart || {};
  const items: CartItem[] = [];
  for (const category of cart.items || []) {
    for (const p of category.products || []) {
      items.push({
        ean: p.product?.attributes?.ean ?? "",
        title: p.product?.attributes?.title ?? "",
        brand: p.product?.attributes?.brand ?? "",
        quantity: p.counter ?? 0,
        price: p.totalItemPrice ?? 0,
        available: p.available ?? true,
      });
    }
  }
  return {
    totalAmount: cart.totalAmount ?? 0,
    totalFees: cart.totalFees ?? 0,
    items,
  };
}

/** Premier créneau dispo. Ref: GET /api/firstslot */
export async function getFirstSlot(
  storeRef: string
): Promise<DeliverySlot | null> {
  const data = await browserFetch<any>(
    `/api/firstslot?storeId=${storeRef}`
  );
  if (Array.isArray(data) && data.length === 0) return null;
  if (data?.data?.attributes) {
    return {
      begDate: data.data.attributes.begDate,
      endDate: data.data.attributes.endDate,
    };
  }
  return null;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/carrefour/client.ts && git commit -m "feat: add Carrefour client (search, cart, stores, slots)"
```

---

### Task 5: API Routes Next.js

**Files:**
- Create: `src/app/api/stores/route.ts`
- Create: `src/app/api/search/route.ts`
- Create: `src/app/api/cart/route.ts`
- Create: `src/app/api/slots/route.ts`

- [ ] **Step 1: Route magasins**

```ts
// src/app/api/stores/route.ts
import { NextRequest, NextResponse } from "next/server";
import { findStores, setStore, getBasketServiceId } from "@/lib/carrefour/client";

export async function GET(request: NextRequest) {
  const postalCode = request.nextUrl.searchParams.get("postalCode");
  if (!postalCode) {
    return NextResponse.json({ error: "postalCode requis" }, { status: 400 });
  }

  // Géoloc via Woosmap
  const geoRes = await fetch(
    `https://api.woosmap.com/localities/autocomplete/?key=woos-26fe76aa-ff24-3255-b25b-e1bde7b7a683&input=${postalCode}&components=country:fr`,
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
    return NextResponse.json({ error: "Code postal introuvable" }, { status: 404 });
  }

  const stores = await findStores(location.lat, location.lng, postalCode);
  return NextResponse.json({ stores, location });
}

export async function POST(request: NextRequest) {
  const { storeRef } = await request.json();
  if (!storeRef) {
    return NextResponse.json({ error: "storeRef requis" }, { status: 400 });
  }

  await setStore(storeRef);
  const basketServiceId = await getBasketServiceId(storeRef);

  return NextResponse.json({ ok: true, basketServiceId });
}
```

- [ ] **Step 2: Route recherche**

```ts
// src/app/api/search/route.ts
import { NextRequest, NextResponse } from "next/server";
import { searchProducts } from "@/lib/carrefour/client";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q");
  if (!query) {
    return NextResponse.json({ error: "q requis" }, { status: 400 });
  }

  const result = await searchProducts(query);
  return NextResponse.json(result);
}
```

- [ ] **Step 3: Route panier**

```ts
// src/app/api/cart/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getCart, addToCart } from "@/lib/carrefour/client";

export async function GET() {
  const cart = await getCart();
  return NextResponse.json(cart);
}

export async function PATCH(request: NextRequest) {
  const { ean, basketServiceId, quantity } = await request.json();
  if (!ean || !basketServiceId) {
    return NextResponse.json(
      { error: "ean et basketServiceId requis" },
      { status: 400 }
    );
  }

  const cart = await addToCart(ean, basketServiceId, quantity ?? 1);
  return NextResponse.json(cart);
}
```

- [ ] **Step 4: Route créneaux**

```ts
// src/app/api/slots/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getFirstSlot } from "@/lib/carrefour/client";

export async function GET(request: NextRequest) {
  const storeRef = request.nextUrl.searchParams.get("storeRef");
  if (!storeRef) {
    return NextResponse.json({ error: "storeRef requis" }, { status: 400 });
  }

  const slot = await getFirstSlot(storeRef);
  return NextResponse.json({ slot });
}
```

- [ ] **Step 5: Commit**

```bash
git add src/app/api/ && git commit -m "feat: add API routes (stores, search, cart, slots)"
```

---

### Task 6: Parsing liste de courses + détection ambiguïtés via Claude

**Files:**
- Create: `src/lib/claude/parse-grocery-list.ts`
- Create: `src/app/api/parse-list/route.ts`

- [ ] **Step 1: Implémenter le parsing avec détection d'ambiguïtés**

```ts
// src/lib/claude/parse-grocery-list.ts
import Anthropic from "@anthropic-ai/sdk";
import type { ParsedGroceryItem } from "@/lib/carrefour/types";

const client = new Anthropic();

/**
 * Parse une liste de courses en langage naturel.
 * Détecte les items ambigus (trop vagues) et incompris (erreurs de dictée).
 * Retourne chaque item avec un status: "clear" | "ambiguous" | "unrecognized".
 */
export async function parseGroceryList(
  rawText: string
): Promise<ParsedGroceryItem[]> {
  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2048,
    messages: [
      {
        role: "user",
        content: `Tu es un assistant qui transforme une liste de courses en français en requêtes de recherche pour Carrefour.

Pour chaque produit mentionné, retourne un objet JSON avec :
- "query" : la requête de recherche optimisée pour Carrefour (ex: "lait demi ecreme 1L")
- "originalText" : le texte brut de l'utilisateur pour ce produit
- "quantity" : la quantité (nombre, défaut 1)
- "unit" : l'unité si précisée ("L", "kg", "g", etc.)
- "brand" : la marque si précisée
- "status" : l'un de ces 3 statuts :
  - "clear" : le produit est suffisamment précis pour une recherche
  - "ambiguous" : le produit est trop vague (ex: "du lait" sans type, "des pâtes" sans forme)
  - "unrecognized" : le texte semble être une erreur de dictée vocale ou n'est pas un produit alimentaire/ménager
- "clarificationQuestion" : (si ambigu) une question courte pour l'utilisateur, en français
- "suggestions" : (si ambigu ou incompris) 2 à 4 suggestions de ce que l'utilisateur voulait peut-être dire

Exemples :
- "2 litres de lait demi-écrémé" → status "clear", query "lait demi ecreme 2L"
- "du lait" → status "ambiguous", question "Quel type de lait ?", suggestions ["lait demi-écrémé", "lait entier", "lait écrémé"]
- "des passes pen" → status "unrecognized", suggestions ["des pâtes penne", "des pastèques"]
- "3 steaks hachés 5%" → status "clear", query "steak haché 5% MG"

Retourne UNIQUEMENT un tableau JSON, sans texte autour.

Liste de courses :
${rawText}`,
      },
    ],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return [];

  return JSON.parse(jsonMatch[0]);
}
```

- [ ] **Step 2: Route API**

```ts
// src/app/api/parse-list/route.ts
import { NextRequest, NextResponse } from "next/server";
import { parseGroceryList } from "@/lib/claude/parse-grocery-list";

export async function POST(request: NextRequest) {
  const { text } = await request.json();
  if (!text?.trim()) {
    return NextResponse.json({ error: "text requis" }, { status: 400 });
  }

  const items = await parseGroceryList(text);
  return NextResponse.json({ items });
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/claude/ src/app/api/parse-list/ && git commit -m "feat: add Claude grocery list parser"
```

---

### Task 7: Hook Web Speech API (dictée + synthèse vocale)

**Files:**
- Create: `src/lib/speech/use-speech.ts`

- [ ] **Step 1: Implémenter le hook**

```ts
// src/lib/speech/use-speech.ts
"use client";

import { useState, useCallback, useRef } from "react";

interface UseSpeechReturn {
  /** Texte reconnu par la dictée */
  transcript: string;
  /** La dictée est en cours */
  isListening: boolean;
  /** Démarrer la dictée vocale */
  startListening: () => void;
  /** Arrêter la dictée vocale */
  stopListening: () => void;
  /** Lire un texte à voix haute */
  speak: (text: string) => Promise<void>;
  /** La synthèse vocale est en cours */
  isSpeaking: boolean;
  /** La dictée est supportée par le navigateur */
  isSupported: boolean;
}

export function useSpeech(): UseSpeechReturn {
  const [transcript, setTranscript] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const isSupported =
    typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  const startListening = useCallback(() => {
    if (!isSupported) return;

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = "fr-FR";
    recognition.continuous = true;
    recognition.interimResults = false;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const results = Array.from(event.results);
      const text = results.map((r) => r[0].transcript).join(" ");
      setTranscript(text);
    };

    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [isSupported]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  const speak = useCallback((text: string): Promise<void> => {
    return new Promise((resolve) => {
      if (typeof window === "undefined" || !window.speechSynthesis) {
        resolve();
        return;
      }

      // Annuler toute synthèse en cours
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "fr-FR";
      utterance.rate = 0.95;
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => {
        setIsSpeaking(false);
        resolve();
      };
      utterance.onerror = () => {
        setIsSpeaking(false);
        resolve();
      };

      window.speechSynthesis.speak(utterance);
    });
  }, []);

  return {
    transcript,
    isListening,
    isSpeaking,
    startListening,
    stopListening,
    speak,
    isSupported,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/speech/ && git commit -m "feat: add Web Speech API hook (dictation + synthesis)"
```

---

### Task 8: Composants UI accessibles

**Files:**
- Create: `src/components/live-region.tsx`
- Create: `src/components/accessibility-bar.tsx`
- Create: `src/components/store-selector.tsx`
- Create: `src/components/grocery-input.tsx`
- Create: `src/components/list-clarification.tsx`
- Create: `src/components/product-results.tsx`
- Create: `src/components/cart-summary.tsx`

- [ ] **Step 1: Zone aria-live pour annonces**

```tsx
// src/components/live-region.tsx
"use client";

interface LiveRegionProps {
  message: string;
}

export function LiveRegion({ message }: LiveRegionProps) {
  return (
    <div
      aria-live="assertive"
      aria-atomic="true"
      role="status"
      className="sr-only"
    >
      {message}
    </div>
  );
}
```

- [ ] **Step 2: Input liste de courses**

```tsx
// src/components/grocery-input.tsx
"use client";

import { useState } from "react";

interface GroceryInputProps {
  onSubmit: (text: string) => void;
  isLoading: boolean;
  isListening: boolean;
  onMicClick: () => void;
  transcript: string;
  isMicSupported: boolean;
}

export function GroceryInput({
  onSubmit,
  isLoading,
  isListening,
  onMicClick,
  transcript,
  isMicSupported,
}: GroceryInputProps) {
  const [text, setText] = useState("");
  const displayText = isListening ? transcript : text;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const value = displayText.trim();
    if (value) onSubmit(value);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <label htmlFor="grocery-list" className="block text-lg font-semibold">
        Votre liste de courses
      </label>
      <p id="grocery-help" className="text-sm text-[var(--text-muted)]">
        Tapez ou dictez vos produits. Exemple : 2 litres de lait, des pâtes, 6
        yaourts nature
      </p>
      <textarea
        id="grocery-list"
        aria-describedby="grocery-help"
        value={displayText}
        onChange={(e) => setText(e.target.value)}
        placeholder="2 litres de lait, des pâtes penne, 6 yaourts nature, du jambon blanc..."
        rows={4}
        className="w-full p-4 rounded-lg bg-[var(--bg-surface)] border-2 border-[var(--border)] text-[var(--text)] placeholder:text-[var(--text-muted)] text-lg resize-none focus:border-[var(--accent)]"
        disabled={isLoading}
      />
      <div className="flex gap-3">
        {isMicSupported && (
          <button
            type="button"
            onClick={onMicClick}
            aria-label={isListening ? "Arrêter la dictée" : "Dicter ma liste"}
            className={`px-6 py-3 rounded-lg font-semibold text-lg transition-colors ${
              isListening
                ? "bg-[var(--danger)] text-white"
                : "bg-[var(--bg-surface)] border-2 border-[var(--border)] text-[var(--text)] hover:border-[var(--accent)]"
            }`}
          >
            {isListening ? "Arrêter" : "Dicter"}
          </button>
        )}
        <button
          type="submit"
          disabled={isLoading || !displayText.trim()}
          className="flex-1 px-6 py-3 rounded-lg bg-[var(--accent)] text-[var(--bg)] font-bold text-lg hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? "Recherche en cours..." : "Trouver mes produits"}
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 3: Résultats produits**

```tsx
// src/components/product-results.tsx
"use client";

import type { CarrefourProduct } from "@/lib/carrefour/types";

interface ProductResultsProps {
  items: {
    query: string;
    product: CarrefourProduct | null;
    alternatives: CarrefourProduct[];
  }[];
  onConfirm: (ean: string) => void;
  onReject: (query: string) => void;
  confirmedEans: Set<string>;
}

export function ProductResults({
  items,
  onConfirm,
  onReject,
  confirmedEans,
}: ProductResultsProps) {
  if (items.length === 0) return null;

  return (
    <section aria-label="Produits trouvés">
      <h2 className="text-xl font-bold mb-4">
        Produits trouvés ({items.length})
      </h2>
      <ul className="space-y-4">
        {items.map((item) => {
          const p = item.product;
          if (!p) {
            return (
              <li
                key={item.query}
                className="p-4 rounded-lg bg-[var(--bg-surface)] border border-[var(--danger)]"
              >
                <p>
                  Aucun résultat pour <strong>{item.query}</strong>
                </p>
              </li>
            );
          }

          const isConfirmed = confirmedEans.has(p.ean);

          return (
            <li
              key={p.ean}
              className={`p-4 rounded-lg bg-[var(--bg-surface)] border-2 transition-colors ${
                isConfirmed
                  ? "border-[var(--success)]"
                  : "border-[var(--border)]"
              }`}
            >
              <div className="flex justify-between items-start gap-4">
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">{p.title}</h3>
                  <p className="text-[var(--text-muted)]">
                    {p.brand} — {p.packaging}
                    {p.nutriscore && ` — Nutriscore ${p.nutriscore}`}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-[var(--accent)]">
                    {p.price?.toFixed(2)}€
                  </p>
                  {p.perUnitLabel && (
                    <p className="text-sm text-[var(--text-muted)]">
                      {p.perUnitLabel}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => onConfirm(p.ean)}
                  disabled={isConfirmed}
                  aria-label={`${isConfirmed ? "Confirmé" : "Confirmer"} ${p.title}`}
                  className={`px-4 py-2 rounded font-semibold transition-colors ${
                    isConfirmed
                      ? "bg-[var(--success)] text-[var(--bg)]"
                      : "bg-[var(--bg)] border border-[var(--success)] text-[var(--success)] hover:bg-[var(--success)] hover:text-[var(--bg)]"
                  }`}
                >
                  {isConfirmed ? "Confirmé" : "Confirmer"}
                </button>
                {!isConfirmed && (
                  <button
                    onClick={() => onReject(item.query)}
                    aria-label={`Refuser ${p.title}`}
                    className="px-4 py-2 rounded border border-[var(--danger)] text-[var(--danger)] hover:bg-[var(--danger)] hover:text-white transition-colors"
                  >
                    Autre choix
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
```

- [ ] **Step 4: Résumé panier**

```tsx
// src/components/cart-summary.tsx
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
```

- [ ] **Step 5: Barre d'accessibilité**

```tsx
// src/components/accessibility-bar.tsx
"use client";

import { useState, useEffect } from "react";

export function AccessibilityBar() {
  const [theme, setTheme] = useState("dark");
  const [fontSize, setFontSize] = useState("1.125rem");
  const [voiceEnabled, setVoiceEnabled] = useState(false);

  useEffect(() => {
    document.body.className = theme === "dark" ? "" : `theme-${theme}`;
  }, [theme]);

  useEffect(() => {
    document.documentElement.style.setProperty("--font-size-base", fontSize);
  }, [fontSize]);

  return (
    <div
      role="region"
      aria-label="Paramètres d'accessibilité"
      className="flex items-center gap-3 flex-wrap bg-[var(--bg-surface)] border-b border-[var(--border)] px-4 py-2 text-sm"
    >
      <label htmlFor="theme-select" className="font-semibold text-[var(--text-muted)]">
        Thème :
      </label>
      <select
        id="theme-select"
        value={theme}
        onChange={(e) => setTheme(e.target.value)}
        className="bg-[var(--bg)] text-[var(--text)] border border-[var(--border)] rounded px-2 py-1 text-sm"
      >
        <option value="dark">Sombre</option>
        <option value="light">Clair</option>
        <option value="high-contrast">Contraste élevé</option>
      </select>

      <div className="border-l border-[var(--border)] h-5" aria-hidden="true" />

      <label htmlFor="font-size" className="font-semibold text-[var(--text-muted)]">
        Taille :
      </label>
      <select
        id="font-size"
        value={fontSize}
        onChange={(e) => setFontSize(e.target.value)}
        className="bg-[var(--bg)] text-[var(--text)] border border-[var(--border)] rounded px-2 py-1 text-sm"
      >
        <option value="1.125rem">Normal</option>
        <option value="1.3rem">Grand</option>
        <option value="1.5rem">Très grand</option>
        <option value="1.8rem">Maximum</option>
      </select>

      <div className="border-l border-[var(--border)] h-5" aria-hidden="true" />

      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={voiceEnabled}
          onChange={(e) => setVoiceEnabled(e.target.checked)}
          className="w-4 h-4 accent-[var(--accent)]"
        />
        <span className="font-semibold text-[var(--text-muted)]">Retour vocal</span>
      </label>
    </div>
  );
}
```

- [ ] **Step 6: Sélecteur de magasin**

```tsx
// src/components/store-selector.tsx
"use client";

import { useState } from "react";
import type { CarrefourStore } from "@/lib/carrefour/types";

interface StoreSelectorProps {
  onStoreSelected: (store: CarrefourStore, basketServiceId: string) => void;
}

export function StoreSelector({ onStoreSelected }: StoreSelectorProps) {
  const [postalCode, setPostalCode] = useState("");
  const [stores, setStores] = useState<CarrefourStore[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedRef, setSelectedRef] = useState<string | null>(null);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!postalCode.trim()) return;
    setIsLoading(true);
    const res = await fetch(`/api/stores?postalCode=${postalCode}`);
    const data = await res.json();
    setStores(data.stores || []);
    setIsLoading(false);
  }

  async function handleSelect(store: CarrefourStore) {
    setSelectedRef(store.ref);
    const res = await fetch("/api/stores", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ storeRef: store.ref }),
    });
    const data = await res.json();
    onStoreSelected(store, data.basketServiceId);
  }

  return (
    <section aria-label="Choix du magasin">
      <h2 className="text-xl font-bold mb-4">Choisir votre magasin</h2>
      <form onSubmit={handleSearch} className="flex gap-3 mb-4">
        <label htmlFor="postal-code" className="sr-only">
          Code postal
        </label>
        <input
          id="postal-code"
          type="text"
          inputMode="numeric"
          pattern="[0-9]{5}"
          value={postalCode}
          onChange={(e) => setPostalCode(e.target.value)}
          placeholder="Code postal (ex: 57360)"
          className="flex-1 p-3 rounded-lg bg-[var(--bg-surface)] border-2 border-[var(--border)] text-[var(--text)] text-lg"
          aria-describedby="cp-help"
        />
        <button
          type="submit"
          disabled={isLoading || postalCode.length < 5}
          className="px-6 py-3 rounded-lg bg-[var(--accent)] text-[var(--bg)] font-bold disabled:opacity-50"
        >
          {isLoading ? "Recherche..." : "Chercher"}
        </button>
      </form>
      <p id="cp-help" className="text-sm text-[var(--text-muted)] mb-4">
        Entrez votre code postal pour trouver les magasins Carrefour proches.
      </p>

      {stores.length > 0 && (
        <fieldset>
          <legend className="font-semibold mb-2">
            {stores.length} magasin(s) trouvé(s) :
          </legend>
          <div className="space-y-2" role="radiogroup">
            {stores.map((store) => (
              <label
                key={store.ref}
                className={`flex items-center gap-3 p-4 rounded-lg cursor-pointer border-2 transition-colors ${
                  selectedRef === store.ref
                    ? "border-[var(--success)] bg-[var(--bg-surface)]"
                    : "border-[var(--border)] hover:border-[var(--accent)]"
                }`}
              >
                <input
                  type="radio"
                  name="store"
                  value={store.ref}
                  checked={selectedRef === store.ref}
                  onChange={() => handleSelect(store)}
                  className="w-5 h-5 accent-[var(--accent)]"
                />
                <div>
                  <div className="font-semibold">{store.name}</div>
                  <div className="text-sm text-[var(--text-muted)]">
                    {store.format} — {store.distance} km
                  </div>
                </div>
              </label>
            ))}
          </div>
        </fieldset>
      )}
    </section>
  );
}
```

- [ ] **Step 7: Composant de clarification**

```tsx
// src/components/list-clarification.tsx
"use client";

import type { ParsedGroceryItem } from "@/lib/carrefour/types";

interface ListClarificationProps {
  items: ParsedGroceryItem[];
  onUpdate: (index: number, update: Partial<ParsedGroceryItem>) => void;
  onValidate: () => void;
}

export function ListClarification({
  items,
  onUpdate,
  onValidate,
}: ListClarificationProps) {
  const needsClarification = items.some((i) => i.status !== "clear");
  const allClear = items.every((i) => i.status === "clear");

  return (
    <section aria-label="Vérification de la liste">
      <h2 className="text-xl font-bold mb-2">Vérification de votre liste</h2>
      <p className="text-[var(--text-muted)] mb-4">
        {allClear
          ? `${items.length} produits prêts pour la recherche.`
          : `${items.filter((i) => i.status === "clear").length} clairs, ${items.filter((i) => i.status !== "clear").length} à préciser.`}
      </p>

      <ul className="space-y-3" role="list">
        {items.map((item, index) => (
          <li
            key={index}
            className={`p-4 rounded-lg border-2 ${
              item.status === "clear"
                ? "border-[var(--success)] bg-[var(--bg-surface)]"
                : item.status === "ambiguous"
                  ? "border-[var(--accent)] bg-[var(--bg-surface)]"
                  : "border-[var(--danger)] bg-[var(--bg-surface)]"
            }`}
          >
            <div className="flex items-start gap-3">
              <span
                aria-hidden="true"
                className={`text-lg ${
                  item.status === "clear"
                    ? "text-[var(--success)]"
                    : item.status === "ambiguous"
                      ? "text-[var(--accent)]"
                      : "text-[var(--danger)]"
                }`}
              >
                {item.status === "clear" ? "✓" : item.status === "ambiguous" ? "?" : "✗"}
              </span>
              <div className="flex-1">
                <div className="font-semibold">{item.originalText}</div>
                {item.status === "clear" && (
                  <div className="text-sm text-[var(--text-muted)]">
                    Recherche : {item.query}
                  </div>
                )}
                {item.clarificationQuestion && (
                  <div className="mt-2 font-medium">{item.clarificationQuestion}</div>
                )}
                {item.suggestions && item.suggestions.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {item.suggestions.map((suggestion) => (
                      <button
                        key={suggestion}
                        onClick={() =>
                          onUpdate(index, {
                            query: suggestion,
                            status: "clear",
                            clarificationQuestion: undefined,
                            suggestions: undefined,
                          })
                        }
                        className="px-3 py-1.5 rounded border border-[var(--accent)] text-[var(--accent)] text-sm hover:bg-[var(--accent)] hover:text-[var(--bg)] transition-colors"
                        aria-label={`Choisir : ${suggestion}`}
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>

      <button
        onClick={onValidate}
        disabled={!allClear}
        className="w-full mt-6 px-6 py-4 rounded-lg bg-[var(--accent)] text-[var(--bg)] font-bold text-lg disabled:opacity-50 transition-colors"
        aria-label={
          allClear
            ? `Lancer la recherche pour ${items.length} produits`
            : "Précisez tous les produits avant de lancer la recherche"
        }
      >
        {allClear ? "Lancer la recherche" : "Précisez les produits marqués pour continuer"}
      </button>
    </section>
  );
}
```

- [ ] **Step 8: Commit**

```bash
git add src/components/ && git commit -m "feat: add accessible UI components (accessibility bar, store selector, clarification, input, results, cart)"
```

---

### Task 9: Page principale — Assemblage du flow complet

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Implémenter la page principale**

```tsx
// src/app/page.tsx
"use client";

import { useState, useCallback, useEffect } from "react";
import { GroceryInput } from "@/components/grocery-input";
import { ProductResults } from "@/components/product-results";
import { CartSummary } from "@/components/cart-summary";
import { LiveRegion } from "@/components/live-region";
import { useSpeech } from "@/lib/speech/use-speech";
import type {
  CarrefourProduct,
  Cart,
  DeliverySlot,
  ParsedGroceryItem,
} from "@/lib/carrefour/types";

interface MatchedItem {
  query: string;
  product: CarrefourProduct | null;
  alternatives: CarrefourProduct[];
}

export default function Home() {
  const [step, setStep] = useState<"input" | "results" | "cart">("input");
  const [isLoading, setIsLoading] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [matchedItems, setMatchedItems] = useState<MatchedItem[]>([]);
  const [confirmedEans, setConfirmedEans] = useState<Set<string>>(new Set());
  const [cart, setCart] = useState<Cart | null>(null);
  const [slot, setSlot] = useState<DeliverySlot | null>(null);
  const [basketServiceId, setBsid] = useState<string | null>(null);
  const [storeRef, setStoreRef] = useState<string | null>(null);

  const { transcript, isListening, startListening, stopListening, speak, isSupported } =
    useSpeech();

  const announce = useCallback(
    (msg: string) => {
      setAnnouncement(msg);
      speak(msg);
    },
    [speak]
  );

  // Setup magasin au chargement (code postal par défaut pour le MVP)
  useEffect(() => {
    async function setupStore() {
      const res = await fetch("/api/stores?postalCode=57360");
      const data = await res.json();
      if (data.stores?.[0]) {
        const store = data.stores[0];
        setStoreRef(store.ref);
        const storeRes = await fetch("/api/stores", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ storeRef: store.ref }),
        });
        const storeData = await storeRes.json();
        setBsid(storeData.basketServiceId);

        const slotRes = await fetch(`/api/slots?storeRef=${store.ref}`);
        const slotData = await slotRes.json();
        setSlot(slotData.slot);
      }
    }
    setupStore();
  }, []);

  async function handleSubmit(text: string) {
    setIsLoading(true);
    announce("Je cherche vos produits...");

    // 1. Parser la liste via Claude
    const parseRes = await fetch("/api/parse-list", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
    });
    const { items }: { items: ParsedGroceryItem[] } = await parseRes.json();
    announce(`${items.length} produits identifiés. Recherche en cours...`);

    // 2. Rechercher chaque produit
    const matched: MatchedItem[] = [];
    for (const item of items) {
      const searchRes = await fetch(
        `/api/search?q=${encodeURIComponent(item.query)}`
      );
      const searchData = await searchRes.json();
      const products: CarrefourProduct[] = searchData.products || [];

      matched.push({
        query: item.query,
        product: products[0] || null,
        alternatives: products.slice(1, 4),
      });
    }

    setMatchedItems(matched);
    setStep("results");
    setIsLoading(false);

    const found = matched.filter((m) => m.product).length;
    announce(
      `${found} produits trouvés sur ${items.length}. Vérifiez et confirmez chaque produit.`
    );
  }

  function handleConfirm(ean: string) {
    setConfirmedEans((prev) => new Set([...prev, ean]));
    const product = matchedItems.find((m) => m.product?.ean === ean)?.product;
    if (product) {
      announce(`${product.title} confirmé. ${product.price?.toFixed(2)} euros.`);
    }
  }

  function handleReject(query: string) {
    // Pour le MVP : on passe au produit alternatif suivant
    setMatchedItems((prev) =>
      prev.map((item) => {
        if (item.query === query && item.alternatives.length > 0) {
          const [next, ...rest] = item.alternatives;
          announce(
            `Nouveau choix : ${next.title}, ${next.price?.toFixed(2)} euros.`
          );
          return { ...item, product: next, alternatives: rest };
        }
        return item;
      })
    );
  }

  async function handleAddToCart() {
    if (!basketServiceId) {
      announce("Erreur : aucun magasin sélectionné.");
      return;
    }

    setIsLoading(true);
    announce("Ajout des produits au panier...");

    const confirmedProducts = matchedItems
      .filter((m) => m.product && confirmedEans.has(m.product.ean))
      .map((m) => m.product!);

    let lastCart: Cart | null = null;
    for (const product of confirmedProducts) {
      const res = await fetch("/api/cart", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ean: product.ean,
          basketServiceId,
          quantity: 1,
        }),
      });
      lastCart = await res.json();
    }

    setCart(lastCart);
    setStep("cart");
    setIsLoading(false);

    if (lastCart) {
      announce(
        `Panier rempli. ${lastCart.items.length} produits pour ${lastCart.totalAmount.toFixed(2)} euros. Vous pouvez valider et payer sur Carrefour.`
      );
    }
  }

  function handleCheckout() {
    window.open("https://www.carrefour.fr/mon-panier", "_blank");
    announce("Redirection vers Carrefour pour le paiement.");
  }

  const allConfirmed =
    matchedItems.length > 0 &&
    matchedItems
      .filter((m) => m.product)
      .every((m) => confirmedEans.has(m.product!.ean));

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
      <LiveRegion message={announcement} />

      <header>
        <h1 className="text-3xl font-bold">VoixCourses</h1>
        <p className="text-[var(--text-muted)] mt-1">
          Dictez ou tapez votre liste. L'IA remplit votre panier Carrefour.
        </p>
      </header>

      {step === "input" && (
        <GroceryInput
          onSubmit={handleSubmit}
          isLoading={isLoading}
          isListening={isListening}
          onMicClick={isListening ? stopListening : startListening}
          transcript={transcript}
          isMicSupported={isSupported}
        />
      )}

      {step === "results" && (
        <>
          <ProductResults
            items={matchedItems}
            onConfirm={handleConfirm}
            onReject={handleReject}
            confirmedEans={confirmedEans}
          />
          {allConfirmed && (
            <button
              onClick={handleAddToCart}
              disabled={isLoading}
              className="w-full px-6 py-4 rounded-lg bg-[var(--accent)] text-[var(--bg)] font-bold text-lg hover:bg-[var(--accent-hover)] disabled:opacity-50 transition-colors"
            >
              {isLoading
                ? "Ajout en cours..."
                : "Ajouter tout au panier Carrefour"}
            </button>
          )}
        </>
      )}

      {step === "cart" && (
        <CartSummary
          cart={cart}
          slot={slot}
          onCheckout={handleCheckout}
          isLoading={isLoading}
        />
      )}

      {step !== "input" && (
        <button
          onClick={() => {
            setStep("input");
            setMatchedItems([]);
            setConfirmedEans(new Set());
            setCart(null);
          }}
          className="text-[var(--text-muted)] underline"
        >
          Nouvelle liste
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/page.tsx && git commit -m "feat: assemble full flow on main page"
```

---

### Task 10: Variables d'environnement et déploiement

**Files:**
- Create: `.env.local`
- Create: `.gitignore` additions

- [ ] **Step 1: Créer .env.local**

```bash
echo 'ANTHROPIC_API_KEY=your-key-here' > .env.local
```

- [ ] **Step 2: Vérifier .gitignore**

S'assurer que `.env.local` et `node_modules` sont dans `.gitignore` (create-next-app le fait normalement).

```bash
grep -q '.env.local' .gitignore || echo '.env.local' >> .gitignore
```

- [ ] **Step 3: Tester le flow complet en local**

```bash
npm run dev
```

1. Ouvrir `http://localhost:3000`
2. Taper "2 litres de lait, des pâtes, du jambon"
3. Vérifier que les produits Carrefour apparaissent avec prix
4. Confirmer chaque produit
5. Cliquer "Ajouter tout au panier"
6. Vérifier le résumé du panier

- [ ] **Step 4: Build de production**

```bash
npm run build
```

- [ ] **Step 5: Commit final**

```bash
git add -A && git commit -m "feat: VoixCourses MVP complete - voice grocery list to Carrefour cart"
```

- [ ] **Step 6: Déployer sur Vercel**

```bash
npx vercel --prod
```

Configurer la variable `ANTHROPIC_API_KEY` dans les settings Vercel.

---

## Notes d'implémentation

### Limites du MVP (volontaires)

- **Pas de DB** : stateless, pas de préférences ni d'historique
- **Pas d'auth utilisateur** : pas de comptes VoixCourses
- **Code postal en dur** (57360) : la sélection de magasin sera ajoutée en phase 2
- **Pas de gestion des quantités** dans le panier (toujours 1)
- **Pas de i18n** : français uniquement

### Performance Vercel

- Le premier appel sera lent (~5-10s) car Chromium doit se lancer
- Les appels suivants réutilisent l'instance via Fluid Compute (~300ms)
- Le timeout par défaut de 300s est suffisant
- `serverExternalPackages` dans next.config est nécessaire pour Playwright

### Accessibilité

- `aria-live="assertive"` sur la LiveRegion pour annoncer chaque étape
- `speak()` appelé à chaque transition pour feedback vocal
- Skip link "Aller au contenu principal" dans le layout
- Contraste AAA (ratio 7:1 minimum)
- Navigation 100% clavier (Tab, Enter, Espace)
- Pas de timeout sur les actions
