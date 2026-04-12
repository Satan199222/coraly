/**
 * Script injecté sur toutes les pages carrefour.fr.
 *
 * Rôle : si une liste VoixCourses est en attente dans le storage de
 * l'extension, afficher une bannière accessible avec un bouton "Remplir
 * mon panier". Au clic, appelle les API Carrefour avec les cookies
 * de l'utilisateur (session native) et redirige vers /mon-panier.
 */

const STORAGE_KEY = "voixcourses-pending-list";
const BANNER_ID = "voixcourses-banner";

/**
 * Synthèse vocale accessible dans le contexte carrefour.fr.
 * Toujours active dans l'extension — l'utilisateur a volontairement installé
 * l'extension pour l'assistance vocale, pas besoin d'opt-in supplémentaire.
 *
 * Prononciation française : prix en "X euros YY centimes", unités étendues.
 */
// Utilise l'API partagée chargée par voice-core.js (déclaré avant dans le manifest)
const { tts } = window.__voixcoursesTTS;

// Les helpers de focus, greeting, toggle sont dans voice-core.js

function getPendingList() {
  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEY], (result) => {
      resolve(result[STORAGE_KEY] || null);
    });
  });
}

/**
 * Lire le panier actuel de l'utilisateur (dans sa session).
 */
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

/**
 * Vérifier si l'utilisateur est connecté à Carrefour.
 * Retourne { loggedIn: boolean, firstName?: string }.
 */
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

/**
 * Supprimer un produit du panier (counter: 0).
 */
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

/**
 * Remplir le panier Carrefour avec les EAN fournis.
 * S'exécute dans la session utilisateur (mêmes cookies que la page).
 */
async function fillCart(list) {
  // 1. Sélectionner le magasin VoixCourses
  await fetch(`/set-store/${list.storeRef}`, {
    headers: {
      "x-requested-with": "XMLHttpRequest",
      accept: "application/json",
    },
    credentials: "same-origin",
  });

  const failures = [];
  let lastTotal = 0;

  // 2. Ajouter chaque produit
  for (const ean of list.eans) {
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
              counter: 1,
              ean,
              subBasketType: "drive_clcv",
            },
          ],
        }),
      });

      if (!res.ok) {
        failures.push(ean);
        continue;
      }

      const data = await res.json();
      lastTotal = data?.cart?.totalAmount ?? lastTotal;
    } catch {
      failures.push(ean);
    }
  }

  return { failures, total: lastTotal };
}

/**
 * Utilitaire pour créer un élément avec attributs et styles.
 * Approche safe-DOM (pas d'innerHTML).
 */
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

/**
 * Afficher la bannière VoixCourses en haut de la page carrefour.fr.
 * Conçue pour être accessible clavier + screen reader.
 *
 * Contenu dynamique :
 * - Affiche l'état de connexion (si non connecté, suggère de se connecter)
 * - Affiche le nombre d'articles déjà dans le panier
 * - Propose "Ajouter à mon panier" (garde les existants) ou "Remplacer"
 */
