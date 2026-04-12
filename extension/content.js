/**
 * Script injecté sur toutes les pages carrefour.fr.
 *
 * Comportement :
 * - Si une liste VoixCourses est en attente : bannière + voix ON d'emblée
 * - Sinon : voix OFF par défaut pour ne pas polluer la navigation Carrefour
 *   ordinaire d'un utilisateur qui consulte simplement le site.
 */

const STORAGE_KEY = "voixcourses-pending-list";
/** TTL : au-delà, la liste est considérée périmée (abandonnée) */
const LIST_TTL_MS = 24 * 60 * 60 * 1000;
const BANNER_ID = "voixcourses-banner";
const POST_FILL_KEY = "voixcourses-just-filled";

const {
  tts,
  isExtensionAlive,
  safeStorageGet,
  safeStorageSet,
  safeStorageRemove,
} = window.__voixcoursesTTS;

async function getPendingList() {
  const result = await safeStorageGet([STORAGE_KEY]);
  const list = result[STORAGE_KEY];
  if (!list) return null;
  // TTL : au-delà, on considère la liste abandonnée. Nettoyage automatique
  // pour éviter qu'une liste de la semaine dernière réapparaisse.
  if (list.createdAt && Date.now() - list.createdAt > LIST_TTL_MS) {
    safeStorageRemove([STORAGE_KEY]);
    return null;
  }
  return list;
}

async function readCurrentCart() {
  try {
    const res = await fetch("/api/cart", {
      headers: {
        "x-requested-with": "XMLHttpRequest",
        accept: "application/json",
      },
      credentials: "same-origin",
    });
    if (!res.ok) return { itemCount: 0, total: 0, eans: [] };
    const data = await res.json();
    const cart = data?.cart || {};
    const eans = [];
    for (const category of cart.items || []) {
      for (const p of category.products || []) {
        const ean = p.product?.attributes?.ean;
        if (ean) eans.push(ean);
      }
    }
    return {
      itemCount: eans.length,
      total: cart.totalAmount ?? 0,
      eans,
    };
  } catch {
    return { itemCount: 0, total: 0, eans: [] };
  }
}

async function checkAuth() {
  try {
    const res = await fetch("/api/me", {
      headers: {
        "x-requested-with": "XMLHttpRequest",
        accept: "application/json",
      },
      credentials: "same-origin",
    });
    if (!res.ok) return { loggedIn: false };
    const data = await res.json();
    const attrs = data?.data?.attributes;
    if (attrs?.firstName || attrs?.email) {
      return {
        loggedIn: true,
        firstName: attrs.firstName || null,
        email: attrs.email || null,
      };
    }
    return { loggedIn: false };
  } catch {
    return { loggedIn: false };
  }
}

async function removeFromCart(basketServiceId, ean) {
  return fetch("/api/cart", {
    method: "PATCH",
    headers: {
      "x-requested-with": "XMLHttpRequest",
      "content-type": "application/json",
      accept: "application/json",
    },
    credentials: "same-origin",
    body: JSON.stringify({
      trackingRequest: {
        pageType: "productdetail",
        pageId: "productdetail",
      },
      items: [
        {
          basketServiceId,
          counter: 0,
          ean,
          subBasketType: "drive_clcv",
        },
      ],
    }),
  });
}

