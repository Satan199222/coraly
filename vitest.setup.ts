import "@testing-library/jest-dom/vitest";

// jsdom ne fournit pas SpeechSynthesis — on le mock pour que les hooks
// useSpeech/useFocusAnnounce ne crashent pas pendant les tests composants.
if (typeof window !== "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).speechSynthesis = {
    cancel: () => {},
    speak: () => {},
    pause: () => {},
    resume: () => {},
    getVoices: () => [],
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).SpeechSynthesisUtterance = class {
    text = "";
    lang = "fr-FR";
    rate = 1;
    onstart?: () => void;
    onend?: () => void;
    onerror?: () => void;
    constructor(text: string) {
      this.text = text;
    }
  };
}
