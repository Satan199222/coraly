/**
 * Marqueur injecté sur les pages voixcourses.fr.
 *
 * Permet à l'app web de détecter si l'extension est installée :
 * - Ajoute `data-voixcourses-extension` sur <html>
 * - Stocke l'ID de l'extension pour les messages depuis la page
 * - Dispatch un CustomEvent "voixcourses-extension-ready"
 */
(function () {
  const manifest = chrome.runtime.getManifest();

  document.documentElement.dataset.voixcoursesExtension = manifest.version;
  document.documentElement.dataset.voixcoursesExtensionId = chrome.runtime.id;

  window.dispatchEvent(
    new CustomEvent("voixcourses-extension-ready", {
      detail: {
        installed: true,
        version: manifest.version,
        extensionId: chrome.runtime.id,
      },
    })
  );
})();