function getItems(list) {
  if (Array.isArray(list.items)) return list.items;
  if (Array.isArray(list.eans))
    return list.eans.map((ean) => ({ ean, quantity: 1 }));
  return [];
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * PATCH un item avec retry + backoff sur 429/erreurs réseau.
 * Les erreurs 4xx non-429 (ex: 404 produit disparu) ne sont pas retry.
 */
async function patchCartOnce(list, item, quantity, attempt = 0) {
  try {
    const res = await fetch("/api/cart", {
      method: "PATCH",
      headers: {
        "x-requested-with": "XMLHttpRequest",
        "content-type": "application/json",
        accept: "application/json",
      },
      credentials: "same-origin",
      body: JSON.stringify({
        trackingRequest: {
          pageType: "productdetail",
          pageId: "productdetail",
        },
        items: [
          {
            basketServiceId: list.basketServiceId,
            counter: quantity,
            ean: item.ean,
            subBasketType: "drive_clcv",
          },
        ],
      }),
    });

    if (res.ok) {
      const data = await res.json();
      return { ok: true, data };
    }

    // 429 (rate limit) ou 5xx : retry max 2 fois
    if ((res.status === 429 || res.status >= 500) && attempt < 2) {
      const delay = 500 * Math.pow(2, attempt); // 500ms, 1s
      await sleep(delay);
      return patchCartOnce(list, item, quantity, attempt + 1);
    }

    return { ok: false, status: res.status };
  } catch (err) {
    // Erreur réseau : retry aussi
    if (attempt < 2) {
      await sleep(500 * Math.pow(2, attempt));
      return patchCartOnce(list, item, quantity, attempt + 1);
    }
    return { ok: false, error: String(err) };
  }
}

/**
 * Remplit le panier Carrefour. Throttle de 200ms entre chaque item pour
 * rester sous le rate-limit Carrefour, et rapport de progression au caller.
 *
 * Retourne failures[] avec title + ean pour que l'appelant puisse annoncer
 * précisément "Lait Lactel non ajouté" plutôt qu'un EAN opaque.
 */
async function fillCart(list, onProgress) {
  await fetch(`/set-store/${list.storeRef}`, {
    headers: {
      "x-requested-with": "XMLHttpRequest",
      accept: "application/json",
    },
    credentials: "same-origin",
  });

  const failures = [];
  let lastTotal = 0;
  const items = getItems(list);
  const totalCount = items.length;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const quantity = item.quantity && item.quantity > 0 ? item.quantity : 1;

    const result = await patchCartOnce(list, item, quantity);
    if (result.ok) {
      lastTotal = result.data?.cart?.totalAmount ?? lastTotal;
      if (typeof onProgress === "function") {
        onProgress({ done: i + 1, total: totalCount, ok: true, item });
      }
    } else {
      failures.push({ ean: item.ean, title: item.title || null });
      if (typeof onProgress === "function") {
        onProgress({ done: i + 1, total: totalCount, ok: false, item });
      }
    }

    // Throttle : espace les requêtes pour ne pas saturer l'API Carrefour.
    // 200ms × 20 items = 4s, acceptable. Sans ça, risque de 429.
    if (i < items.length - 1) await sleep(200);
  }

  return { failures, total: lastTotal };
}

/**
 * Après le remplissage, détecter les substitutions : un EAN demandé qui ne
 * se retrouve pas dans le panier Carrefour (même si PATCH OK) signifie que
 * Carrefour a substitué ou n'a pas pu ajouter. Important pour l'utilisateur
 * non-voyant qui doit savoir que sa marque habituelle a été remplacée.
 */
async function detectSubstitutions(list, initialEans) {
  try {
    const cart = await readCurrentCart();
    const requestedEans = new Set(getItems(list).map((i) => i.ean));
    const inCartNow = new Set(cart.eans);
    const alreadyThere = new Set(initialEans);

    // Items demandés mais absents du panier final = substitués/échec
    const missing = [];
    for (const item of getItems(list)) {
      if (!inCartNow.has(item.ean)) {
        missing.push(item);
      }
    }

    // Produits présents mais non demandés ET pas là avant → potentielle substitution
    const addedUnexpected = [];
    for (const ean of inCartNow) {
      if (!requestedEans.has(ean) && !alreadyThere.has(ean)) {
        addedUnexpected.push(ean);
      }
    }

    return { missing, addedUnexpected };
  } catch {
    return { missing: [], addedUnexpected: [] };
  }
}

