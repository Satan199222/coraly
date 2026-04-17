"use client";

import { Suspense, useState, useCallback, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { AccessibilityBar } from "@/lib/shared/components/accessibility-bar";
import { LiveRegion } from "@/lib/shared/components/live-region";
import { SiteHeader } from "@/components/site-header";
import { StoreSelector } from "@/components/store-selector";
import { GroceryInput } from "@/components/grocery-input";
import { ListClarification } from "@/components/list-clarification";
import { ProductResults } from "@/components/product-results";
import { CartHandoff } from "@/components/cart-handoff";
import { HelpDialog } from "@/components/help-dialog";
import { InstallExtensionBanner } from "@/components/install-extension-banner";
import { Onboarding } from "@/components/onboarding";
import { Footer } from "@/components/footer";
import { useDocumentTitle } from "@/lib/useDocumentTitle";
import { useSpeech } from "@/lib/shared/speech/use-speech";
import { useFocusAnnounce } from "@/lib/shared/speech/use-focus-announce";
import { useLongTaskAnnounce } from "@/lib/shared/speech/use-long-task-announce";
import { useKeyboardShortcuts } from "@/lib/shared/speech/use-keyboard-shortcuts";
import {
  usePreferences,
  SPEECH_RATE_VALUE,
} from "@/lib/preferences/use-preferences";
import { useOrderHistory } from "@/lib/history/use-order-history";
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
  allCandidates: CarrefourProduct[];
  currentIndex: number;
  quantity: number;
  /** Indique si la recherche est terminée pour cet item. `false` = loading
   *  (placeholder initial), `true` = Carrefour a répondu (qu'il y ait un
   *  produit ou non). Évite d'afficher "Aucun résultat" pendant la recherche. */
  searched: boolean;
}

/** Convertit un prix en texte prononçable "1 euros 26 centimes". */
function priceToSpeech(price: number): string {
  const [int, decimal] = price.toFixed(2).split(".");
  if (decimal === "00") return `${int} euros`;
  return `${int} euros ${parseInt(decimal, 10)} centimes`;
}

/** Reconstitue une liste textuelle depuis les items confirmés, pour l'historique. */
function reconstructListText(items: MatchedItem[]): string {
  return items
    .filter((m) => m.product && m.quantity > 0)
    .map((m) => {
      const q = m.quantity > 1 ? `${m.quantity} ` : "";
      return `${q}${m.query}`;
    })
    .join(", ");
}

const STEP_LABELS: Record<Step, string> = {
  store: "Magasin",
  input: "Liste",
  clarification: "Préciser",
  results: "Produits",
  cart: "Panier",
};

/**
 * Barre de progression visuelle (complément de `stepTitle` lu par le SR).
 * Masqué des screen readers : l'étape est déjà annoncée sur le focus du h2.
 */
function StepProgress({ step }: { step: Step }) {
  // "clarification" et "results" partagent la même étape logique n°3
  const normalizedOrder: Step[] = ["store", "input", "clarification", "cart"];
  const normalized: Step = step === "results" ? "clarification" : step;
  const currentIndex = normalizedOrder.indexOf(normalized);

  return (
    <nav aria-hidden="true" className="flex items-center gap-2 text-sm">
      {normalizedOrder.map((s, i) => {
        const active = i === currentIndex;
        const done = i < currentIndex;
        return (
          <div key={s} className="flex items-center gap-2 flex-1">
            <div
              className={`flex-1 h-2 rounded-full transition-colors ${
                done
                  ? "bg-[var(--success)]"
                  : active
                    ? "bg-[var(--accent)]"
                    : "bg-[var(--border)]"
              }`}
            />
            <span
              className={`font-semibold whitespace-nowrap ${
                active
                  ? "text-[var(--accent)]"
                  : done
                    ? "text-[var(--success)]"
                    : "text-[var(--text-muted)]"
              }`}
            >
              {STEP_LABELS[s]}
            </span>
          </div>
        );
      })}
    </nav>
  );
}

