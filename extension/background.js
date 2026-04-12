/**
 * Service worker de l'extension VoixCourses.
 *
 * Rôle : recevoir une liste depuis voixcourses.fr (via externally_connectable),
 * la stocker, et ouvrir un onglet carrefour.fr où content.js prendra le relais.
 */

const STORAGE_KEY = "voixcourses-pending-list";

/**
 * Met à jour le badge sur l'icône de l'extension.
 * - Vide = aucune liste en attente
 * - Nombre = nombre de produits en attente de transfert
 */
function updateBadge(list) {
  if (list && Array.isArray(list.eans) && list.eans.length > 0) {
    chrome.action.setBadgeText({ text: String(list.eans.length) });
    chrome.action.setBadgeBackgroundColor({ color: "#4cc9f0" });
    chrome.action.setTitle({
      title: `VoixCourses — ${list.eans.length} produit${list.eans.length > 1 ? "s" : ""} en attente. Cliquez pour ouvrir Carrefour.`,
    });
  } else {
    chrome.action.setBadgeText({ text: "" });
    chrome.action.setTitle({ title: "VoixCourses — aucune liste en attente" });
  }
}

// Initialiser le badge au démarrage
chrome.storage.local.get([STORAGE_KEY], (result) => {
  updateBadge(result[STORAGE_KEY]);
});

// Mettre à jour le badge quand la liste change
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes[STORAGE_KEY]) {
    updateBadge(changes[STORAGE_KEY].newValue);
  }
});

/**
 * Écoute les messages venant de voixcourses.fr.
 * Messages acceptés :
 * - { type: "PING" } → répond { installed: true, version }
 * - { type: "SET_LIST", payload: { storeRef, basketServiceId, eans, title? } }
 */
chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  if (!message || typeof message !== "object") {
    sendResponse({ error: "Invalid message" });
    return;
  }

  if (message.type === "PING") {
    const manifest = chrome.runtime.getManifest();
    sendResponse({ installed: true, version: manifest.version });
    return;
  }

  if (message.type === "SET_LIST") {
    const { storeRef, basketServiceId, eans, title } = message.payload || {};
    if (!storeRef || !basketServiceId || !Array.isArray(eans) || eans.length === 0) {
      sendResponse({ error: "Payload invalide" });
      return;
    }

    const list = {
      storeRef,
      basketServiceId,
      eans,
      title: title || `${eans.length} produit${eans.length > 1 ? "s" : ""}`,
      createdAt: Date.now(),
    };

    chrome.storage.local.set({ [STORAGE_KEY]: list }, () => {
      // Ouvrir carrefour.fr dans un nouvel onglet
      chrome.tabs.create({ url: "https://www.carrefour.fr/" }, (tab) => {
        sendResponse({
          ok: true,
          tabId: tab?.id,
          itemCount: eans.length,
        });
      });
    });
    return true; // async response
  }

  sendResponse({ error: "Type de message inconnu" });
});

/**
 * Le popup (icône de l'extension) peut demander la liste en attente
 * pour l'afficher à l'utilisateur.
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "GET_PENDING_LIST") {
    chrome.storage.local.get([STORAGE_KEY], (result) => {
      sendResponse({ list: result[STORAGE_KEY] || null });
    });
    return true; // async
  }

  if (message?.type === "CLEAR_PENDING_LIST") {
    chrome.storage.local.remove([STORAGE_KEY], () => {
      sendResponse({ ok: true });
    });
    return true;
  }
});