function el(tag, options = {}) {
  const e = document.createElement(tag);
  if (options.id) e.id = options.id;
  if (options.text) e.textContent = options.text;
  if (options.style) e.setAttribute("style", options.style);
  if (options.attrs) {
    for (const [k, v] of Object.entries(options.attrs)) {
      e.setAttribute(k, v);
    }
  }
  return e;
}

async function showBanner(list) {
  if (document.getElementById(BANNER_ID)) return;

  const [currentCart, auth] = await Promise.all([
    readCurrentCart(),
    checkAuth(),
  ]);
  // Conserver l'état initial pour détection des substitutions après fillCart
  const initialEans = [...currentCart.eans];

  const banner = el("div", {
    id: BANNER_ID,
    attrs: {
      role: "region",
      "aria-label": "VoixCourses — liste en attente",
    },
    style:
      "position:fixed;top:0;left:0;right:0;z-index:2147483647;" +
      "background:#0f0f1a;color:#f0f0f5;border-bottom:3px solid #4cc9f0;" +
      "padding:16px 24px;font-family:system-ui,sans-serif;font-size:16px;" +
      "display:flex;flex-direction:column;gap:12px;" +
      "box-shadow:0 2px 12px rgba(0,0,0,0.3);",
  });

  // Ligne 1 : titre + statut connexion/panier
  const headerLine = el("div", {
    style: "display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;",
  });
  const left = el("div", { style: "flex:1;min-width:0" });

  const topLine = el("div", { style: "margin-bottom:4px" });
  topLine.appendChild(
    el("strong", { text: "VoixCourses", style: "color:#4cc9f0" })
  );
  topLine.appendChild(
    document.createTextNode(` — Liste prête : ${list.title}`)
  );
  left.appendChild(topLine);

  const statusLine = el("div", {
    style: "font-size:13px;color:#a0a8b8",
  });

  if (auth.loggedIn) {
    statusLine.appendChild(
      el("span", {
        text: `✓ Connecté${auth.firstName ? ` (${auth.firstName})` : ""}`,
        style: "color:#2ee8a5;font-weight:600",
      })
    );
  } else {
    statusLine.appendChild(
      el("span", {
        text: "⚠ Non connecté",
        style: "color:#ffd166;font-weight:600",
      })
    );
    statusLine.appendChild(document.createTextNode(" — "));
    const loginLink = el("a", {
      text: "Se connecter pour payer",
      style: "color:#4cc9f0;text-decoration:underline",
    });
    loginLink.href = "/mon-compte/login";
    statusLine.appendChild(loginLink);
  }

  statusLine.appendChild(document.createTextNode(" · "));

  if (currentCart.itemCount > 0) {
    statusLine.appendChild(
      el("span", {
        text: `Panier actuel : ${currentCart.itemCount} article${currentCart.itemCount > 1 ? "s" : ""} (${currentCart.total.toFixed(2)}€)`,
        style: "color:#ffd166",
      })
    );
  } else {
    statusLine.appendChild(document.createTextNode("Panier actuel vide"));
  }
  left.appendChild(statusLine);

  // Partie droite : boutons
  const right = el("div", {
    style: "display:flex;gap:12px;align-items:center;flex-wrap:wrap",
  });

  const listItems = getItems(list);
  const itemCount = listItems.length;

  const fillBtn = el("button", {
    id: "voixcourses-fill",
    text:
      currentCart.itemCount > 0
        ? `Ajouter (${itemCount})`
        : `Remplir mon panier (${itemCount})`,
    attrs: {
      "aria-label":
        currentCart.itemCount > 0
          ? `Ajouter ${itemCount} produit${itemCount > 1 ? "s" : ""} VoixCourses à votre panier existant de ${currentCart.itemCount} article${currentCart.itemCount > 1 ? "s" : ""}. Raccourci : touche R.`
          : `Remplir mon panier Carrefour avec ${itemCount} produit${itemCount > 1 ? "s" : ""} de VoixCourses. Raccourci : touche R.`,
      type: "button",
      "data-action": "add",
      accesskey: "r",
    },
    style:
      "padding:10px 20px;background:#4cc9f0;color:#0f0f1a;border:0;" +
      "border-radius:8px;font-weight:700;font-size:16px;cursor:pointer;",
  });
  right.appendChild(fillBtn);

  let replaceBtn = null;
  if (currentCart.itemCount > 0) {
    replaceBtn = el("button", {
      id: "voixcourses-replace",
      text: "Remplacer",
      attrs: {
        "aria-label": `Vider mon panier actuel et le remplacer par la liste VoixCourses.`,
        type: "button",
        "data-action": "replace",
      },
      style:
        "padding:10px 16px;background:transparent;color:#ffd166;" +
        "border:1px solid #ffd166;border-radius:8px;font-size:14px;cursor:pointer;",
    });
    right.appendChild(replaceBtn);
  }

  // Lien "Modifier ma liste" — retour vers voixcourses.fr.
  // Utile si l'utilisateur réalise qu'il a oublié un produit avant de valider.
  let editBtn = null;
  if (list.returnUrl) {
    editBtn = el("button", {
      id: "voixcourses-edit",
      text: "Modifier ma liste",
      attrs: {
        "aria-label":
          "Retourner sur VoixCourses pour modifier la liste. Raccourci : touche E.",
        type: "button",
        accesskey: "e",
      },
      style:
        "padding:10px 16px;background:transparent;color:#4cc9f0;" +
        "border:1px solid #4cc9f0;border-radius:8px;font-size:14px;cursor:pointer;",
    });
    right.appendChild(editBtn);
  }

  const dismissBtn = el("button", {
    id: "voixcourses-dismiss",
    text: "Ignorer",
    attrs: {
      "aria-label":
        "Ignorer cette liste VoixCourses. Raccourci : touche I.",
      type: "button",
      accesskey: "i",
    },
    style:
      "padding:10px 16px;background:transparent;color:#f0f0f5;" +
      "border:1px solid #2b3a55;border-radius:8px;font-size:14px;cursor:pointer;",
  });
  right.appendChild(dismissBtn);

  headerLine.appendChild(left);
  headerLine.appendChild(right);
  banner.appendChild(headerLine);

  // Ligne 2 : détail de la liste (collapsible) — informations que l'utilisateur
  // non-voyant peut vouloir réentendre avant de valider.
  const hasTitles = listItems.some((i) => i.title);
  if (hasTitles) {
    const details = el("details", {
      style: "margin-top:4px;",
    });
    const summary = el("summary", {
      text: `Voir le détail des ${itemCount} produits`,
      style:
        "cursor:pointer;color:#a0a8b8;font-size:13px;padding:4px 0;",
      attrs: {
        "aria-label": `Afficher la liste détaillée des ${itemCount} produits à transférer`,
      },
    });
    details.appendChild(summary);

    const ul = el("ul", {
      style:
        "margin:8px 0 0 0;padding:0 0 0 20px;font-size:13px;max-height:180px;overflow-y:auto;",
    });
    for (const item of listItems) {
      const li = el("li", { style: "margin-bottom:4px;" });
      const qty = item.quantity && item.quantity > 1 ? `${item.quantity} × ` : "";
      const price =
        typeof item.price === "number"
          ? ` — ${item.price.toFixed(2)}€`
          : "";
      li.textContent = `${qty}${item.title || item.ean}${price}`;
      ul.appendChild(li);
    }
    details.appendChild(ul);
    banner.appendChild(details);
  }

  // Ligne 3 : progress bar (cachée par défaut, apparaît pendant fillCart)
  const progressWrap = el("div", {
    id: "voixcourses-progress-wrap",
    style:
      "display:none;height:6px;background:#1a1a2e;border-radius:3px;overflow:hidden;",
    attrs: { "aria-hidden": "true" },
  });
  const progressBar = el("div", {
    id: "voixcourses-progress-bar",
    style:
      "height:100%;width:0%;background:#4cc9f0;transition:width 0.15s ease;",
  });
  progressWrap.appendChild(progressBar);
  banner.appendChild(progressWrap);

  // Zone aria-live (invisible)
  const status = el("div", {
    id: "voixcourses-status",
    attrs: { role: "status", "aria-live": "polite" },
    style:
      "position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden;",
  });
  banner.appendChild(status);

  document.documentElement.appendChild(banner);
  applyBodyOffset(banner);

  // Annonce vocale — toujours prononcée quand une liste est en attente,
  // même si on vient de visiter la page il y a 20 min. C'est un moment d'action.
  const authText = auth.loggedIn
    ? `Connecté${auth.firstName ? " en tant que " + auth.firstName : ""}`
    : "Attention, vous n'êtes pas connecté à Carrefour. Vous devrez vous connecter avant le paiement";
  const cartStatus =
    currentCart.itemCount > 0
      ? `Votre panier contient déjà ${currentCart.itemCount} article${currentCart.itemCount > 1 ? "s" : ""} pour ${currentCart.total.toFixed(2)} euros`
      : "Votre panier est vide";
  const actions = [];
  actions.push(`R pour remplir avec ${itemCount} produits`);
  if (replaceBtn) actions.push("Remplacer pour vider puis remplir");
  if (editBtn) actions.push("E pour modifier la liste");
  actions.push("I pour ignorer");

  const recap = `VoixCourses. Liste prête : ${list.title}. ${authText}. ${cartStatus}. Raccourcis : ${actions.join(", ")}.`;
  tts.speak(recap);

  function addFocusSpeaker(btn) {
    if (!btn) return;
    btn.addEventListener("focus", () => {
      const label = btn.getAttribute("aria-label") || btn.textContent || "";
      tts.speak(label);
    });
  }
  addFocusSpeaker(fillBtn);
  addFocusSpeaker(dismissBtn);
  addFocusSpeaker(replaceBtn);
  addFocusSpeaker(editBtn);

  setTimeout(() => fillBtn.focus(), 100);

  async function applyList(mode) {
    fillBtn.setAttribute("disabled", "true");
    if (replaceBtn) replaceBtn.setAttribute("disabled", "true");
    if (editBtn) editBtn.setAttribute("disabled", "true");

    if (mode === "replace" && currentCart.eans.length > 0) {
      const msg = `Suppression des ${currentCart.itemCount} articles existants`;
      status.textContent = msg;
      fillBtn.textContent = "Vidage du panier...";
      tts.speak(msg);
      for (const existingEan of currentCart.eans) {
        await removeFromCart(list.basketServiceId, existingEan);
      }
    }

    const progressMsg = `Ajout de ${itemCount} produit${itemCount > 1 ? "s" : ""} à votre panier Carrefour`;
    status.textContent = progressMsg;
    fillBtn.textContent = "Ajout en cours...";
    tts.speak(progressMsg);
    progressWrap.style.display = "block";

    const { failures, total } = await fillCart(list, ({ done, total: t, ok, item }) => {
      const pct = Math.round((done / t) * 100);
      progressBar.style.width = `${pct}%`;
      fillBtn.textContent = `Ajout ${done} sur ${t}...`;
      status.textContent = `Ajout ${done} sur ${t}`;

      // Annonce vocale : à chaque étape si un item a échoué (on veut savoir
      // lequel précisément), sinon tous les 2 pour rester audible.
      if (!ok) {
        const label = item.title ? item.title : `un produit`;
        tts.speak(`${label} non ajouté.`);
      } else {
        const shouldSpeak = done === t || done % 2 === 0;
        if (shouldSpeak && done < t) tts.speak(`${done} sur ${t}`);
      }
    });

    // Détection substitutions après coup
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- addedUnexpected conservé pour usages futurs (logs debug)
    const { missing, addedUnexpected } = await detectSubstitutions(
      list,
      mode === "replace" ? [] : initialEans
    );
    const substituted = missing.filter(
      (m) =>
        !failures.some((f) => f.ean === m.ean) && m.title
    );

    if (failures.length === 0 && substituted.length === 0) {
      const successMsg = `Panier rempli. ${itemCount} produit${itemCount > 1 ? "s" : ""} pour ${total.toFixed(2)} euros. Redirection vers votre panier.`;
      status.textContent = successMsg;
      tts.speak(successMsg);
      safeStorageRemove([STORAGE_KEY]);
      safeStorageSet({ [POST_FILL_KEY]: { at: Date.now() } });
      setTimeout(() => {
        window.location.href = "/cart/driveclcv";
      }, 1800);
    } else {
      const parts = [];
      if (failures.length > 0) {
        const names = failures
          .map((f) => f.title)
          .filter(Boolean)
          .slice(0, 3);
        const extra = failures.length > 3 ? ` et ${failures.length - 3} autres` : "";
        parts.push(
          names.length > 0
            ? `${failures.length} échec${failures.length > 1 ? "s" : ""} : ${names.join(", ")}${extra}`
            : `${failures.length} échec${failures.length > 1 ? "s" : ""}`
        );
      }
      if (substituted.length > 0) {
        const names = substituted
          .map((s) => s.title)
          .filter(Boolean)
          .slice(0, 3);
        parts.push(
          `${substituted.length} possiblement substitué${substituted.length > 1 ? "s" : ""} par Carrefour : ${names.join(", ")}`
        );
      }
      const summary = `Ajout terminé. Total : ${total.toFixed(2)} euros. ${parts.join(". ")}.`;
      status.textContent = summary;
      tts.speak(summary);
      fillBtn.removeAttribute("disabled");
      fillBtn.textContent = `Panier partiellement rempli`;
    }
  }

  fillBtn.addEventListener("click", () => applyList("add"));
  if (replaceBtn) {
    replaceBtn.addEventListener("click", () => {
      // Dialog custom accessible plutôt que window.confirm — ce dernier
      // est non-stylé (moche) et a un comportement erratique avec certains
      // screen readers (focus perdu après OK/Cancel).
      showReplaceConfirmDialog({
        currentCount: currentCart.itemCount,
        newCount: itemCount,
        onConfirm: () => applyList("replace"),
      });
    });
  }
  if (editBtn) {
    editBtn.addEventListener("click", () => {
      window.open(list.returnUrl, "_blank", "noopener,noreferrer");
    });
  }

  dismissBtn.addEventListener("click", () => {
    safeStorageRemove([STORAGE_KEY]);
    clearBodyOffset();
    banner.remove();
  });

  // Raccourcis globaux R / I / E tant que la bannière est à l'écran.
  // Hors input/textarea — pour ne pas casser une saisie Carrefour en cours.
  const keyHandler = (e) => {
    const active = document.activeElement;
    const isTyping =
      active &&
      (active.tagName === "INPUT" ||
        active.tagName === "TEXTAREA" ||
        active.isContentEditable);
    if (isTyping) return;
    if (e.ctrlKey || e.altKey || e.metaKey) return;

    if (e.key === "r" || e.key === "R") {
      e.preventDefault();
      fillBtn.click();
    } else if (e.key === "i" || e.key === "I") {
      e.preventDefault();
      dismissBtn.click();
    } else if ((e.key === "e" || e.key === "E") && editBtn) {
      e.preventDefault();
      editBtn.click();
    }
  };
  document.addEventListener("keydown", keyHandler, true);
  // Nettoyer si la bannière est retirée
  const observer = new MutationObserver(() => {
    if (!document.getElementById(BANNER_ID)) {
      document.removeEventListener("keydown", keyHandler, true);
      observer.disconnect();
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
}

/**
 * Dialog custom de confirmation pour le remplacement du panier.
 * Accessible au clavier (focus trap, Escape pour annuler, Enter pour confirmer),
 * role="dialog" aria-modal, annoncé par TTS à l'ouverture.
 */
function showReplaceConfirmDialog({ currentCount, newCount, onConfirm }) {
  const DIALOG_ID = "voixcourses-confirm-dialog";
  if (document.getElementById(DIALOG_ID)) return;

  const backdrop = el("div", {
    id: DIALOG_ID,
    attrs: {
      role: "dialog",
      "aria-modal": "true",
      "aria-labelledby": "voixcourses-confirm-title",
      "aria-describedby": "voixcourses-confirm-msg",
    },
    style:
      "position:fixed;inset:0;z-index:2147483647;" +
      "display:flex;align-items:center;justify-content:center;" +
      "background:rgba(0,0,0,0.75);padding:16px;font-family:system-ui,sans-serif;",
  });

  const box = el("div", {
    style:
      "max-width:440px;width:100%;background:#1a1a2e;color:#f0f0f5;" +
      "border:2px solid #4cc9f0;border-radius:12px;padding:24px;" +
      "box-shadow:0 20px 60px rgba(0,0,0,0.6);",
  });

  const title = el("h2", {
    id: "voixcourses-confirm-title",
    text: "Remplacer le panier ?",
    style: "margin:0 0 12px 0;font-size:20px;color:#f0f0f5;",
  });

  const msg = el("p", {
    id: "voixcourses-confirm-msg",
    text: `Votre panier actuel (${currentCount} article${currentCount > 1 ? "s" : ""}) sera vidé et remplacé par la liste VoixCourses (${newCount} produit${newCount > 1 ? "s" : ""}). Cette action est irréversible.`,
    style: "margin:0 0 20px 0;color:#a0a8b8;line-height:1.5;",
  });

  const actions = el("div", {
    style: "display:flex;gap:12px;justify-content:flex-end;flex-wrap:wrap;",
  });

  const cancelBtn = el("button", {
    text: "Annuler",
    attrs: { type: "button", "aria-label": "Annuler et garder mon panier actuel" },
    style:
      "padding:10px 20px;background:transparent;color:#f0f0f5;" +
      "border:2px solid #2b3a55;border-radius:8px;font-weight:600;cursor:pointer;",
  });

  const confirmBtn = el("button", {
    text: "Vider et remplacer",
    attrs: {
      type: "button",
      "aria-label":
        "Confirmer : vider le panier actuel et le remplacer par la liste VoixCourses",
    },
    style:
      "padding:10px 20px;background:#ff6b8a;color:#0f0f1a;" +
      "border:0;border-radius:8px;font-weight:700;cursor:pointer;",
  });

  actions.appendChild(cancelBtn);
  actions.appendChild(confirmBtn);
  box.appendChild(title);
  box.appendChild(msg);
  box.appendChild(actions);
  backdrop.appendChild(box);
  document.documentElement.appendChild(backdrop);

  tts.speak(
    `Confirmer le remplacement du panier ? ${currentCount} articles seront supprimés.`
  );

  // Focus sur Annuler par défaut (option sûre)
  setTimeout(() => cancelBtn.focus(), 50);

  function close() {
    backdrop.remove();
    document.removeEventListener("keydown", keyHandler, true);
  }
  function confirm() {
    close();
    onConfirm();
  }

  const keyHandler = (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "Tab") {
      // Focus trap entre les 2 boutons
      const focusables = [cancelBtn, confirmBtn];
      const active = document.activeElement;
      const idx = focusables.indexOf(active);
      if (e.shiftKey && idx <= 0) {
        e.preventDefault();
        focusables[focusables.length - 1].focus();
      } else if (!e.shiftKey && idx === focusables.length - 1) {
        e.preventDefault();
        focusables[0].focus();
      }
    }
  };

  cancelBtn.addEventListener("click", close);
  confirmBtn.addEventListener("click", confirm);
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) close();
  });
  document.addEventListener("keydown", keyHandler, true);
}

