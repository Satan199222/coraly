"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { AccessibilityBar } from "@/components/accessibility-bar";
import { LiveRegion } from "@/components/live-region";
import { StoreSelector } from "@/components/store-selector";
import { GroceryInput } from "@/components/grocery-input";
import { ListClarification } from "@/components/list-clarification";
import { ProductResults } from "@/components/product-results";
import { CartHandoff } from "@/components/cart-handoff";
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
  /** Prochaines alternatives à proposer (FIFO) */
  alternatives: CarrefourProduct[];
  /** Tous les candidats initiaux pour pouvoir boucler */
  allCandidates: CarrefourProduct[];
  /** Index du produit actuel dans allCandidates (pour annoncer "1 sur 4") */
  currentIndex: number;
  /** Quantité demandée (default 1). Si 0, l'item est supprimé. */
  quantity: number;
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
          // Tenter d'extraire la quantité souhaitée depuis le texte original
          // (ex: "2 litres de lait" → quantity=2, "6 yaourts" → quantity=6)
          const initialQuantity = item.quantity && item.quantity > 0 ? item.quantity : 1;
          try {
            const searchRes = await fetch(
              `/api/search?q=${encodeURIComponent(item.query)}`
            );
            const searchData = await searchRes.json();
            const products: CarrefourProduct[] = searchData.products || [];
            const candidates = products.slice(0, 5);
            return {
              query: item.query,
              product: candidates[0] ?? null,
              alternatives: candidates.slice(1),
              allCandidates: candidates,
              currentIndex: 0,
              quantity: initialQuantity,
            };
          } catch {
            return {
              query: item.query,
              product: null,
              alternatives: [],
              allCandidates: [],
              currentIndex: 0,
              quantity: initialQuantity,
            };
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
        if (item.query !== query) return item;

        const total = item.allCandidates.length;
        if (total <= 1) {
          // Pas de vraie alternative disponible
          announce(`Pas d'autre choix disponible pour ${query}.`);
          return item;
        }

        // Avancer dans la liste des candidats, avec boucle
        const nextIndex = (item.currentIndex + 1) % total;
        const next = item.allCandidates[nextIndex];
        const looped = nextIndex === 0;

        const priceText = `${next.price?.toFixed(2) ?? "?"} euros`;
        announce(
          looped
            ? `Retour au premier choix. ${next.title}, ${priceText}.`
            : `Choix ${nextIndex + 1} sur ${total}. ${next.title}, ${priceText}.`
        );

        return {
          ...item,
          product: next,
          currentIndex: nextIndex,
          // Recalculer les alternatives restantes (pour l'UI si elle les affiche)
          alternatives: [
            ...item.allCandidates.slice(nextIndex + 1),
            ...item.allCandidates.slice(0, nextIndex),
          ],
        };
      })
    );
  }

  /**
   * Augmente la quantité d'un produit. Annonce le changement.
   */
  function handleIncrement(query: string) {
    setMatchedItems((prev) =>
      prev.map((item) => {
        if (item.query !== query) return item;
        const newQty = item.quantity + 1;
        if (item.product) {
          announce(
            `Quantité ${newQty} de ${item.product.title}.`
          );
        }
        return { ...item, quantity: newQty };
      })
    );
  }

  /**
   * Diminue la quantité d'un produit. À 0, l'item est supprimé de la liste.
   */
  function handleDecrement(query: string) {
    const item = matchedItems.find((i) => i.query === query);
    if (!item) return;

    if (item.quantity <= 1) {
      // Décrémenter depuis 1 → suppression
      const removedEan = item.product?.ean;
      setMatchedItems((prev) => prev.filter((i) => i.query !== query));
      if (removedEan) {
        setConfirmedEans((prev) => {
          const next = new Set(prev);
          next.delete(removedEan);
          return next;
        });
      }
      announce(
        item.product
          ? `${item.product.title} retiré de la liste.`
          : "Produit retiré de la liste."
      );
      return;
    }

    // Décrémenter de N vers N-1
    setMatchedItems((prev) =>
      prev.map((i) => {
        if (i.query !== query) return i;
        const newQty = i.quantity - 1;
        if (i.product) {
          announce(`Quantité ${newQty} de ${i.product.title}.`);
        }
        return { ...i, quantity: newQty };
      })
    );
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
      const candidates = products.slice(0, 5);
      setMatchedItems((prev) => [
        ...prev,
        {
          query: q,
          product: candidates[0] ?? null,
          alternatives: candidates.slice(1),
          allCandidates: candidates,
          currentIndex: 0,
          quantity: 1,
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

  // ── Préparer le panier pour le transfert vers la session utilisateur ──────
  // On n'appelle PLUS PATCH /api/cart côté serveur — c'est le bookmarklet
  // qui le fera dans la session de l'utilisateur. On construit juste un
  // objet Cart à partir des produits confirmés pour l'affichage.
  function handlePrepareCart() {
    if (!basketServiceId) {
      announce("Erreur : aucun magasin sélectionné.");
      return;
    }

    const confirmedItems = matchedItems.filter(
      (m) => m.product && confirmedEans.has(m.product.ean) && m.quantity > 0
    );

    const totalAmount = confirmedItems.reduce(
      (sum, m) => sum + (m.product!.price ?? 0) * m.quantity,
      0
    );

    const virtualCart: Cart = {
      totalAmount,
      totalFees: 0,
      items: confirmedItems.map((m) => ({
        ean: m.product!.ean,
        title: m.product!.title,
        brand: m.product!.brand,
        quantity: m.quantity,
        price: (m.product!.price ?? 0) * m.quantity,
        available: m.product!.purchasable,
      })),
    };

    setCart(virtualCart);
    setStep("cart");

    announce(
      `Liste prête. ${confirmedItems.length} produit(s) pour ${totalAmount.toFixed(2).replace(".", " euros ")}. Copiez le lien magique et collez-le sur carrefour.fr pour remplir votre panier.`
    );
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
              onIncrement={handleIncrement}
              onDecrement={handleDecrement}
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

            {/* Valider la liste — visible once all found products are confirmed.
                On N'appelle PLUS l'API cart côté serveur : c'est le bookmarklet
                qui le fera dans la session du user. Ici on prépare juste
                la liste pour l'affichage de l'écran final. */}
            {allConfirmed && (() => {
              const confirmedProducts = matchedItems
                .filter((m) => m.product && confirmedEans.has(m.product.ean))
                .map((m) => m.product!);
              const totalEstimated = confirmedProducts.reduce(
                (sum, p) => sum + (p.price ?? 0),
                0
              );
              const count = confirmedProducts.length;
              const totalText = totalEstimated
                .toFixed(2)
                .replace(".", " euros ");

              return (
                <button
                  id="add-to-cart-button"
                  onClick={handlePrepareCart}
                  aria-label={`Valider ma liste : ${count} produit${count > 1 ? "s" : ""}, total estimé ${totalText}`}
                  className="w-full px-6 py-4 rounded-lg bg-[var(--accent)] text-[var(--bg)] font-bold text-lg hover:bg-[var(--accent-hover)] transition-colors"
                >
                  {`Valider ma liste (${count} produit${count > 1 ? "s" : ""}, ${totalEstimated.toFixed(2)}€)`}
                </button>
              );
            })()}
          </>
        )}

        {/* Phase 4 — Remise du panier à l'utilisateur via bookmarklet */}
        {step === "cart" && storeRef && basketServiceId && (
          <CartHandoff
            cart={cart}
            slot={slot}
            storeRef={storeRef}
            basketServiceId={basketServiceId}
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
