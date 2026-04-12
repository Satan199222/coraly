/**
 * Popup de l'extension (clic sur l'icône VoixCourses).
 */

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

function render(list) {
  const content = document.getElementById("content");
  if (!content) return;
  clearChildren(content);

  if (!list) {
    const p1 = el("p", { text: "Aucune liste en attente." });
    const p2 = el("p", { className: "muted" });
    p2.appendChild(document.createTextNode("Créez votre liste de courses sur "));
    p2.appendChild(
      el("a", {
        href: "https://voixcourses.fr",
        text: "voixcourses.fr",
        attrs: { target: "_blank", rel: "noopener" },
      })
    );
    p2.appendChild(
      document.createTextNode(", puis envoyez-la vers cette extension.")
    );
    content.appendChild(p1);
    content.appendChild(p2);
    return;
  }

  const p = el("p", { text: `Liste prête : ${list.title}` });
  const meta = el("div", {
    className: "status",
    text: `${list.eans.length} produit${list.eans.length > 1 ? "s" : ""} · Magasin ${list.storeRef}`,
  });

  const openBtn = el("button", {
    text: "Ouvrir Carrefour",
    attrs: { type: "button" },
  });
  openBtn.addEventListener("click", () => {
    chrome.tabs.create({ url: "https://www.carrefour.fr/" });
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
  content.appendChild(openBtn);
  content.appendChild(clearBtn);
}

chrome.runtime.sendMessage({ type: "GET_PENDING_LIST" }, (response) => {
  render(response?.list || null);
});