// ── Padding du body : éviter que la bannière masque le contenu Carrefour ──
let savedBodyPaddingTop = null;
let bannerResizeObserver = null;

function applyBodyOffset(banner) {
  if (savedBodyPaddingTop === null) {
    savedBodyPaddingTop = document.body.style.paddingTop || "";
  }
  const apply = () => {
    const h = banner.getBoundingClientRect().height;
    if (h > 0) document.body.style.paddingTop = `${Math.ceil(h)}px`;
  };
  apply();
  if (typeof ResizeObserver !== "undefined") {
    bannerResizeObserver = new ResizeObserver(apply);
    bannerResizeObserver.observe(banner);
  } else {
    window.addEventListener("resize", apply);
  }
}

function clearBodyOffset() {
  if (bannerResizeObserver) {
    bannerResizeObserver.disconnect();
    bannerResizeObserver = null;
  }
  if (savedBodyPaddingTop !== null) {
    document.body.style.paddingTop = savedBodyPaddingTop;
    savedBodyPaddingTop = null;
  } else {
    document.body.style.paddingTop = "";
  }
}

async function announceCartPage() {
  const isCartPage =
    location.pathname.includes("/cart") ||
    location.pathname.includes("/mon-panier");
  if (!isCartPage) return;

  const result = await safeStorageGet([POST_FILL_KEY]);
  const data = result[POST_FILL_KEY];
  if (!data) return;

  safeStorageRemove([POST_FILL_KEY]);

  const cart = await readCurrentCart();
  const auth = await checkAuth();
  const authLine = auth.loggedIn
    ? `Vous êtes connecté${auth.firstName ? " en tant que " + auth.firstName : ""}.`
    : "Vous n'êtes pas connecté. Cliquez sur Se connecter pour finaliser votre commande.";
  const announcement = `Panier Carrefour ouvert. ${cart.itemCount} article${cart.itemCount > 1 ? "s" : ""} pour ${cart.total.toFixed(2)} euros. ${authLine}`;
  tts.speak(announcement);
}