async function showBanner(list) {
  if (document.getElementById(BANNER_ID)) return;

  // Récupérer l'état actuel en parallèle
  const [currentCart, auth] = await Promise.all([
    readCurrentCart(),
    checkAuth(),
  ]);

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
      "display:flex;align-items:center;justify-content:space-between;gap:16px;" +
      "box-shadow:0 2px 12px rgba(0,0,0,0.3);",
  });

  // Partie gauche : titre + description de la liste + état actuel
  const left = el("div", { style: "flex:1;min-width:0" });

  const topLine = el("div", { style: "margin-bottom:4px" });
  topLine.appendChild(
    el("strong", { text: "VoixCourses", style: "color:#4cc9f0" })
  );
  topLine.appendChild(
    document.createTextNode(` — Liste prête : ${list.title}`)
  );
  left.appendChild(topLine);

  // Ligne statut : connexion + panier actuel
  const statusLine = el("div", {
    style: "font-size:13px;color:#a0a8b8",
  });

  // Connexion
  if (auth.loggedIn) {
    const loggedSpan = el("span", {
      text: `✓ Connecté${auth.firstName ? ` (${auth.firstName})` : ""}`,
      style: "color:#2ee8a5;font-weight:600",
    });
    statusLine.appendChild(loggedSpan);
  } else {
    const notLoggedSpan = el("span", {
      text: "⚠ Non connecté",
      style: "color:#ffd166;font-weight:600",
    });
    statusLine.appendChild(notLoggedSpan);
    statusLine.appendChild(document.createTextNode(" — "));
    const loginLink = el("a", {
      text: "Se connecter pour payer",
      href: "/mon-compte/login",
      style: "color:#4cc9f0;text-decoration:underline",
    });
    statusLine.appendChild(loginLink);
  }

  statusLine.appendChild(document.createTextNode(" · "));

  // Panier actuel
  if (currentCart.itemCount > 0) {
    const cartSpan = el("span", {
      text: `Panier actuel : ${currentCart.itemCount} article${currentCart.itemCount > 1 ? "s" : ""} (${currentCart.total.toFixed(2)}€)`,
      style: "color:#ffd166",
    });
    statusLine.appendChild(cartSpan);
  } else {
    statusLine.appendChild(
      document.createTextNode("Panier actuel vide")
    );
  }

  left.appendChild(statusLine);

  // Partie droite : boutons
  const right = el("div", {
    style: "display:flex;gap:12px;align-items:center;flex-wrap:wrap",
  });

  const itemCount = list.eans.length;

  // Bouton principal : ajoute à l'existant
  const fillBtn = el("button", {
    id: "voixcourses-fill",
    text: currentCart.itemCount > 0
      ? `Ajouter (${itemCount})`
      : `Remplir mon panier (${itemCount})`,
    attrs: {
      "aria-label":
        currentCart.itemCount > 0
          ? `Ajouter ${itemCount} produit${itemCount > 1 ? "s" : ""} VoixCourses à votre panier existant de ${currentCart.itemCount} article${currentCart.itemCount > 1 ? "s" : ""}`
          : `Remplir mon panier Carrefour avec ${itemCount} produit${itemCount > 1 ? "s" : ""} de VoixCourses`,
      type: "button",
      "data-action": "add",
    },
    style:
      "padding:10px 20px;background:#4cc9f0;color:#0f0f1a;border:0;" +
      "border-radius:8px;font-weight:700;font-size:16px;cursor:pointer;",
  });
  right.appendChild(fillBtn);

  // Bouton "Remplacer" visible seulement si le panier n'est pas vide
  if (currentCart.itemCount > 0) {
    const replaceBtn = el("button", {
      id: "voixcourses-replace",
      text: "Remplacer",
      attrs: {
        "aria-label": `Vider mon panier actuel (${currentCart.itemCount} article${currentCart.itemCount > 1 ? "s" : ""}) et le remplacer par la liste VoixCourses (${itemCount} produit${itemCount > 1 ? "s" : ""})`,
        type: "button",
        "data-action": "replace",
      },
      style:
        "padding:10px 16px;background:transparent;color:#ffd166;" +
        "border:1px solid #ffd166;border-radius:8px;font-size:14px;cursor:pointer;",
    });
    right.appendChild(replaceBtn);
  }

  const dismissBtn = el("button", {
    id: "voixcourses-dismiss",
    text: "Ignorer",
    attrs: {
      "aria-label": "Ignorer cette liste VoixCourses",
      type: "button",
    },
    style:
      "padding:10px 16px;background:transparent;color:#f0f0f5;" +
      "border:1px solid #2b3a55;border-radius:8px;font-size:14px;cursor:pointer;",
  });
  right.appendChild(dismissBtn);

  // Zone aria-live (visible screen reader only)
  const status = el("div", {
    id: "voixcourses-status",
    attrs: { role: "status", "aria-live": "polite" },
    style:
      "position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden;",
  });

  banner.appendChild(left);
  banner.appendChild(right);
  banner.appendChild(status);

  document.documentElement.appendChild(banner);

  // ── Annonce vocale de bienvenue : recap complet ──────────────────────
  const authText = auth.loggedIn
    ? `Connecté${auth.firstName ? " en tant que " + auth.firstName : ""}`
    : "Attention, vous n'êtes pas connecté à Carrefour. Vous devrez vous connecter avant le paiement";
  const cartStatus = currentCart.itemCount > 0
    ? `Votre panier contient déjà ${currentCart.itemCount} article${currentCart.itemCount > 1 ? "s" : ""} pour ${currentCart.total.toFixed(2)} euros`
    : "Votre panier est vide";
  const actions = currentCart.itemCount > 0
    ? "Trois boutons disponibles : Ajouter pour garder vos articles existants, Remplacer pour les remplacer, Ignorer pour annuler"
    : "Deux boutons disponibles : Remplir mon panier ou Ignorer";

  const recap = `VoixCourses. Liste prête : ${list.title}. ${authText}. ${cartStatus}. ${actions}.`;
  tts.speak(recap);

  // ── Annonce vocale au focus des boutons ─────────────────────────────
  function addFocusSpeaker(btn) {
    btn.addEventListener("focus", () => {
      const label = btn.getAttribute("aria-label") || btn.textContent || "";
      tts.speak(label);
    });
  }
  addFocusSpeaker(fillBtn);
  addFocusSpeaker(dismissBtn);
  const replaceBtnEl = document.getElementById("voixcourses-replace");
  if (replaceBtnEl) addFocusSpeaker(replaceBtnEl);

  // Focus automatique sur le bouton principal (avec délai pour laisser le TTS démarrer)
  setTimeout(() => fillBtn.focus(), 100);

  /**
   * Ajouter la liste au panier — optionnellement après avoir vidé l'existant.
   */
  async function applyList(mode /* "add" | "replace" */) {
    fillBtn.setAttribute("disabled", "true");
    const replaceBtn = document.getElementById("voixcourses-replace");
    if (replaceBtn) replaceBtn.setAttribute("disabled", "true");

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

    const { failures, total } = await fillCart(list);

    if (failures.length === 0) {
      const successMsg = `Panier rempli. ${itemCount} produit${itemCount > 1 ? "s" : ""} pour ${total.toFixed(2)} euros. Redirection vers votre panier.`;
      status.textContent = successMsg;
      tts.speak(successMsg);
      chrome.storage.local.remove([STORAGE_KEY]);
      // Flag pour que la page panier annonce vocalement le résultat final
      chrome.storage.local.set({ [POST_FILL_KEY]: { at: Date.now() } });
      setTimeout(() => {
        window.location.href = "/cart/driveclcv";
      }, 1800);
    } else {
      const errorMsg = `Ajout terminé avec ${failures.length} erreur${failures.length > 1 ? "s" : ""}. Total : ${total.toFixed(2)} euros.`;
      status.textContent = errorMsg;
      tts.speak(errorMsg);
      fillBtn.removeAttribute("disabled");
      fillBtn.textContent = `Panier partiellement rempli (${failures.length} erreur${failures.length > 1 ? "s" : ""})`;
    }
  }

  fillBtn.addEventListener("click", () => applyList("add"));

  const replaceBtn = document.getElementById("voixcourses-replace");
  if (replaceBtn) {
    replaceBtn.addEventListener("click", () => {
      const confirmMsg = `Voulez-vous vider votre panier actuel (${currentCart.itemCount} article${currentCart.itemCount > 1 ? "s" : ""}) et le remplacer par la liste VoixCourses (${itemCount} produit${itemCount > 1 ? "s" : ""}) ?`;
      if (window.confirm(confirmMsg)) {
        applyList("replace");
      }
    });
  }

  dismissBtn.addEventListener("click", () => {
    chrome.storage.local.remove([STORAGE_KEY]);
    banner.remove();
  });
}

