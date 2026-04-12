"use client";

export type BrowserKind =
  | "chrome"
  | "edge"
  | "brave"
  | "firefox"
  | "safari"
  | "opera"
  | "mobile"
  | "unknown";

export interface BrowserInfo {
  kind: BrowserKind;
  /** true si l'extension est installable sur ce browser (desktop Chromium ou Firefox). */
  canInstallExtension: boolean;
  /** URL de la page de l'extension sur le store approprié (null si non supporté). */
  storeUrl: string | null;
  /** Libellé humain pour l'UI : "Chrome Web Store", "Firefox Add-ons"... */
  storeLabel: string | null;
  /** Raison si non supporté : message à afficher à l'utilisateur. */
  unsupportedReason: string | null;
}

/** URLs futures du store — à mettre à jour quand l'extension sera publiée. */
const CHROME_STORE_URL = "https://chrome.google.com/webstore/search/voixcourses";
const FIREFOX_STORE_URL = "https://addons.mozilla.org/firefox/search/?q=voixcourses";
const EDGE_STORE_URL = "https://microsoftedge.microsoft.com/addons/search?search=voixcourses";

/**
 * Détecte le navigateur côté client. Uniquement appelable dans un contexte
 * React où navigator est défini — retourne `unknown` côté serveur.
 */
export function detectBrowser(): BrowserInfo {
  if (typeof navigator === "undefined") {
    return {
      kind: "unknown",
      canInstallExtension: false,
      storeUrl: null,
      storeLabel: null,
      unsupportedReason: null,
    };
  }

  const ua = navigator.userAgent;
  const isMobile =
    /Android|iPhone|iPad|iPod|Mobile/i.test(ua) ||
    // @ts-expect-error legacy platform
    (navigator.userAgentData && navigator.userAgentData.mobile);

  if (isMobile) {
    return {
      kind: "mobile",
      canInstallExtension: false,
      storeUrl: null,
      storeLabel: null,
      unsupportedReason:
        "Les extensions navigateur ne sont pas disponibles sur mobile. Utilisez la liste manuelle ou ouvrez VoixCourses sur un ordinateur.",
    };
  }

  // Brave est détecté via une API spécifique (l'UA ressemble à Chrome).
  // @ts-expect-error brave API non typée
  if (navigator.brave && typeof navigator.brave.isBrave === "function") {
    return {
      kind: "brave",
      canInstallExtension: true,
      storeUrl: CHROME_STORE_URL,
      storeLabel: "Chrome Web Store (compatible Brave)",
      unsupportedReason: null,
    };
  }

  if (/Edg\//.test(ua)) {
    return {
      kind: "edge",
      canInstallExtension: true,
      storeUrl: EDGE_STORE_URL,
      storeLabel: "Edge Add-ons",
      unsupportedReason: null,
    };
  }

  if (/OPR\/|Opera/.test(ua)) {
    return {
      kind: "opera",
      canInstallExtension: true,
      storeUrl: CHROME_STORE_URL,
      storeLabel: "Chrome Web Store (compatible Opera)",
      unsupportedReason: null,
    };
  }

  if (/Firefox/.test(ua)) {
    return {
      kind: "firefox",
      canInstallExtension: true,
      storeUrl: FIREFOX_STORE_URL,
      storeLabel: "Firefox Add-ons",
      unsupportedReason: null,
    };
  }

  // Safari sans support d'extension Chromium
  if (/Safari/.test(ua) && !/Chrome|Chromium/.test(ua)) {
    return {
      kind: "safari",
      canInstallExtension: false,
      storeUrl: null,
      storeLabel: null,
      unsupportedReason:
        "Safari n'est pas encore supporté. Essayez VoixCourses avec Chrome, Edge, Brave ou Firefox pour profiter de l'extension.",
    };
  }

  if (/Chrome|Chromium/.test(ua)) {
    return {
      kind: "chrome",
      canInstallExtension: true,
      storeUrl: CHROME_STORE_URL,
      storeLabel: "Chrome Web Store",
      unsupportedReason: null,
    };
  }

  return {
    kind: "unknown",
    canInstallExtension: true,
    storeUrl: CHROME_STORE_URL,
    storeLabel: "Chrome Web Store",
    unsupportedReason: null,
  };
}

/**
 * Nom lisible du navigateur pour l'UI (ex: "Chrome", "Firefox"…).
 */
export function browserDisplayName(kind: BrowserKind): string {
  switch (kind) {
    case "chrome":
      return "Chrome";
    case "edge":
      return "Edge";
    case "brave":
      return "Brave";
    case "firefox":
      return "Firefox";
    case "safari":
      return "Safari";
    case "opera":
      return "Opera";
    case "mobile":
      return "votre navigateur mobile";
    default:
      return "votre navigateur";
  }
}