export default function Page() {
  // useSearchParams nécessite un Suspense boundary en Next.js 16 pour
  // permettre le prérendu statique du squelette.
  return (
    <Suspense fallback={null}>
      <Home />
    </Suspense>
  );
}

function Home() {
  // ── State machine ──────────────────────────────────────────────────────────
  const [step, setStep] = useState<Step>("store");
  const [isLoading, setIsLoading] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [criticalAlert, setCriticalAlert] = useState("");

  // ── Store / slot ───────────────────────────────────────────────────────────
  const [storeRef, setStoreRef] = useState<string | null>(null);
  const [storeName, setStoreName] = useState<string | null>(null);
  const [basketServiceId, setBasketServiceId] = useState<string | null>(null);
  const [slot, setSlot] = useState<DeliverySlot | null>(null);

  // ── Parsed items (clarification phase) ────────────────────────────────────
  const [parsedItems, setParsedItems] = useState<ParsedGroceryItem[]>([]);

  // ── Results phase ──────────────────────────────────────────────────────────
  const [matchedItems, setMatchedItems] = useState<MatchedItem[]>([]);
  const [confirmedEans, setConfirmedEans] = useState<Set<string>>(new Set());
  const [isSearching, setIsSearching] = useState(false);
  // Map ean → ref du bouton "Confirmer" de chaque carte produit. Permet de
  // déplacer automatiquement le focus vers le prochain item non-confirmé
  // après un clic Confirmer, au lieu de rester sur un bouton désactivé.
  const confirmRefs = useRef(new Map<string, HTMLButtonElement | null>());
  const validateBtnRef = useRef<HTMLButtonElement>(null);

  // ── Add-a-product input (bottom of results) ────────────────────────────────
  const [addQuery, setAddQuery] = useState("");
  const [isAddingProduct, setIsAddingProduct] = useState(false);

  // ── Cart phase ─────────────────────────────────────────────────────────────
  const [cart, setCart] = useState<Cart | null>(null);

  // ── Accessibility / speech ─────────────────────────────────────────────────
  // Si l'utilisateur arrive depuis la landing avec ?voice=on (mode 2 vocal),
  // on force la voix active immédiatement (et on persiste).
  const searchParams = useSearchParams();
  const voiceForced = searchParams.get("voice") === "on";
  const [voiceEnabled, setVoiceEnabled] = useState(voiceForced);
  const [helpOpen, setHelpOpen] = useState(false);
  const { prefs, rememberChoice } = usePreferences();
  const history = useOrderHistory();

  useEffect(() => {
    if (voiceForced && typeof window !== "undefined") {
      localStorage.setItem("coraly-voice-enabled", "true");
    }
  }, [voiceForced]);

  const {
    transcript,
    isListening,
    isSpeaking,
    startListening,
    stopListening,
    speak,
    cancelSpeech,
    isSupported,
  } = useSpeech({
    rate: SPEECH_RATE_VALUE[prefs.speechRate],
    lang: prefs.speechLocale,
    premiumVoice: prefs.premiumVoice,
  });

  useFocusAnnounce(voiceEnabled, {
    rate: SPEECH_RATE_VALUE[prefs.speechRate] * 1.1, // focus un peu plus rapide
    lang: prefs.speechLocale,
  });

  // Raccourcis clavier globaux : ? pour aide, Échap pour stopper voix /
  // fermer dialog, M pour toggle micro (actif seulement en étape saisie).
  useKeyboardShortcuts({
    onHelp: () => setHelpOpen(true),
    onEscape: () => {
      if (helpOpen) {
        setHelpOpen(false);
        return;
      }
      cancelSpeech();
      if (isListening) stopListening();
    },
    onToggleMic:
      step === "input" && isSupported
        ? () => {
            if (isListening) {
              stopListening();
            } else {
              startListening();
            }
          }
        : undefined,
  });

  // ── Focus management ───────────────────────────────────────────────────────
  const stepHeadingRef = useRef<HTMLHeadingElement>(null);

  const focusStepHeading = useCallback(() => {
    setTimeout(() => {
      stepHeadingRef.current?.focus();
    }, 50);
  }, []);

  const announce = useCallback(
    (msg: string) => {
      setAnnouncement(msg);
      if (voiceEnabled) {
        speak(msg);
      }
    },
    [speak, voiceEnabled]
  );

  // Annonce "toujours en cours..." à 5s puis "prend plus de temps que prévu"
  // à 15s, pendant analyse et recherche. Évite qu'un utilisateur non-voyant
  // pense que l'app est plantée.
  useLongTaskAnnounce(isLoading || isSearching, { announce });

  const alertCritical = useCallback(
    (msg: string) => {
      setCriticalAlert(msg);
      if (voiceEnabled) {
        speak(msg);
      }
    },
    [speak, voiceEnabled]
  );

  // ── On mount: check localStorage ───────────────────────────────────────────
  useEffect(() => {
    const savedRef = localStorage.getItem("storeRef");
    const savedBsid = localStorage.getItem("basketServiceId");
    const savedName = localStorage.getItem("storeName");
    if (savedRef && savedBsid) {
      setStoreRef(savedRef);
      setBasketServiceId(savedBsid);
      if (savedName) setStoreName(savedName);
      setStep("input");
      fetch(`/api/slots?storeRef=${savedRef}`)
        .then((r) => r.json())
        .then((d) => setSlot(d.slot ?? null))
        .catch(() => null);
    }
  }, []);

  useEffect(() => {
    focusStepHeading();
  }, [step, focusStepHeading]);

  // Annonce contextuelle à l'arrivée dans l'étape "saisie" : si une commande
  // précédente existe, informer l'utilisateur qu'il peut la reprendre.
  // Sans ça, le bouton "Reprendre" ne serait jamais découvert sans Tab.
  const announcedReuseRef = useRef<string | null>(null);
  useEffect(() => {
    if (step !== "input" || !history.lastEntry) return;
    if (announcedReuseRef.current === history.lastEntry.at) return;
    announcedReuseRef.current = history.lastEntry.at;
    // Délai pour laisser l'annonce d'étape ("Étape 2 sur 4...") passer avant.
    const t = setTimeout(() => {
      announce(
        `Astuce : votre dernière commande de ${history.lastEntry!.count} produits est disponible. Appuyez sur Tab pour la reprendre.`
      );
    }, 1200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, history.lastEntry?.at]);

  const stepTitle = {
    store: "Étape 1 sur 4 : Choisissez votre magasin",
    input: "Étape 2 sur 4 : Votre liste de courses",
    clarification: "Étape 3 sur 4 : Précisez votre liste",
    results: "Étape 3 sur 4 : Choisissez vos produits",
    cart: "Étape 4 sur 4 : Votre panier",
  }[step];

  // Document.title refléte l'étape — utile quand l'utilisateur a plusieurs
  // onglets ouverts et cherche à retrouver Coraly dans sa barre d'onglets.
  const shortStep = {
    store: "Magasin",
    input: "Liste",
    clarification: "Précisez",
    results: "Produits",
    cart: "Panier",
  }[step];
  useDocumentTitle(`Coraly — ${shortStep}`);

  // ── Store selected ─────────────────────────────────────────────────────────
  async function handleStoreSelected(store: CarrefourStore, bsid: string) {
    setStoreRef(store.ref);
    setBasketServiceId(bsid);
    setStoreName(store.name);
    localStorage.setItem("storeRef", store.ref);
    localStorage.setItem("basketServiceId", bsid);
    localStorage.setItem("storeName", store.name);

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
      const parseRes = await fetch("/api/parse-list", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          text,
          context: {
            diet: prefs.diet,
            allergens: prefs.allergens,
            defaults: prefs.defaults,
          },
        }),
      });

      if (!parseRes.ok) {
        const err = await parseRes.json().catch(() => ({}));
        throw new Error(err.error || "Erreur inconnue");
      }

      const { items }: { items: ParsedGroceryItem[] } = await parseRes.json();
      const needsClarification = items.some((i) => i.status !== "clear");

      if (needsClarification) {
        setParsedItems(items);
        setIsLoading(false);
        const toReview = items.filter((i) => i.status !== "clear").length;
        announce(`${toReview} produit${toReview > 1 ? "s" : ""} à préciser avant de lancer la recherche.`);
        setStep("clarification");
      } else {
        await runSearch(items);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur inconnue";
      alertCritical(
        `Analyse impossible : ${msg}. Veuillez réessayer ou simplifier votre liste.`
      );
      setIsLoading(false);
    }
  }

  async function handleClarificationValidate() {
    setIsLoading(true);
    announce("Recherche des produits en cours...");
    await runSearch(parsedItems);
  }

  // ── Run search — avec progression annoncée au fur et à mesure ──────────────
  async function runSearch(items: ParsedGroceryItem[]) {
    setIsSearching(true);
    setStep("results");
    setMatchedItems([]);
    setConfirmedEans(new Set());

    // Préparer les emplacements vides pour que l'UI montre immédiatement le
    // skeleton et que les annonces "trouvé X sur N" aient du sens.
    const placeholders: MatchedItem[] = items.map((item) => ({
      query: item.query,
      product: null,
      alternatives: [],
      allCandidates: [],
      currentIndex: 0,
      quantity: item.quantity && item.quantity > 0 ? item.quantity : 1,
      searched: false,
    }));
    setMatchedItems(placeholders);
    setIsLoading(false);

    const dietParam = prefs.diet.length > 0 ? prefs.diet.join(",") : "";
    let found = 0;
    // Stocker localement le 1er produit trouvé — on ne peut pas lire le state
    // React après les setMatchedItems (closure stale). Holder mutable pour
    // que TS ne narrow pas le type à `null` (mutations en callback async).
    const firstHolder: { value: CarrefourProduct | null } = { value: null };

    // Parallélisation totale + annonce progressive. Promise.allSettled évite
    // qu'une seule recherche en erreur n'arrête l'ensemble.
    await Promise.allSettled(
      items.map(async (item, index) => {
        const params = new URLSearchParams({ q: item.query });
        if (dietParam) params.set("diet", dietParam);
        if (item.brand) params.set("brand", item.brand);
        if (item.quantity && item.quantity > 1) {
          params.set("qty", String(item.quantity));
        }
        if (item.unit) params.set("unit", item.unit);

        try {
          const searchRes = await fetch(`/api/search?${params}`);
          const searchData = await searchRes.json();
          const products: CarrefourProduct[] = searchData.products || [];
          const candidates = products.slice(0, 5);
          const hadResult = candidates[0] != null;

          setMatchedItems((prev) => {
            const next = [...prev];
            next[index] = {
              ...next[index],
              product: candidates[0] ?? null,
              alternatives: candidates.slice(1),
              allCandidates: candidates,
              currentIndex: 0,
              searched: true,
            };
            return next;
          });

          if (hadResult) {
            found++;
            if (!firstHolder.value && candidates[0]) firstHolder.value = candidates[0];
            announce(`${found} produit${found > 1 ? "s" : ""} trouvé${found > 1 ? "s" : ""} sur ${items.length}.`);
          }
        } catch {
          // Erreur réseau / API : on marque searched=true pour basculer
          // l'UI en "aucun résultat" (au lieu de rester en "loading").
          setMatchedItems((prev) => {
            const next = [...prev];
            if (next[index]) {
              next[index] = { ...next[index], searched: true };
            }
            return next;
          });
        }
      })
    );

    setIsSearching(false);

    // Annonce finale enrichie : nombre trouvé + 1er produit en détail + conseil
    // "Tout confirmer". Pour un utilisateur non-voyant, entendre le 1er produit
    // directement évite un Tab à l'aveugle pour découvrir ce qui l'attend.
    const first = firstHolder.value;
    const firstDetail = first
      ? ` Premier produit : ${first.title}, ${priceToSpeech(first.price ?? 0)}.`
      : "";
    const hint =
      found > 1
        ? ` Utilisez le bouton Tout confirmer pour tout valider d'un coup, ou examinez chaque produit individuellement.`
        : found === 1
          ? ` Examinez et confirmez.`
          : "";
    announce(
      `Recherche terminée. ${found} produit${found > 1 ? "s" : ""} trouvé${found > 1 ? "s" : ""} sur ${items.length}.${firstDetail}${hint}`
    );
  }

  // ── Confirm / reject product ───────────────────────────────────────────────
  function handleConfirm(ean: string) {
    const match = matchedItems.find((m) => m.product?.ean === ean);
    const product = match?.product;
    const nextConfirmed = new Set([...confirmedEans, ean]);
    setConfirmedEans(nextConfirmed);

    if (product && match?.query) {
      rememberChoice(match.query, match.query);
    }

    // Chercher le prochain item non-confirmé (après celui qu'on vient de
    // valider). Gros gain UX : au lieu de rester sur un bouton disabled et
    // de tabber à travers les +/- quantité, on saute direct au prochain choix.
    const remaining = matchedItems.filter(
      (m) => m.product && !nextConfirmed.has(m.product.ean)
    );
    const allDone = remaining.length === 0;

    if (product) {
      if (allDone) {
        announce(
          `${product.title} confirmé. Tous les produits sont validés. Vous pouvez maintenant valider votre liste.`
        );
      } else {
        const next = remaining[0].product!;
        announce(
          `${product.title} confirmé. Prochain : ${next.title}, ${priceToSpeech(next.price ?? 0)}.`
        );
      }
    }

    // Déplacer le focus après le render : vers le prochain Confirmer, ou
    // vers le bouton Valider si on a terminé.
    setTimeout(() => {
      if (allDone) {
        validateBtnRef.current?.focus();
      } else {
        const nextEan = remaining[0].product?.ean;
        if (nextEan) {
          confirmRefs.current.get(nextEan)?.focus();
        }
      }
    }, 60);
  }

  // ── Tout confirmer d'un coup — gros gain pour l'habitué dont les
  //    résultats sont souvent bons du premier coup. Un seul Tab+Enter plutôt
  //    que N. On ne confirme que les items qui ont bien un produit trouvé.
  function handleConfirmAll() {
    const toConfirm = matchedItems
      .filter((m) => m.product && !confirmedEans.has(m.product.ean))
      .map((m) => m.product!.ean);

    if (toConfirm.length === 0) return;

    setConfirmedEans((prev) => new Set([...prev, ...toConfirm]));
    for (const m of matchedItems) {
      if (m.product && m.query && toConfirm.includes(m.product.ean)) {
        rememberChoice(m.query, m.query);
      }
    }

    announce(
      `${toConfirm.length} produit${toConfirm.length > 1 ? "s" : ""} confirmé${toConfirm.length > 1 ? "s" : ""} d'un coup. Vous pouvez maintenant valider votre liste.`
    );

    setTimeout(() => validateBtnRef.current?.focus(), 60);
  }

  function handleReject(query: string) {
    setMatchedItems((prev) =>
      prev.map((item) => {
        if (item.query !== query) return item;

        const total = item.allCandidates.length;
        if (total <= 1) {
          announce(`Pas d'autre choix disponible pour ${query}.`);
          return item;
        }

        const nextIndex = (item.currentIndex + 1) % total;
        const next = item.allCandidates[nextIndex];
        const looped = nextIndex === 0;

        const priceText = priceToSpeech(next.price ?? 0);
        announce(
          looped
            ? `Retour au premier choix. ${next.title}, ${priceText}.`
            : `Choix ${nextIndex + 1} sur ${total}. ${next.title}, ${priceText}.`
        );

        return {
          ...item,
          product: next,
          currentIndex: nextIndex,
          alternatives: [
            ...item.allCandidates.slice(nextIndex + 1),
            ...item.allCandidates.slice(0, nextIndex),
          ],
        };
      })
    );
  }

  function handleIncrement(query: string) {
    setMatchedItems((prev) =>
      prev.map((item) => {
        if (item.query !== query) return item;
        const newQty = item.quantity + 1;
        if (item.product) {
          announce(`Quantité ${newQty} de ${item.product.title}.`);
        }
        return { ...item, quantity: newQty };
      })
    );
  }

  function handleDecrement(query: string) {
    const item = matchedItems.find((i) => i.query === query);
    if (!item) return;

    if (item.quantity <= 1) {
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
      const dietParam = prefs.diet.length > 0 ? prefs.diet.join(",") : "";
      const params = new URLSearchParams({ q });
      if (dietParam) params.set("diet", dietParam);

      const res = await fetch(`/api/search?${params}`);
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
          searched: true,
        },
      ]);
      setAddQuery("");
      if (products[0]) {
        announce(`${products[0].title} ajouté à la liste.`);
      } else {
        announce(`Aucun produit trouvé pour ${q}.`);
      }
    } catch {
      alertCritical("Erreur lors de la recherche. Veuillez réessayer.");
    } finally {
      setIsAddingProduct(false);
    }
  }

  function handlePrepareCart() {
    if (!basketServiceId) {
      alertCritical("Erreur : aucun magasin sélectionné.");
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

    // Persister pour "Reprendre ma dernière commande"
    history.add({
      at: new Date().toISOString(),
      listText: reconstructListText(confirmedItems),
      count: confirmedItems.length,
      total: totalAmount,
      storeName: storeName ?? undefined,
    });

    announce(
      `Liste prête. ${confirmedItems.length} produit${confirmedItems.length > 1 ? "s" : ""} pour ${priceToSpeech(totalAmount)}. Transférez-la maintenant vers votre panier Carrefour.`
    );
  }

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
    !isSearching &&
    matchedItems
      .filter((m) => m.product)
      .every((m) => confirmedEans.has(m.product!.ean));

  const confirmedProducts = matchedItems
    .filter((m) => m.product && confirmedEans.has(m.product.ean) && m.quantity > 0);
  const totalEstimated = confirmedProducts.reduce(
    (sum, m) => sum + (m.product!.price ?? 0) * m.quantity,
    0
  );
  const articleCount = confirmedProducts.reduce((n, m) => n + m.quantity, 0);

  const slotText = slot
    ? new Date(slot.begDate).toLocaleDateString("fr-FR", {
        weekday: "long",
        day: "numeric",
        month: "long",
      }) +
      " de " +
      new Date(slot.begDate).toLocaleTimeString("fr-FR", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      <AccessibilityBar
        service="courses"
        onVoiceToggle={setVoiceEnabled}
        onHelpRequest={() => setHelpOpen(true)}
      />

      <HelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} />

      {/* Annonces normales (polite) */}
      <LiveRegion message={announcement} />
      {/* Alertes critiques (assertive, interrompent le lecteur d'écran) */}
      <LiveRegion message={criticalAlert} urgency="assertive" />

      <SiteHeader compact />

      <main
        id="main"
        tabIndex={-1}
        className="max-w-2xl mx-auto px-4 py-8 space-y-8"
        inert={helpOpen}
      >
        <h1 className="sr-only">Vos courses — Coraly</h1>

        {/* Indicateur d'étape visuel — complément aux annonces ARIA pour les
            utilisateurs voyants qui veulent situer leur progression. */}
        <StepProgress step={step} />

        {/* Onboarding première visite — carte 3 étapes skippable. */}
        {step === "store" && <Onboarding />}

        {/* Magasin actuellement sélectionné — affiché pendant tout le flow
            pour que l'utilisateur sache toujours où il commande. */}
        {storeName && step !== "store" && (
          <div
            className="flex items-center justify-between gap-2 text-sm p-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border)]"
            aria-label={`Magasin sélectionné : ${storeName}`}
          >
            <span className="text-[var(--text-muted)]">
              📍 Magasin : <strong className="text-[var(--text)]">{storeName}</strong>
            </span>
            <button
              type="button"
              onClick={() => {
                if (step === "cart") return; // pas pertinent en fin de flow
                announce("Changement de magasin.");
                setStep("store");
              }}
              disabled={step === "cart"}
              className="text-[var(--accent)] underline text-xs disabled:opacity-50 disabled:no-underline"
              aria-label="Changer de magasin"
            >
              Changer
            </button>
          </div>
        )}

        {/* Suggestion d'installation de l'extension — affichée uniquement
            si non installée et navigateur supporté. Se masque au dismiss. */}
        {step !== "cart" && <InstallExtensionBanner />}


        <h2
          ref={stepHeadingRef}
          tabIndex={-1}
          className="sr-only focus:not-sr-only focus:text-xl focus:font-bold focus:ring-3 focus:ring-[var(--focus-ring)]"
          aria-live="polite"
        >
          {stepTitle}
        </h2>

        {step === "store" && (
          <div key="step-store" className="step-fade">
            <StoreSelector onStoreSelected={handleStoreSelected} />
          </div>
        )}

        {step === "input" && (
          <div key="step-input" className="step-fade">
            <GroceryInput
            onSubmit={handleSubmit}
            isLoading={isLoading}
            isListening={isListening}
            onMicClick={isListening ? stopListening : startListening}
            transcript={transcript}
            isMicSupported={isSupported}
            lastOrder={history.hydrated ? history.lastEntry : null}
            onSpeak={speak}
            onCancelSpeech={cancelSpeech}
            isSpeaking={isSpeaking}
          />
          </div>
        )}

        {step === "clarification" && (
          <div key="step-clarif" className="step-fade">
            <ListClarification
            items={parsedItems}
            onUpdate={(index, update) => {
              setParsedItems((prev) =>
                prev.map((item, i) => (i === index ? { ...item, ...update } : item))
              );
              // Annoncer le choix : l'utilisateur doit savoir que son clic
              // a bien été pris en compte, pas attendre un Tab suivant.
              if (update.status === "clear" && update.query) {
                const src = parsedItems[index]?.originalText ?? "";
                announce(`${src} : ${update.query}. Validé.`);
              }
            }}
            onRemove={(index) => {
              const src = parsedItems[index]?.originalText ?? "";
              setParsedItems((prev) => prev.filter((_, i) => i !== index));
              announce(`${src} retiré de la liste.`);
            }}
            onValidate={handleClarificationValidate}
            onEditList={() => {
              announce("Retour à la saisie. Votre texte est conservé.");
              setStep("input");
            }}
          />
          </div>
        )}

        {step === "results" && (
          <div key="step-results" className="step-fade space-y-6">
            {allConfirmed && (
              <a
                href="#add-to-cart-button"
                className="sr-only focus:not-sr-only focus:inline-block focus:px-4 focus:py-2 focus:bg-[var(--accent)] focus:text-[var(--bg)] focus:rounded focus:font-semibold"
              >
                Aller directement au bouton Valider la liste
              </a>
            )}

            {/* Bouton "Tout confirmer" — gros accélérateur pour l'utilisateur
                dont les 5 à 10 résultats semblent tous corrects. Placé AVANT
                la liste : 1 seul Tab depuis le heading d'étape pour l'atteindre. */}
            {!isSearching && matchedItems.some(
              (m) => m.product && !confirmedEans.has(m.product.ean)
            ) && (
              <div className="flex gap-3 flex-wrap items-center">
                <button
                  type="button"
                  onClick={handleConfirmAll}
                  aria-label={`Tout confirmer : ${matchedItems.filter((m) => m.product && !confirmedEans.has(m.product.ean)).length} produits en un clic`}
                  className="flex-1 min-w-[12rem] px-5 py-3 rounded-lg bg-[var(--success)] text-[var(--bg)] font-bold text-base hover:brightness-110 transition-all"
                >
                  ✓ Tout confirmer (
                  {matchedItems.filter(
                    (m) => m.product && !confirmedEans.has(m.product.ean)
                  ).length}
                  )
                </button>
                <button
                  type="button"
                  onClick={() => {
                    announce("Retour à la saisie. Votre texte est conservé.");
                    setStep("input");
                  }}
                  aria-label="Modifier ma liste — retour à la saisie"
                  className="px-4 py-3 rounded-lg border-2 border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--text)] transition-colors"
                >
                  Modifier ma liste
                </button>
              </div>
            )}

            <div
              aria-busy={isSearching}
              aria-live="polite"
              className={isSearching ? "opacity-90" : ""}
            >
              <ProductResults
                items={matchedItems}
                onConfirm={handleConfirm}
                onReject={handleReject}
                onIncrement={handleIncrement}
                onDecrement={handleDecrement}
                confirmedEans={confirmedEans}
                confirmRefs={confirmRefs}
              />
            </div>

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

            {/* Récapitulatif pré-validation — CRITIQUE pour utilisateur non-voyant.
                Avant "Valider", il doit entendre exactement ce qu'il s'apprête à commander.
                role=status + aria-live=polite : annonce quand ça change. */}
            {allConfirmed && (
              <section
                aria-label="Récapitulatif avant validation"
                role="status"
                aria-live="polite"
                className="p-4 rounded-lg bg-[var(--bg-surface)] border-2 border-[var(--accent)]"
              >
                <h3 className="font-bold mb-2">Récapitulatif</h3>
                <p
                  aria-label={`${confirmedProducts.length} produit${confirmedProducts.length > 1 ? "s" : ""} différent${confirmedProducts.length > 1 ? "s" : ""}, ${articleCount} article${articleCount > 1 ? "s" : ""} au total, pour un montant estimé de ${priceToSpeech(totalEstimated)}${slotText ? `, livraison prévue ${slotText}` : ""}.`}
                >
                  {confirmedProducts.length} produit
                  {confirmedProducts.length > 1 ? "s" : ""} ({articleCount} article
                  {articleCount > 1 ? "s" : ""}) —{" "}
                  <strong className="text-[var(--accent)]">
                    {totalEstimated.toFixed(2)}€
                  </strong>
                  {slotText && (
                    <>
                      <br />
                      <span className="text-sm text-[var(--text-muted)]">
                        Livraison : {slotText}
                      </span>
                    </>
                  )}
                </p>
              </section>
            )}

            {allConfirmed && (
              <button
                ref={validateBtnRef}
                id="add-to-cart-button"
                onClick={handlePrepareCart}
                aria-label={`Valider ma liste : ${confirmedProducts.length} produit${confirmedProducts.length > 1 ? "s" : ""}, ${articleCount} article${articleCount > 1 ? "s" : ""}, total estimé ${priceToSpeech(totalEstimated)}`}
                className="w-full px-6 py-4 rounded-lg bg-[var(--accent)] text-[var(--bg)] font-bold text-lg hover:bg-[var(--accent-hover)] transition-colors"
              >
                {`Valider ma liste (${confirmedProducts.length} produit${confirmedProducts.length > 1 ? "s" : ""}, ${totalEstimated.toFixed(2)}€)`}
              </button>
            )}
          </div>
        )}

        {step === "cart" && storeRef && basketServiceId && (
          <div key="step-cart" className="step-fade">
            <CartHandoff
              cart={cart}
              slot={slot}
              storeRef={storeRef}
              basketServiceId={basketServiceId}
            />
          </div>
        )}

        {step !== "store" && step !== "input" && (
          <button
            onClick={handleNewList}
            className="text-[var(--text-muted)] underline text-sm"
          >
            Nouvelle liste
          </button>
        )}

      </main>
      <Footer />
    </>
  );
}