/**
 * Annoncer l'arrivée sur la page panier Carrefour après un remplissage.
 * L'extension garde en mémoire qu'on vient de faire un fillCart, et
 * annonce vocalement le résumé quand la page /cart/ charge.
 */
const POST_FILL_KEY = "voixcourses-just-filled";

async function announceCartPage() {
  const isCartPage =
    location.pathname.includes("/cart") ||
    location.pathname.includes("/mon-panier");
  if (!isCartPage) return;

  // Vérifier si on vient juste de remplir (flag mis avant redirect)
  const data = await new Promise((resolve) => {
    chrome.storage.local.get([POST_FILL_KEY], (r) => resolve(r[POST_FILL_KEY]));
  });
  if (!data) return;

  // Nettoyer le flag
  chrome.storage.local.remove([POST_FILL_KEY]);

  // Lire le panier et annoncer
  const cart = await readCurrentCart();
  const auth = await checkAuth();
  const authLine = auth.loggedIn
    ? `Vous êtes connecté${auth.firstName ? " en tant que " + auth.firstName : ""}.`
    : "Vous n'êtes pas connecté. Cliquez sur Se connecter pour finaliser votre commande.";
  const announcement = `Panier Carrefour ouvert. ${cart.itemCount} article${cart.itemCount > 1 ? "s" : ""} pour ${cart.total.toFixed(2)} euros. ${authLine}`;
  tts.speak(announcement);
}

// Au chargement de chaque page carrefour.fr :
// 1. Installer la voix globale au focus (via voice-core.js)
// 2. Message de bienvenue (1 fois par fenêtre de 30 min)
// 3. Raccourci V pour réactiver la voix si désactivée
// 4. Si liste en attente → bannière ; sinon si page panier → annonce
(async () => {
  const api = window.__voixcoursesTTS;
  api.installFocusSpeaker();
  api.installVoiceToggleShortcut();
  await api.greetIfNeeded("Carrefour");

  const list = await getPendingList();
  if (list) {
    showBanner(list);
  } else {
    announceCartPage();
  }
})();

// Réagir si la liste change (autre onglet, nouvel envoi)
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes[STORAGE_KEY]) {
    const newList = changes[STORAGE_KEY].newValue;
    const existing = document.getElementById(BANNER_ID);
    if (existing) existing.remove();
    if (newList) showBanner(newList);
  }
});
