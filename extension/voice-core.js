/**
 * Module vocal partagé par les content scripts sur voixcourses.fr ET
 * carrefour.fr. Chargé en premier dans l'ordre du manifest, expose
 * `window.__voixcoursesTTS` utilisable par les scripts suivants.
 *
 * Fonctionnalités :
 * - Synthèse vocale française avec prononciation normalisée
 * - Message de bienvenue à l'arrivée (1 fois toutes les 30 min)
 * - Désactivation/réactivation par touche Entrée / V
 * - Lecture au focus (focusin) de tous les éléments interactifs
 */

(function () {
  const VOICE_PREF_KEY = "voixcourses-voice-enabled";
  const VOICE_GREETED_KEY = "voixcourses-voice-greeted-at";
  const GREETING_WINDOW_MS = 30 * 60 * 1000;

  const tts = {
    frenchVoice: null,
    initialized: false,
    enabled: true,
    lastSpoken: "",

    init() {
      if (this.initialized) return;
      this.initialized = true;
      const pickVoice = () => {
        const voices = window.speechSynthesis.getVoices();
        this.frenchVoice = voices.find((v) => v.lang.startsWith("fr")) || null;
      };
      pickVoice();
      window.speechSynthesis.onvoiceschanged = pickVoice;
    },

    normalize(text) {
      return (text || "")
        .replace(/(\d+)[.,](\d{2})\s*€/g, "$1 euros $2 centimes")
        .replace(/(\d+)\s*€/g, "$1 euros")
        .replace(/(\d+(?:[.,]\d+)?)\s*L\b/g, "$1 litres")
        .replace(/(\d+(?:[.,]\d+)?)\s*kg\b/gi, "$1 kilogrammes")
        .replace(/(\d+(?:[.,]\d+)?)\s*g\b/g, "$1 grammes")
        .replace(/(\d+)\s*cl\b/g, "$1 centilitres")
        .replace(/(\d+)\s*ml\b/g, "$1 millilitres");
    },

    speak(text, options) {
      const force = options && options.force;
      if (!text || !window.speechSynthesis) return;
      if (!this.enabled && !force) return;
      this.init();
      const normalized = this.normalize(text);
      if (normalized === this.lastSpoken) return;
      this.lastSpoken = normalized;
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(normalized);
      utterance.lang = "fr-FR";
      utterance.rate = 1.05;
      if (this.frenchVoice) utterance.voice = this.frenchVoice;
      window.speechSynthesis.speak(utterance);
    },

    cancel() {
      if (window.speechSynthesis) window.speechSynthesis.cancel();
      this.lastSpoken = "";
    },

    setEnabled(enabled) {
      this.enabled = enabled;
      if (!enabled) this.cancel();
      chrome.storage.local.set({ [VOICE_PREF_KEY]: enabled });
    },
  };

  function getAccessibleText(el) {
    if (!el) return "";
    const aria = el.getAttribute("aria-label");
    if (aria) return aria;
    const labelledBy = el.getAttribute("aria-labelledby");
    if (labelledBy) {
      const ref = document.getElementById(labelledBy);
      if (ref) return (ref.textContent || "").trim();
    }
    if (
      (el.tagName === "INPUT" ||
        el.tagName === "TEXTAREA" ||
        el.tagName === "SELECT") &&
      el.labels &&
      el.labels.length
    ) {
      const label = el.labels[0].textContent;
      if (label) return label.trim();
    }
    const title = el.getAttribute("title");
    if (title) return title;
    return (el.textContent || "").trim().slice(0, 250);
  }

  let focusTimer = null;
  function installFocusSpeaker() {
    document.addEventListener(
      "focusin",
      (e) => {
        const target = e.target;
        if (!target || !(target instanceof HTMLElement)) return;
        if (target === document.body) return;
        if (focusTimer) clearTimeout(focusTimer);
        focusTimer = setTimeout(() => {
          let typeHint = "";
          const tag = target.tagName.toLowerCase();
          const role = target.getAttribute("role");
          if (tag === "button" || role === "button") typeHint = ", bouton";
          else if (tag === "a") typeHint = ", lien";
          else if (tag === "input") {
            const type = target.getAttribute("type") || "text";
            if (type === "checkbox")
              typeHint = target.checked
                ? ", case cochée"
                : ", case non cochée";
            else if (type === "radio")
              typeHint = target.checked
                ? ", bouton radio sélectionné"
                : ", bouton radio";
            else typeHint = ", champ de saisie";
          } else if (tag === "select") typeHint = ", menu déroulant";
          else if (tag === "textarea") typeHint = ", zone de texte";

          const text = getAccessibleText(target);
          if (text) tts.speak(text + typeHint);
        }, 120);
      },
      true
    );
  }

  async function greetIfNeeded(siteLabel) {
    const pref = await new Promise((r) =>
      chrome.storage.local.get([VOICE_PREF_KEY], (v) => r(v[VOICE_PREF_KEY]))
    );
    const lastGreet = await new Promise((r) =>
      chrome.storage.local.get([VOICE_GREETED_KEY], (v) =>
        r(v[VOICE_GREETED_KEY])
      )
    );

    tts.enabled = pref !== false;

    const now = Date.now();
    if (lastGreet && now - lastGreet < GREETING_WINDOW_MS) return;
    chrome.storage.local.set({ [VOICE_GREETED_KEY]: now });

    const greeting = `VoixCourses activé sur ${siteLabel}. Appuyez sur Entrée pour désactiver la voix, ou sur Tabulation pour continuer.`;
    tts.speak(greeting, { force: true });

    const keyHandler = (e) => {
      const active = document.activeElement;
      const isTyping =
        active &&
        (active.tagName === "INPUT" ||
          active.tagName === "TEXTAREA" ||
          active.isContentEditable);
      if (isTyping) return;

      if (e.key === "Enter") {
        e.preventDefault();
        tts.setEnabled(false);
        tts.speak(
          "Voix désactivée. Appuyez sur la touche V pour la réactiver.",
          { force: true }
        );
        cleanup();
      } else if (e.key === "Tab") {
        cleanup();
      }
    };

    const cleanup = () => {
      document.removeEventListener("keydown", keyHandler, true);
      if (greetingTimeoutId) clearTimeout(greetingTimeoutId);
    };
    const greetingTimeoutId = setTimeout(cleanup, 8000);
    document.addEventListener("keydown", keyHandler, true);
  }

  function installVoiceToggleShortcut() {
    document.addEventListener(
      "keydown",
      (e) => {
        const active = document.activeElement;
        const isTyping =
          active &&
          (active.tagName === "INPUT" ||
            active.tagName === "TEXTAREA" ||
            active.isContentEditable);
        if (isTyping) return;

        if ((e.key === "v" || e.key === "V") && !e.ctrlKey && !e.metaKey) {
          if (!tts.enabled) {
            tts.setEnabled(true);
            tts.speak("Voix réactivée.", { force: true });
          }
        }
      },
      true
    );
  }

  // Expose pour les autres content scripts
  window.__voixcoursesTTS = {
    tts,
    getAccessibleText,
    installFocusSpeaker,
    greetIfNeeded,
    installVoiceToggleShortcut,
  };
})();
