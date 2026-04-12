"use client";

import { useEffect, useState } from "react";

/**
 * Représente la présence et les infos de l'extension VoixCourses.
 */
interface ExtensionState {
  installed: boolean;
  version: string | null;
  extensionId: string | null;
}

/**
 * Hook de détection de l'extension navigateur VoixCourses.
 *
 * L'extension injecte un marqueur sur <html> + dispatche un CustomEvent.
 * On détecte les deux : le marqueur (pour le render initial) et l'event
 * (pour le cas où l'utilisateur installe l'extension pendant la session).
 */
export function useExtension(): ExtensionState {
  const [state, setState] = useState<ExtensionState>({
    installed: false,
    version: null,
    extensionId: null,
  });

  useEffect(() => {
    // 1. Check initial marker (extension loaded before React)
    const marker = document.documentElement.dataset.voixcoursesExtension;
    const markerId = document.documentElement.dataset.voixcoursesExtensionId;
    if (marker) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- lecture initiale d'état externe (DOM dataset posé avant React)
      setState({
        installed: true,
        version: marker,
        extensionId: markerId || null,
      });
      return;
    }

    // 2. Listen for the ready event (extension loaded after React)
    function onReady(e: Event) {
      const detail = (e as CustomEvent).detail || {};
      setState({
        installed: true,
        version: detail.version || null,
        extensionId: detail.extensionId || null,
      });
    }

    window.addEventListener("voixcourses-extension-ready", onReady);
    return () => {
      window.removeEventListener("voixcourses-extension-ready", onReady);
    };
  }, []);

  return state;
}

/**
 * Envoyer une liste à l'extension via chrome.runtime.sendMessage.
 * Nécessite `externally_connectable` dans le manifest de l'extension.
 */
export async function sendListToExtension(
  extensionId: string,
  payload: {
    storeRef: string;
    basketServiceId: string;
    /** Liste des produits. `title` et `price` permettent à l'extension
     *  d'afficher le détail et d'annoncer "Lait Lactel non ajouté" en cas
     *  d'échec spécifique plutôt qu'un EAN opaque. */
    items: Array<{ ean: string; quantity: number; title?: string; price?: number }>;
    title?: string;
    /** URL pour revenir vers l'app web (bouton "Modifier ma liste" dans la bannière). */
    returnUrl?: string;
  }
): Promise<{ ok: boolean; error?: string; itemCount?: number }> {
  return new Promise((resolve) => {
    // @ts-expect-error — chrome est injecté globalement par le navigateur
    if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) {
      resolve({ ok: false, error: "API chrome.runtime indisponible" });
      return;
    }

    // @ts-expect-error — chrome global
    chrome.runtime.sendMessage(
      extensionId,
      { type: "SET_LIST", payload },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (response: any) => {
        // @ts-expect-error — chrome.runtime.lastError
        const err = chrome.runtime.lastError;
        if (err) {
          resolve({ ok: false, error: err.message });
          return;
        }
        if (response?.error) {
          resolve({ ok: false, error: response.error });
          return;
        }
        resolve({
          ok: true,
          itemCount: response?.itemCount,
        });
      }
    );
  });
}
