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

function getPendingList() {
  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEY], (result) => {
      resolve(result[STORAGE_KEY] || null);
    });
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
 */
function showBanner(list) {
  if (document.getElementById(BANNER_ID)) return;

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

  // Partie gauche : titre + description de la liste
  const left = el("div", { style: "flex:1" });
  const label = el("strong", { text: "VoixCourses", style: "color:#4cc9f0" });
  left.appendChild(label);
  left.appendChild(document.createTextNode(" — Liste prête : "));
  left.appendChild(el("strong", { text: list.title }));

  // Partie droite : boutons
  const right = el("div", {
    style: "display:flex;gap:12px;align-items:center",
  });

  const itemCount = list.eans.length;
  const fillBtn = el("button", {
    id: "voixcourses-fill",
    text: `Remplir mon panier (${itemCount})`,
    attrs: {
      "aria-label": `Remplir mon panier Carrefour avec ${itemCount} produit${itemCount > 1 ? "s" : ""} de VoixCourses`,
      type: "button",
    },
    style:
      "padding:10px 20px;background:#4cc9f0;color:#0f0f1a;border:0;" +
      "border-radius:8px;font-weight:700;font-size:16px;cursor:pointer;",
  });

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

  right.appendChild(fillBtn);
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

  // Focus automatique sur le bouton principal
  setTimeout(() => fillBtn.focus(), 100);

  fillBtn.addEventListener("click", async () => {
    fillBtn.setAttribute("disabled", "true");
    fillBtn.textContent = "Ajout en cours...";
    status.textContent = "Ajout des produits à votre panier en cours...";

    const { failures, total } = await fillCart(list);

    if (failures.length === 0) {
      status.textContent = `Panier rempli. ${itemCount} produits pour ${total.toFixed(2)} euros. Redirection vers votre panier.`;
      chrome.storage.local.remove([STORAGE_KEY]);
      setTimeout(() => {
        window.location.href = "/mon-panier";
      }, 600);
    } else {
      status.textContent = `Ajout terminé avec ${failures.length} erreur. Total : ${total.toFixed(2)} euros.`;
      fillBtn.removeAttribute("disabled");
      fillBtn.textContent = `Panier partiellement rempli (${failures.length} erreur${failures.length > 1 ? "s" : ""})`;
    }
  });

  dismissBtn.addEventListener("click", () => {
    chrome.storage.local.remove([STORAGE_KEY]);
    banner.remove();
  });
}

// Au chargement : vérifier si une liste est en attente
(async () => {
  const list = await getPendingList();
  if (list) showBanner(list);
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
