/**
 * Popup de l'extension (clic sur l'icône VoixCourses).
 *
 * Utile quand :
 * - Aucune liste : propose d'ouvrir voixcourses.fr (raccourci pour l'utilisateur)
 * - Liste présente : affiche le détail complet + ouvre Carrefour ou supprime
 */

const WEB_APP_URL = "https://voixcourses.fr";

function el(tag, options = {}) {
  const e = document.createElement(tag);
  if (options.className) e.className = options.className;
  if (options.text) e.textContent = options.text;
  if (options.href) e.href = options.href;
  if (options.attrs) {
    for (const [k, v] of Object.entries(options.attrs)) {
      e.setAttribute(k, v);
    }
  }
  return e;
}

function clearChildren(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

function getItems(list) {
  if (Array.isArray(list.items)) return list.items;
  if (Array.isArray(list.eans))
    return list.eans.map((ean) => ({ ean, quantity: 1 }));
  return [];
}

function render(list) {
  const content = document.getElementById("content");
  if (!content) return;
  clearChildren(content);

  if (!list) {
    // État vide — on aide l'utilisateur à accéder à l'app web.
    const p1 = el("p", { text: "Aucune liste en attente." });
    const p2 = el("p", { className: "muted" });
    p2.textContent =
      "Créez votre liste sur VoixCourses, puis envoyez-la vers l'extension.";

    const openAppBtn = el("button", {
      text: "Ouvrir VoixCourses",
      attrs: {
        type: "button",
        "aria-label": "Ouvrir le site VoixCourses dans un nouvel onglet",
      },
    });
    openAppBtn.addEventListener("click", () => {
      chrome.tabs.create({ url: `${WEB_APP_URL}/` });
      window.close();
    });

    content.appendChild(p1);
    content.appendChild(p2);
    content.appendChild(openAppBtn);
    return;
  }

  const items = getItems(list);
  const total = items.reduce(
    (sum, i) =>
      typeof i.price === "number" ? sum + i.price * (i.quantity || 1) : sum,
    0
  );

  const p = el("p", { text: `Liste prête : ${list.title}` });

  const metaText =
    total > 0
      ? `${items.length} produit${items.length > 1 ? "s" : ""} · Total estimé ${total.toFixed(2)}€`
      : `${items.length} produit${items.length > 1 ? "s" : ""}`;
  const meta = el("div", { className: "status", text: metaText });

  // Liste détaillée — utile pour vérifier ce qu'on s'apprête à envoyer au panier.
  const hasTitles = items.some((i) => i.title);
  let detailsEl = null;
  if (hasTitles) {
    detailsEl = el("details");
    detailsEl.style.marginTop = "8px";
    detailsEl.style.fontSize = "13px";
    const summary = el("summary", { text: "Voir le détail" });
    summary.style.cursor = "pointer";
    summary.style.color = "#a0a8b8";
    detailsEl.appendChild(summary);
    const ul = el("ul");
    ul.style.margin = "8px 0 0 0";
    ul.style.padding = "0 0 0 20px";
    for (const item of items) {
      const li = el("li");
      li.style.marginBottom = "4px";
      const qty = item.quantity && item.quantity > 1 ? `${item.quantity} × ` : "";
      const priceText =
        typeof item.price === "number" ? ` — ${item.price.toFixed(2)}€` : "";
      li.textContent = `${qty}${item.title || item.ean}${priceText}`;
      ul.appendChild(li);
    }
    detailsEl.appendChild(ul);
  }

  const openBtn = el("button", {
    text: "Ouvrir Carrefour",
    attrs: {
      type: "button",
      "aria-label": "Ouvrir Carrefour pour remplir le panier avec cette liste",
    },
  });
  openBtn.addEventListener("click", () => {
    chrome.tabs.create({ url: "https://www.carrefour.fr/" });
    window.close();
  });

  const editBtn = el("button", {
    text: "Modifier sur VoixCourses",
    attrs: {
      type: "button",
      "aria-label":
        "Retourner sur VoixCourses pour modifier la liste avant de remplir le panier",
    },
  });
  editBtn.style.background = "transparent";
  editBtn.style.color = "#4cc9f0";
  editBtn.style.border = "1px solid #4cc9f0";
  editBtn.addEventListener("click", () => {
    chrome.tabs.create({ url: list.returnUrl || WEB_APP_URL });
    window.close();
  });

  const clearBtn = el("button", {
    text: "Supprimer la liste",
    attrs: { type: "button" },
  });
  clearBtn.style.background = "transparent";
  clearBtn.style.color = "#f0f0f5";
  clearBtn.style.border = "1px solid #2b3a55";
  clearBtn.addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "CLEAR_PENDING_LIST" }, () => {
      render(null);
    });
  });

  content.appendChild(p);
  content.appendChild(meta);
  if (detailsEl) content.appendChild(detailsEl);
  content.appendChild(openBtn);
  content.appendChild(editBtn);
  content.appendChild(clearBtn);
}

chrome.runtime.sendMessage({ type: "GET_PENDING_LIST" }, (response) => {
  render(response?.list || null);
});
