/**
 * Module vocal partagé par les content scripts sur voixcourses.fr ET
 * carrefour.fr. Chargé en premier dans l'ordre du manifest, expose
 * `window.__voixcoursesTTS`.
 */

(function () {
  const VOICE_PREF_KEY = "voixcourses-voice-enabled";
  const VOICE_GREETED_KEY = "voixcourses-voice-greeted-at";
  const GREETING_WINDOW_MS = 30 * 60 * 1000;

  const tts = {
    frenchVoice: null,
    voicesReady: false,
    initialized: false,
    enabled: true,
    lastSpoken: "",
    // File d'attente : si speak() est appelé AVANT que les voix soient chargées,
    // on stocke le texte ici pour le rejouer dès qu'une voix française est prête.
    // Sans ça, le 1er speak() sur Chrome utilise la voix anglaise par défaut de
    // l'OS (les voix ne sont pas synchrones au load).
    pendingSpeech: null,

    init() {
      if (this.initialized) return;
      this.initialized = true;
      const pickVoice = () => {
        const voices = window.speechSynthesis.getVoices();
        if (voices.length === 0) return;
        this.frenchVoice = voices.find((v) => v.lang.startsWith("fr")) || null;
        this.voicesReady = true;
        // Si un speak() attendait, on le lance maintenant avec la bonne voix.
        if (this.pendingSpeech) {
          const { text, force } = this.pendingSpeech;
          this.pendingSpeech = null;
          this._speakNow(text, force);
        }
      };
      pickVoice();
      window.speechSynthesis.onvoiceschanged = pickVoice;
      // Filet de sécurité : si onvoiceschanged ne se déclenche jamais
      // (certains builds de Firefox/Chrome), on débloque après 1,2s.
      setTimeout(() => {
        if (!this.voicesReady) {
          this.voicesReady = true;
          if (this.pendingSpeech) {
            const { text, force } = this.pendingSpeech;
            this.pendingSpeech = null;
            this._speakNow(text, force);
          }
        }
      }, 1200);
    },

    normalize(text) {
      return (
        (text || "")
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
          .replace(/(\d+)[.,](\d{2})\s*€/g, "$1 euros $2 centimes")
          .replace(/(\d+)\s*€/g, "$1 euros")
          .replace(/(\d+(?:[.,]\d+)?)\s*L\b/g, "$1 litres")
          .replace(/(\d+(?:[.,]\d+)?)\s*kg\b/gi, "$1 kilogrammes")
          .replace(/(\d+(?:[.,]\d+)?)\s*g\b/g, "$1 grammes")
          .replace(/(\d+)\s*cl\b/g, "$1 centilitres")
          .replace(/(\d+)\s*ml\b/g, "$1 millilitres")
          .replace(/\bpar\s+KG\b/gi, "par kilogramme")
          .replace(/\bpar\s+L\b/g, "par litre")
      );
    },

    _speakNow(text, force) {
      if (!text || !window.speechSynthesis) return;
      const normalized = this.normalize(text);
      if (!force && normalized === this.lastSpoken) return;
      this.lastSpoken = normalized;
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(normalized);
      utterance.lang = "fr-FR";
      utterance.rate = 1.05;
      if (this.frenchVoice) utterance.voice = this.frenchVoice;
      window.speechSynthesis.speak(utterance);
    },

    speak(text, options) {
      const force = options && options.force;
      if (!text || !window.speechSynthesis) return;
      if (!this.enabled && !force) return;
      this.init();

      // Si les voix ne sont pas encore chargées, on diffère (pour ne pas
      // partir avec la voix anglaise par défaut).
      if (!this.voicesReady) {
        this.pendingSpeech = { text, force };
        return;
      }
      this._speakNow(text, force);
    },

    cancel() {
      if (window.speechSynthesis) window.speechSynthesis.cancel();
      this.lastSpoken = "";
      this.pendingSpeech = null;
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

  /**
   * Greeting au 1er affichage d'une page, limité à 1 fois toutes les 30 min
   * pour ne pas saoûler l'utilisateur qui navigue.
   *
   * `forceVoiceOn` : si true, on active la voix même si l'utilisateur l'avait
   * désactivée (utile quand on arrive sur Carrefour avec une liste VoixCourses
   * en attente — l'utilisateur a explicitement demandé l'action, donc on parle).
   *
   * `bypassWindow` : si true, on ignore la fenêtre anti-spam de 30 min
   * (idem : listes VoixCourses méritent d'être annoncées à chaque fois).
   */
  async function greetIfNeeded(siteLabel, opts = {}) {
    const { forceVoiceOn = false, bypassWindow = false } = opts;

    const pref = await new Promise((r) =>
      chrome.storage.local.get([VOICE_PREF_KEY], (v) => r(v[VOICE_PREF_KEY]))
    );
    const lastGreet = await new Promise((r) =>
      chrome.storage.local.get([VOICE_GREETED_KEY], (v) =>
        r(v[VOICE_GREETED_KEY])
      )
    );

    tts.enabled = forceVoiceOn ? true : pref !== false;

    const now = Date.now();
    if (!bypassWindow && lastGreet && now - lastGreet < GREETING_WINDOW_MS) {
      return;
    }
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

  window.__voixcoursesTTS = {
    tts,
    getAccessibleText,
    installFocusSpeaker,
    greetIfNeeded,
    installVoiceToggleShortcut,
  };
})();
