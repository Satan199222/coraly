"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { AccessibilityBar } from "@/components/accessibility-bar";
import { LiveRegion } from "@/components/live-region";
import { StoreSelector } from "@/components/store-selector";
import { GroceryInput } from "@/components/grocery-input";
import { ListClarification } from "@/components/list-clarification";
import { ProductResults } from "@/components/product-results";
import { CartSummary } from "@/components/cart-summary";
import { useSpeech } from "@/lib/speech/use-speech";
import { useFocusAnnounce } from "@/lib/speech/use-focus-announce";
import type {
  CarrefourProduct,
  Cart,
  DeliverySlot,
  ParsedGroceryItem,
  CarrefourStore,
} from "@/lib/carrefour/types";

type Step = "store" | "input" | "clarification" | "results" | "cart";

interface MatchedItem {
  query: string;
  product: CarrefourProduct | null;
  alternatives: CarrefourProduct[];
}

export default function Home() {
  // ── State machine ──────────────────────────────────────────────────────────
  const [step, setStep] = useState<Step>("store");
  const [isLoading, setIsLoading] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  // ── Store / slot ───────────────────────────────────────────────────────────
  const [storeRef, setStoreRef] = useState<string | null>(null);
  const [basketServiceId, setBasketServiceId] = useState<string | null>(null);
  const [slot, setSlot] = useState<DeliverySlot | null>(null);

  // ── Parsed items (clarification phase) ────────────────────────────────────
  const [parsedItems, setParsedItems] = useState<ParsedGroceryItem[]>([]);

  // ── Results phase ──────────────────────────────────────────────────────────
  const [matchedItems, setMatchedItems] = useState<MatchedItem[]>([]);
  const [confirmedEans, setConfirmedEans] = useState<Set<string>>(new Set());

  // ── Add-a-product input (bottom of results) ────────────────────────────────
  const [addQuery, setAddQuery] = useState("");
  const [isAddingProduct, setIsAddingProduct] = useState(false);

  // ── Cart phase ─────────────────────────────────────────────────────────────
  const [cart, setCart] = useState<Cart | null>(null);

  // ── Accessibility / speech ─────────────────────────────────────────────────
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const { transcript, isListening, startListening, stopListening, speak, isSupported } =
    useSpeech();

  // Voix qui suit le focus clavier (opt-in via la barre d'accessibilité)
  useFocusAnnounce(voiceEnabled);

  // ── Focus management ───────────────────────────────────────────────────────
  // On place le focus sur le heading de l'étape courante (h2) plutôt que sur
  // un <div> générique. Le screen reader annonce ainsi le contexte immédiat
  // ("Choisir votre magasin, niveau 2") plutôt que tout le header de la page.
  const stepHeadingRef = useRef<HTMLHeadingElement>(null);

  const focusStepHeading = useCallback(() => {
    setTimeout(() => {
      stepHeadingRef.current?.focus();
    }, 50);
  }, []);

  // ── Announce helper (aria-live + optional TTS) ─────────────────────────────
  const announce = useCallback(
    (msg: string) => {
      setAnnouncement(msg);
      if (voiceEnabled) {
        speak(msg);
      }
    },
    [speak, voiceEnabled]
  );

  // ── On mount: check localStorage for previously selected store ────────────
  useEffect(() => {
    const savedRef = localStorage.getItem("storeRef");
    const savedBsid = localStorage.getItem("basketServiceId");
    if (savedRef && savedBsid) {
      setStoreRef(savedRef);
      setBasketServiceId(savedBsid);
      setStep("input");
      // Fetch delivery slot in background
      fetch(`/api/slots?storeRef=${savedRef}`)
        .then((r) => r.json())
        .then((d) => setSlot(d.slot ?? null))
        .catch(() => null);
    }
  }, []);

  // ── Step transitions: move focus to step heading ──────────────────────────
  useEffect(() => {
    focusStepHeading();
  }, [step, focusStepHeading]);

  // Titre dynamique selon l'étape (lu par le screen reader au changement de focus)
  const stepTitle = {
    store: "Étape 1 sur 4 : Choisissez votre magasin",
    input: "Étape 2 sur 4 : Votre liste de courses",
    clarification: "Étape 3 sur 4 : Précisez votre liste",
    results: "Étape 3 sur 4 : Choisissez vos produits",
    cart: "Étape 4 sur 4 : Votre panier",
  }[step];

  // ── Store selected ─────────────────────────────────────────────────────────
  async function handleStoreSelected(store: CarrefourStore, bsid: string) {
    setStoreRef(store.ref);
    setBasketServiceId(bsid);
    localStorage.setItem("storeRef", store.ref);
    localStorage.setItem("basketServiceId", bsid);

    // Fetch first delivery slot
    try {
      const res = await fetch(`/api/slots?storeRef=${store.ref}`);
      const data = await res.json();
      setSlot(data.slot ?? null);
    } catch {
      // non-fatal
    }

    announce(`Magasin ${store.name} sélectionné. Vous pouvez dicter votre liste.`);
    setStep("input");
  }

  // ── Grocery list submitted ─────────────────────────────────────────────────
  async function handleSubmit(text: string) {
    setIsLoading(true);
    announce("Analyse de votre liste en cours...");

    try {
      // 1. Parse the list via Claude
      const parseRes = await fetch("/api/parse-list", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const { items }: { items: ParsedGroceryItem[] } = await parseRes.json();

      const needsClarification = items.some((i) => i.status !== "clear");

      if (needsClarification) {
        setParsedItems(items);
        setIsLoading(false);
        const toReview = items.filter((i) => i.status !== "clear").length;
        announce(`${toReview} produit(s) à préciser avant de lancer la recherche.`);
        setStep("clarification");
      } else {
        // All clear — skip straight to search
        await runSearch(items);
      }
    } catch {
      announce("Une erreur est survenue lors de l'analyse. Veuillez réessayer.");
      setIsLoading(false);
    }
  }

  // ── Clarification validated ────────────────────────────────────────────────
  async function handleClarificationValidate() {
    setIsLoading(true);
    announce("Recherche des produits en cours...");
    await runSearch(parsedItems);
  }

  // ── Run search for a list of parsed items ─────────────────────────────────
  async function runSearch(items: ParsedGroceryItem[]) {
    try {
      const matched: MatchedItem[] = await Promise.all(
        items.map(async (item) => {
          try {
            const searchRes = await fetch(
              `/api/search?q=${encodeURIComponent(item.query)}`
            );
            const searchData = await searchRes.json();
            const products: CarrefourProduct[] = searchData.products || [];
            return {
              query: item.query,
              product: products[0] ?? null,
              alternatives: products.slice(1, 4),
            };
          } catch {
            return { query: item.query, product: null, alternatives: [] };
          }
        })
      );

      setMatchedItems(matched);
      setConfirmedEans(new Set());
      setStep("results");
      setIsLoading(false);

      const found = matched.filter((m) => m.product).length;
      announce(
        `${found} produit(s) trouvé(s) sur ${items.length}. Vérifiez et confirmez chaque produit.`
      );
    } catch {
      announce("Une erreur est survenue lors de la recherche. Veuillez réessayer.");
      setIsLoading(false);
    }
  }

  // ── Confirm / reject product ───────────────────────────────────────────────
  function handleConfirm(ean: string) {
    setConfirmedEans((prev) => new Set([...prev, ean]));
    const product = matchedItems.find((m) => m.product?.ean === ean)?.product;
    if (product) {
      announce(`${product.title} confirmé. ${product.price?.toFixed(2) ?? "?"} euros.`);
    }
  }

  function handleReject(query: string) {
    setMatchedItems((prev) =>
      prev.map((item) => {
        if (item.query === query && item.alternatives.length > 0) {
          const [next, ...rest] = item.alternatives;
          announce(`Nouveau choix : ${next.title}, ${next.price?.toFixed(2) ?? "?"} euros.`);
          return { ...item, product: next, alternatives: rest };
        }
        if (item.query === query && item.alternatives.length === 0) {
          announce(`Aucune alternative pour ${query}.`);
          return { ...item, product: null };
        }
        return item;
      })
    );
  }

  function handleRemove(query: string) {
    // Retrouver l'EAN associé à cette query AVANT de filtrer, pour pouvoir
    // le retirer de confirmedEans.
    const removedEan = matchedItems.find((item) => item.query === query)
      ?.product?.ean;

    setMatchedItems((prev) => prev.filter((item) => item.query !== query));

    if (removedEan) {
      setConfirmedEans((prev) => {
        const next = new Set(prev);
        next.delete(removedEan);
        return next;
      });
    }
    announce(`Produit retiré de la liste.`);
  }

  // ── Add a single product from results page ─────────────────────────────────
  async function handleAddProduct(e: React.FormEvent) {
    e.preventDefault();
    const q = addQuery.trim();
    if (!q) return;
    setIsAddingProduct(true);
    announce(`Recherche de ${q}...`);

    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      const products: CarrefourProduct[] = data.products || [];
      setMatchedItems((prev) => [
        ...prev,
        {
          query: q,
          product: products[0] ?? null,
          alternatives: products.slice(1, 4),
        },
      ]);
      setAddQuery("");
      if (products[0]) {
        announce(`${products[0].title} ajouté à la liste.`);
      } else {
        announce(`Aucun produit trouvé pour ${q}.`);
      }
    } catch {
      announce("Erreur lors de la recherche. Veuillez réessayer.");
    } finally {
      setIsAddingProduct(false);
    }
  }

  // ── Add confirmed products to cart ────────────────────────────────────────
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

    try {
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
          `Panier rempli. ${lastCart.items.length} produit(s) pour ${lastCart.totalAmount.toFixed(2)} euros. Vous pouvez valider et payer sur Carrefour.`
        );
      }
    } catch {
      announce("Une erreur est survenue lors de l'ajout au panier.");
      setIsLoading(false);
    }
  }

  // ── Checkout ───────────────────────────────────────────────────────────────
  function handleCheckout() {
    window.open("https://www.carrefour.fr/mon-panier", "_blank");
    announce("Redirection vers Carrefour pour le paiement.");
  }

  // ── Reset ──────────────────────────────────────────────────────────────────
  function handleNewList() {
    setParsedItems([]);
    setMatchedItems([]);
    setConfirmedEans(new Set());
    setCart(null);
    setAddQuery("");
    setStep("input");
  }

  // ── Derived ────────────────────────────────────────────────────────────────
  const allConfirmed =
    matchedItems.length > 0 &&
    matchedItems
      .filter((m) => m.product)
      .every((m) => confirmedEans.has(m.product!.ean));

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      {/* AccessibilityBar is always at the top; voiceEnabled lifted to page */}
      <AccessibilityBar onVoiceToggle={setVoiceEnabled} />

      {/* aria-live region rendered once, never removed */}
      <LiveRegion message={announcement} />

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
        <header>
          <h1 className="text-3xl font-bold">VoixCourses</h1>
          <p className="text-[var(--text-muted)] mt-1">
            Dictez ou tapez votre liste. L'IA remplit votre panier Carrefour.
          </p>
        </header>

        {/* Heading d'étape — reçoit le focus à chaque changement d'étape.
            Le screen reader annonce ainsi le contexte au lieu du header complet. */}
        <h2
          ref={stepHeadingRef}
          tabIndex={-1}
          className="sr-only focus:not-sr-only focus:text-xl focus:font-bold focus:outline-none"
          aria-live="polite"
        >
          {stepTitle}
        </h2>

        {/* Phase 1 — Store selection */}
        {step === "store" && (
          <StoreSelector onStoreSelected={handleStoreSelected} />
        )}

        {/* Phase 2 — Grocery list input */}
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

        {/* Phase 2.5 — Clarification */}
        {step === "clarification" && (
          <ListClarification
            items={parsedItems}
            onUpdate={(index, update) => {
              setParsedItems((prev) =>
                prev.map((item, i) => (i === index ? { ...item, ...update } : item))
              );
            }}
            onValidate={handleClarificationValidate}
          />
        )}

        {/* Phase 3 — Results */}
        {step === "results" && (
          <>
            {/* Skip link vers le bouton final — utile quand il y a beaucoup
                de produits. Visible uniquement au focus. */}
            {allConfirmed && (
              <a
                href="#add-to-cart-button"
                className="sr-only focus:not-sr-only focus:inline-block focus:px-4 focus:py-2 focus:bg-[var(--accent)] focus:text-[var(--bg)] focus:rounded focus:font-semibold"
              >
                Aller directement au bouton Ajouter au panier
              </a>
            )}

            <ProductResults
              items={matchedItems}
              onConfirm={handleConfirm}
              onReject={handleReject}
              onRemove={handleRemove}
              confirmedEans={confirmedEans}
            />

            {/* Add a product */}
            <form
              onSubmit={handleAddProduct}
              className="flex gap-3"
              aria-label="Ajouter un produit"
            >
              <label htmlFor="add-product" className="sr-only">
                Ajouter un produit à la liste
              </label>
              <input
                id="add-product"
                type="text"
                value={addQuery}
                onChange={(e) => setAddQuery(e.target.value)}
                placeholder="Ajouter un produit..."
                className="flex-1 p-3 rounded-lg bg-[var(--bg-surface)] border-2 border-[var(--border)] text-[var(--text)] placeholder:text-[var(--text-muted)] text-base focus:border-[var(--accent)]"
                disabled={isAddingProduct}
              />
              <button
                type="submit"
                disabled={isAddingProduct || !addQuery.trim()}
                className="px-5 py-3 rounded-lg bg-[var(--bg-surface)] border-2 border-[var(--accent)] text-[var(--accent)] font-semibold hover:bg-[var(--accent)] hover:text-[var(--bg)] disabled:opacity-50 transition-colors"
              >
                {isAddingProduct ? "..." : "Ajouter"}
              </button>
            </form>

            {/* Add to cart button — visible once all found products are confirmed */}
            {allConfirmed && (() => {
              // Calculer le total estimé pour l'annonce vocale
              const confirmedProducts = matchedItems
                .filter((m) => m.product && confirmedEans.has(m.product.ean))
                .map((m) => m.product!);
              const totalEstimated = confirmedProducts.reduce(
                (sum, p) => sum + (p.price ?? 0),
                0
              );
              const count = confirmedProducts.length;
              const totalText = totalEstimated.toFixed(2).replace(".", " euros ");

              return (
                <button
                  id="add-to-cart-button"
                  onClick={handleAddToCart}
                  disabled={isLoading}
                  aria-label={
                    isLoading
                      ? "Ajout en cours au panier Carrefour"
                      : `Ajouter au panier Carrefour : ${count} produit${count > 1 ? "s" : ""}, total estimé ${totalText}`
                  }
                  className="w-full px-6 py-4 rounded-lg bg-[var(--accent)] text-[var(--bg)] font-bold text-lg hover:bg-[var(--accent-hover)] disabled:opacity-50 transition-colors"
                >
                  {isLoading
                    ? "Ajout en cours..."
                    : `Ajouter tout au panier Carrefour (${count} produit${count > 1 ? "s" : ""}, ${totalEstimated.toFixed(2)}€)`}
                </button>
              );
            })()}
          </>
        )}

        {/* Phase 4 — Cart */}
        {step === "cart" && (
          <CartSummary
            cart={cart}
            slot={slot}
            onCheckout={handleCheckout}
            isLoading={isLoading}
          />
        )}

        {/* Back to new list */}
        {step !== "store" && step !== "input" && (
          <button
            onClick={handleNewList}
            className="text-[var(--text-muted)] underline text-sm"
          >
            Nouvelle liste
          </button>
        )}

        {/* Change store */}
        {step === "input" && (
          <button
            onClick={() => setStep("store")}
            className="text-[var(--text-muted)] underline text-sm block"
          >
            Changer de magasin
          </button>
        )}
      </div>
    </>
  );
}
