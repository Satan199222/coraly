"use client";

import { useEffect } from "react";

interface FocusAnnounceOptions {
  rate?: number;
  lang?: string;
}

/**
 * Annonce vocale au focus.
 *
 * Quand `enabled` est true, écoute les événements `focusin` sur le document
 * et lit à voix haute le contenu de chaque élément focusé.
 *
 * Stratégie :
 * - Pour <button>, <a>, <input>, <select>, <textarea> : utilise aria-label
 *   ou aria-labelledby ou textContent
 * - Pour les containers (article, section) : utilise aria-label ou la
 *   première heading enfant
 * - Évite de répéter le même message deux fois de suite
 *
 * Note : ce hook est OPT-IN. Il est désactivé par défaut pour ne pas
 * interférer avec les lecteurs d'écran (qui font déjà ce travail).
 */
export function useFocusAnnounce(
  enabled: boolean,
  options: FocusAnnounceOptions = {}
) {
  const { rate = 1.1, lang = "fr-FR" } = options;

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    let lastAnnouncement = "";
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    /**
     * Améliorer la prononciation française :
     * - "1.26€" → "1 euros 26 centimes"
     * - "1L" → "1 litre"
     * - "500g" → "500 grammes"
     */
    function preparePronunciation(text: string): string {
      return text
        // Prix par unité : "1,26 € / KG" → "1 euros 26 centimes par kilogramme"
        .replace(
          /(\d+)[.,](\d{2})\s*€\s*\/\s*KG\b/gi,
          "$1 euros $2 centimes par kilogramme"
        )
        .replace(/(\d+)\s*€\s*\/\s*KG\b/gi, "$1 euros par kilogramme")
        .replace(
          /(\d+)[.,](\d{2})\s*€\s*\/\s*L\b/g,
          "$1 euros $2 centimes par litre"
        )
        .replace(/(\d+)\s*€\s*\/\s*L\b/g, "$1 euros par litre")
        // Prix simples
        .replace(/(\d+)[.,](\d{2})\s*€/g, "$1 euros $2 centimes")
        .replace(/(\d+)\s*€/g, "$1 euros")
        // Unités
        .replace(/(\d+(?:[.,]\d+)?)\s*L\b/g, "$1 litres")
        .replace(/(\d+(?:[.,]\d+)?)\s*kg\b/gi, "$1 kilogrammes")
        .replace(/(\d+(?:[.,]\d+)?)\s*g\b/g, "$1 grammes")
        .replace(/(\d+)\s*cl\b/g, "$1 centilitres")
        .replace(/(\d+)\s*ml\b/g, "$1 millilitres");
    }

    function announce(text: string) {
      const cleaned = preparePronunciation(text.trim());
      if (!cleaned || cleaned === lastAnnouncement) return;
      if (!window.speechSynthesis) return;

      lastAnnouncement = cleaned;
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(cleaned);
      utterance.lang = lang;
      utterance.rate = rate;

      // Préférer une voix du pays demandé, sinon n'importe quelle voix française
      const voices = window.speechSynthesis.getVoices();
      const exactVoice = voices.find((v) => v.lang === lang);
      const anyFrenchVoice = voices.find((v) => v.lang.startsWith("fr"));
      const picked = exactVoice ?? anyFrenchVoice;
      if (picked) utterance.voice = picked;

      window.speechSynthesis.speak(utterance);
    }

    function getElementText(el: HTMLElement): string {
      // 1. aria-label direct
      const ariaLabel = el.getAttribute("aria-label");
      if (ariaLabel) return ariaLabel;

      // 2. aria-labelledby
      const labelledBy = el.getAttribute("aria-labelledby");
      if (labelledBy) {
        const labelEl = document.getElementById(labelledBy);
        if (labelEl) return labelEl.textContent?.trim() || "";
      }

      // 3. associated <label> for inputs
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
        const labels = (el as HTMLInputElement).labels;
        if (labels && labels.length > 0) {
          return labels[0].textContent?.trim() || "";
        }
      }

      // 4. textContent (limité à 200 caractères)
      const text = el.textContent?.trim() || "";
      return text.slice(0, 200);
    }

    /**
     * Si l'élément focusé est à l'intérieur d'un role="group" avec un label,
     * on lit d'abord le label du groupe (une fois par groupe) pour donner
     * le contexte du produit AVANT l'action du bouton. Indispensable pour
     * les cards ProductResults : sans ça, Tab saute de "Confirmer" à
     * "Confirmer" sans jamais annoncer quel produit on confirme.
     */
    let lastGroupLabel = "";

    function getGroupContext(el: HTMLElement): string {
      const group = el.closest<HTMLElement>('[role="group"]');
      if (!group) {
        lastGroupLabel = "";
        return "";
      }
      const labelledBy = group.getAttribute("aria-labelledby");
      let label = group.getAttribute("aria-label") || "";
      if (!label && labelledBy) {
        const labelEl = document.getElementById(labelledBy);
        label =
          labelEl?.getAttribute("aria-label") ||
          labelEl?.textContent?.trim() ||
          "";
      }
      if (!label || label === lastGroupLabel) return "";
      lastGroupLabel = label;
      return label;
    }

    function handleFocus(e: FocusEvent) {
      const target = e.target as HTMLElement;
      if (!target || !(target instanceof HTMLElement)) return;

      // Debounce 100ms pour grouper les changements rapides
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        const groupCtx = getGroupContext(target);
        const text = getElementText(target);
        // Préfixer par le label du groupe SI on vient d'y entrer : donne le
        // contexte (titre produit, quantité, prix) avant l'action (Confirmer).
        const full = groupCtx ? `${groupCtx}. ${text}` : text;
        if (full) announce(full);
      }, 100);
    }

    /**
     * Les options d'un <select> natif ne déclenchent PAS de focusin au
     * parcours des flèches (elles sont internes au browser). L'utilisateur
     * clavier qui n'a PAS de screen reader ne saurait donc jamais quelle
     * option il vient de choisir. On écoute `change` pour annoncer la
     * valeur sélectionnée.
     */
    function handleSelectChange(e: Event) {
      const target = e.target;
      if (!(target instanceof HTMLSelectElement)) return;
      const labelText =
        target.getAttribute("aria-label") ||
        target.labels?.[0]?.textContent?.trim() ||
        "";
      const selectedOption = target.options[target.selectedIndex];
      const optionText = selectedOption?.textContent?.trim() ?? target.value;
      // "Thème : Sombre" — contexte (label) + nouvelle valeur
      const msg = labelText ? `${labelText} ${optionText}` : optionText;
      announce(msg);
    }

    document.addEventListener("focusin", handleFocus);
    document.addEventListener("change", handleSelectChange);
    return () => {
      document.removeEventListener("focusin", handleFocus);
      document.removeEventListener("change", handleSelectChange);
      if (timeoutId) clearTimeout(timeoutId);
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, [enabled, rate, lang]);
}