// ── Bootstrap ─────────────────────────────────────────────────────────────
// 1. Vérifier si liste VoixCourses en attente AVANT d'initialiser la voix
// 2. Si liste : voix ON + bannière + greeting bypass
// 3. Sinon : voix OFF par défaut (respect de l'utilisateur qui consulte Carrefour
//    pour ses propres raisons, pas via VoixCourses)
(async () => {
  // Si le contexte d'extension est mort (rechargé en dev pendant qu'un onglet
  // était ouvert), on ne tente rien — les API chrome.* throw sinon.
  if (!isExtensionAlive()) return;

  const api = window.__voixcoursesTTS;
  const list = await getPendingList();
  const hasPendingList = !!list;

  if (hasPendingList) {
    api.installFocusSpeaker();
    api.installVoiceToggleShortcut();
    await api.greetIfNeeded("Carrefour", {
      forceVoiceOn: true,
      bypassWindow: true,
    });
    showBanner(list);
  } else {
    const prefResult = await safeStorageGet(["voixcourses-voice-enabled"]);
    const pref = prefResult["voixcourses-voice-enabled"];
    api.tts.enabled = pref === true; // OFF par défaut hors flux VoixCourses
    if (api.tts.enabled) {
      api.installFocusSpeaker();
      api.installVoiceToggleShortcut();
    } else {
      api.installVoiceToggleShortcut();
    }
    announceCartPage();
  }
})();

// Listener storage — protégé par try/catch : si l'extension est rechargée
// pendant que le listener est en vie, chrome.storage.onChanged throw au lieu
// de fire. Le try autour du addListener évite de casser le script entier.
try {
  if (isExtensionAlive() && chrome.storage?.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
      try {
        if (area === "local" && changes[STORAGE_KEY]) {
          const newList = changes[STORAGE_KEY].newValue;
          const existing = document.getElementById(BANNER_ID);
          if (existing) {
            clearBodyOffset();
            existing.remove();
          }
          if (newList) showBanner(newList);
        }
      } catch {
        /* context invalidated — silencieux */
      }
    });
  }
} catch {
  /* addListener peut throw si le context est déjà mort */
}
