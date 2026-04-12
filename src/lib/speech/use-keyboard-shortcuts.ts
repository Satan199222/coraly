"use client";

import { useEffect } from "react";

export interface KeyboardShortcuts {
  /** Appelé quand ? est pressé — typiquement pour ouvrir le dialog d'aide. */
  onHelp?: () => void;
  /** Appelé quand Escape est pressé hors d'un dialog — stopper la synthèse vocale
   *  en cours, pas interrompre un champ texte que l'utilisateur est en train d'éditer. */
  onEscape?: () => void;
  /** Appelé quand "m" est pressé hors d'un input — toggle du micro. */
  onToggleMic?: () => void;
}

/**
 * Vrai si l'élément focusé est un champ éditable — on n'intercepte PAS les
 * touches dans ce cas, sinon impossible d'écrire des "?" ou "m" dans sa liste.
 */
function isEditing(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.isContentEditable) return true;
  return false;
}

/**
 * Raccourcis clavier globaux accessibles depuis n'importe où hors d'un
 * champ éditable. Pensés pour un utilisateur au clavier uniquement : une
 * seule touche (pas de combo) car elles sont plus faciles à mémoriser.
 *
 * - ? ou Shift+/ : afficher l'aide
 * - Escape : arrêter la synthèse vocale (et fermer dialog si ouvert)
 * - m : toggle du micro (si supporté)
 */
export function useKeyboardShortcuts({
  onHelp,
  onEscape,
  onToggleMic,
}: KeyboardShortcuts) {
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      // Ne pas interférer avec la saisie dans un champ. Escape est une
      // exception : il doit pouvoir sortir de la page même depuis un input.
      if (e.key !== "Escape" && isEditing(e.target)) return;

      // Ignorer si combos avec Ctrl/Alt/Meta — ce sont des raccourcis browser.
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      if (e.key === "?" || (e.shiftKey && e.key === "/")) {
        e.preventDefault();
        onHelp?.();
        return;
      }
      if (e.key === "Escape") {
        onEscape?.();
        return;
      }
      if (e.key === "m" || e.key === "M") {
        e.preventDefault();
        onToggleMic?.();
        return;
      }
    }

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onHelp, onEscape, onToggleMic]);
}
