"use client";

/**
 * VoixPoste — Page /poste
 * Interface vocale Koraly pour La Poste : suivi de colis + envoi de courrier.
 *
 * Fonctionnalités :
 * - Suivi vocal : "Où est mon colis ?" → numéro → statut annoné par Koraly
 * - Envoi courrier : dictée → formatage → relecture vocale → confirmation → Maileva
 * - Envoi recommandé électronique (LRE) à valeur légale
 * - Saisie vocale d'adresse via BAN (autocomplétion)
 * - WCAG AAA, police Luciole, design system marine
 *
 * Dépend de Phase 3a (GROA-242) : clients API La Poste Suivi + BAN + Maileva.
 * GROA-243 — Phase 3b VoixPoste
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { KoralyPageShell } from "@/lib/shared/components/koraly-page-shell";
import { KoralyMsgBubble } from "@/lib/shared/components/koraly-msg-bubble";
import { KoralyOrb } from "@/lib/shared/components/koraly-orb";
import type { KoralyOrbStatus } from "@/lib/shared/components/koraly-orb";
import { useSpeech } from "@/lib/shared/speech/use-speech";
import { usePreferences, SPEECH_RATE_VALUE } from "@/lib/preferences/use-preferences";
import { useDocumentTitle } from "@/lib/useDocumentTitle";
import type {
  TrackingResult,
  BanAddress,
  MailSendingResult,
  LreSendingResult,
} from "@/lib/poste/types";

// ---------------------------------------------------------------------------
// Types internes
// ---------------------------------------------------------------------------

type PosteMode = "home" | "tracking" | "mail" | "lre";

type PosteStep =
  // tracking
  | "tracking_await_number"
  | "tracking_loading"
  | "tracking_result"
  // mail
  | "mail_dictate"
  | "mail_address"
  | "mail_address_loading"
  | "mail_confirm"
  | "mail_sending"
  | "mail_done"
  // lre
  | "lre_dictate"
  | "lre_recipient_name"
  | "lre_recipient_email"
  | "lre_confirm"
  | "lre_sending"
  | "lre_done";

interface ChatMsg {
  id: string;
  role: "user" | "koraly";
  text: string;
  loading?: boolean;
}

interface MailDraft {
  content: string;
  recipientName: string;
  recipientAddress: BanAddress | null;
  addressSuggestions: BanAddress[];
}

interface LreDraft {
  body: string;
  recipientName: string;
  recipientEmail: string;
}

// ---------------------------------------------------------------------------
// Helpers de formatage oral
// ---------------------------------------------------------------------------

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function trackingStatusToText(result: TrackingResult): string {
  const product = result.product ? `(${result.product}) ` : "";
  const base = `Colis ${result.idShip} ${product}: ${result.statusLabel}.`;

  const lastEvent = result.events[0];
  const eventTxt = lastEvent
    ? ` Dernier événement le ${formatDate(lastEvent.date)}${lastEvent.location ? ` à ${lastEvent.location}` : ""} — ${lastEvent.label}.`
    : "";

  const deliveryTxt = result.estimatedDelivery
    ? ` Livraison estimée le ${formatDate(result.estimatedDelivery)}.`
    : result.deliveredAt
    ? ` Livré le ${formatDate(result.deliveredAt)}.`
    : "";

  return base + eventTxt + deliveryTxt;
}

// ---------------------------------------------------------------------------
// Composant message
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Boutons d'action rapide
// ---------------------------------------------------------------------------

const HOME_ACTIONS = [
  { label: "Suivre un colis", mode: "tracking" as PosteMode, key: "1" },
  { label: "Envoyer un courrier", mode: "mail" as PosteMode, key: "2" },
  { label: "Recommandé électronique (LRE)", mode: "lre" as PosteMode, key: "3" },
] as const;

// ---------------------------------------------------------------------------
// Page principale
// ---------------------------------------------------------------------------

export default function PostePage() {
  useDocumentTitle("VoixPoste — La Poste par la voix");

  const router = useRouter();
  const { prefs } = usePreferences();
  const {
    speak,
    cancelSpeech,
    startListening,
    stopListening,
    transcript,
    isListening,
    isSpeaking,
    isSupported,
  } = useSpeech({
    rate: SPEECH_RATE_VALUE[prefs.speechRate],
    lang: prefs.speechLocale,
    premiumVoice: prefs.premiumVoice,
  });

  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [helpOpen, setHelpOpen] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  const [mode, setMode] = useState<PosteMode>("home");
  const [step, setStep] = useState<PosteStep | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      id: "welcome",
      role: "koraly",
      text: "Bonjour ! Je suis Koraly. Que puis-je faire pour vous ? Suivre un colis, envoyer un courrier, ou envoyer un recommandé électronique ?",
    },
  ]);
  const [inputText, setInputText] = useState("");
  const [busy, setBusy] = useState(false);

  // Tracking
  const [trackingNumber, setTrackingNumber] = useState("");

  // Mail
  const [mailDraft, setMailDraft] = useState<MailDraft>({
    content: "",
    recipientName: "",
    recipientAddress: null,
    addressSuggestions: [],
  });

  // LRE
  const [lreDraft, setLreDraft] = useState<LreDraft>({
    body: "",
    recipientName: "",
    recipientEmail: "",
  });

  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const prevTranscriptRef = useRef("");

  // Scroll automatique en bas
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Injection du transcript dans l'input
  useEffect(() => {
    if (transcript && transcript !== prevTranscriptRef.current) {
      prevTranscriptRef.current = transcript;
      setInputText(transcript);
    }
  }, [transcript]);

  // Auto-soumission quand la reconnaissance s'arrête avec un transcript valide
  useEffect(() => {
    if (!isListening && inputText.trim() && inputText === transcript) {
      handleSubmit(inputText);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isListening]);

  const orbStatus: KoralyOrbStatus = isListening
    ? "listening"
    : isSpeaking
    ? "speaking"
    : "idle";

  // ---------------------------------------------------------------------------
  // Helpers internes
  // ---------------------------------------------------------------------------

  function pushMsg(role: "user" | "koraly", text: string, id?: string): string {
    const msgId = id ?? crypto.randomUUID();
    setMessages((prev) => [...prev, { id: msgId, role, text }]);
    return msgId;
  }

  function pushLoadingMsg(): string {
    const msgId = crypto.randomUUID();
    setMessages((prev) => [...prev, { id: msgId, role: "koraly", text: "", loading: true }]);
    return msgId;
  }

  function resolveMsg(msgId: string, text: string) {
    setMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, text, loading: false } : m))
    );
  }

  function announce(text: string) {
    setAnnouncement(text);
    if (voiceEnabled) {
      cancelSpeech();
      speak(text).catch((err) => console.warn("[poste] speak failed:", err));
    }
  }

  function resetHome() {
    setMode("home");
    setStep(null);
    setTrackingNumber("");
    setMailDraft({ content: "", recipientName: "", recipientAddress: null, addressSuggestions: [] });
    setLreDraft({ body: "", recipientName: "", recipientEmail: "" });
    setInputText("");
    prevTranscriptRef.current = "";
  }

  // ---------------------------------------------------------------------------
  // Gestion du mode TRACKING
  // ---------------------------------------------------------------------------

  function startTracking() {
    setMode("tracking");
    setStep("tracking_await_number");
    const text = "Quel est votre numéro de suivi ? Vous pouvez le dicter ou le saisir.";
    pushMsg("koraly", text);
    announce(text);
    setTimeout(() => inputRef.current?.focus(), 100);
  }

  async function doTracking(number: string) {
    const trimmed = number.trim().replace(/\s+/g, "");
    if (!trimmed) return;

    setTrackingNumber(trimmed);
    pushMsg("user", trimmed);
    setStep("tracking_loading");
    setBusy(true);
    const loadingId = pushLoadingMsg();
    announce("Je consulte le suivi de votre colis…");

    try {
      const res = await fetch(`/api/poste/tracking?id=${encodeURIComponent(trimmed)}`);
      const data = await res.json() as { tracking?: TrackingResult; error?: string };

      if (!res.ok || data.error) {
        const errText = data.error ?? "Suivi impossible. Vérifiez le numéro et réessayez.";
        resolveMsg(loadingId, errText);
        announce(errText);
        setStep("tracking_await_number");
      } else {
        const result = data.tracking!;
        const text = trackingStatusToText(result);
        resolveMsg(loadingId, text);
        announce(text);
        setStep("tracking_result");

        const followUp = "Voulez-vous suivre un autre colis ? Tapez un numéro ou dites « accueil » pour revenir.";
        pushMsg("koraly", followUp);
      }
    } catch (err) {
      console.error("[poste] tracking fetch failed:", err);
      const errText = "Erreur de connexion. Veuillez réessayer.";
      resolveMsg(loadingId, errText);
      announce(errText);
      setStep("tracking_await_number");
    } finally {
      setBusy(false);
      setInputText("");
      prevTranscriptRef.current = "";
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }

  // ---------------------------------------------------------------------------
  // Gestion du mode COURRIER (mail physique)
  // ---------------------------------------------------------------------------

  function startMail() {
    setMode("mail");
    setStep("mail_dictate");
    const text = "Dictez ou tapez le contenu de votre lettre. Je la mettrai en forme pour vous.";
    pushMsg("koraly", text);
    announce(text);
    setTimeout(() => inputRef.current?.focus(), 100);
  }

  async function doMailContent(content: string) {
    if (!content.trim()) return;
    pushMsg("user", content);
    setMailDraft((d) => ({ ...d, content: content.trim() }));

    setStep("mail_address");
    const text = "Très bien. Quel est le nom du destinataire ?";
    pushMsg("koraly", text);
    announce(text);
    setInputText("");
    prevTranscriptRef.current = "";
  }

  async function doMailRecipientName(name: string) {
    if (!name.trim()) return;
    pushMsg("user", name);
    setMailDraft((d) => ({ ...d, recipientName: name.trim() }));

    setStep("mail_address_loading");
    const text = "Quelle est l'adresse postale du destinataire ?";
    pushMsg("koraly", text);
    announce(text);
    setInputText("");
    prevTranscriptRef.current = "";
    setStep("mail_address");
  }

  async function doMailAddressSearch(query: string) {
    if (!query.trim()) return;
    pushMsg("user", query);
    setBusy(true);
    const loadingId = pushLoadingMsg();
    announce("Je recherche l'adresse…");

    try {
      const res = await fetch(`/api/poste/address?q=${encodeURIComponent(query.trim())}&limit=5`);
      const data = await res.json() as { addresses?: BanAddress[]; error?: string };

      if (!res.ok || !data.addresses?.length) {
        const errText = data.error ?? "Adresse introuvable. Essayez une formulation plus précise.";
        resolveMsg(loadingId, errText);
        announce(errText);
      } else {
        const addresses = data.addresses;
        setMailDraft((d) => ({ ...d, addressSuggestions: addresses, recipientAddress: addresses[0] }));

        const choiceText = addresses.length === 1
          ? `J'ai trouvé : ${addresses[0].label}. Est-ce correct ? Dites « oui » pour confirmer ou corrigez l'adresse.`
          : `J'ai trouvé ${addresses.length} adresses. La première est : ${addresses[0].label}. Dites « oui » pour confirmer, ou précisez votre adresse.`;

        resolveMsg(loadingId, choiceText);
        announce(choiceText);
        setStep("mail_confirm");
      }
    } catch (err) {
      console.error("[poste] address search failed:", err);
      const errText = "Erreur de connexion. Veuillez réessayer.";
      resolveMsg(loadingId, errText);
      announce(errText);
    } finally {
      setBusy(false);
      setInputText("");
      prevTranscriptRef.current = "";
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }

  async function doMailConfirm(response: string) {
    const r = response.trim().toLowerCase();
    const isYes = /^(oui|yes|ok|confirme|envoie|c['']est ça|correct|parfait|valide)/.test(r);

    if (!isYes) {
      // Traiter comme nouvelle recherche d'adresse
      pushMsg("user", response);
      setStep("mail_address");
      await doMailAddressSearch(response);
      return;
    }

    pushMsg("user", response);

    if (!mailDraft.recipientAddress) {
      const errText = "Adresse non confirmée. Veuillez préciser l'adresse postale.";
      pushMsg("koraly", errText);
      announce(errText);
      setStep("mail_address");
      return;
    }

    // Résumé avant envoi
    const addr = mailDraft.recipientAddress;
    const summary = `Je vais envoyer votre lettre à ${mailDraft.recipientName}, ${addr.label}. Confirmez-vous l'envoi ? Dites « envoyer » pour valider.`;
    pushMsg("koraly", summary);
    announce(summary);
    setStep("mail_sending");
    setInputText("");
    prevTranscriptRef.current = "";
  }

  async function doMailSend(response: string) {
    const r = response.trim().toLowerCase();
    const isConfirm = /^(envoyer|envoie|oui|yes|ok|confirme|valide|go)/.test(r);

    if (!isConfirm) {
      pushMsg("user", response);
      const cancelText = "Envoi annulé. Voulez-vous corriger quelque chose ? Dites « adresse » pour changer l'adresse ou « accueil » pour revenir.";
      pushMsg("koraly", cancelText);
      announce(cancelText);
      return;
    }

    pushMsg("user", response);
    setBusy(true);
    const loadingId = pushLoadingMsg();
    announce("Envoi de votre courrier en cours…");

    const addr = mailDraft.recipientAddress!;
    const citycode = addr.postcode + " " + addr.city;

    try {
      const res = await fetch("/api/poste/mail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `VoixPoste-${Date.now()}`,
          recipientName: mailDraft.recipientName,
          recipientAddress: {
            line1: mailDraft.recipientName,
            line4: addr.name,
            line6: citycode,
          },
          documentBase64: btoa(unescape(encodeURIComponent(
            `%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842]\n/Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >>\n/Contents 4 0 R >>\nendobj\n4 0 obj\n<< /Length ${mailDraft.content.length + 50} >>\nstream\nBT /F1 12 Tf 50 750 Td (${mailDraft.content.replace(/[()\\\\]/g, "")}) Tj ET\nendstream\nendobj\nxref\n0 5\ntrailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n%%EOF`
          ))),
        }),
      });
      const data = await res.json() as { sending?: MailSendingResult; error?: string };

      if (!res.ok || data.error) {
        const errText = data.error ?? "Envoi impossible. Vérifiez votre connexion et réessayez.";
        resolveMsg(loadingId, errText);
        announce(errText);
      } else {
        const sending = data.sending!;
        const doneText = `Votre courrier a été transmis avec succès (référence : ${sending.id}). Statut : ${sending.status}. Vous pouvez fermer ou faire un nouvel envoi.`;
        resolveMsg(loadingId, doneText);
        announce(doneText);
        setStep("mail_done");
      }
    } catch (err) {
      console.error("[poste] mail send failed:", err);
      const errText = "Erreur de connexion lors de l'envoi. Veuillez réessayer.";
      resolveMsg(loadingId, errText);
      announce(errText);
    } finally {
      setBusy(false);
      setInputText("");
      prevTranscriptRef.current = "";
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }

  // ---------------------------------------------------------------------------
  // Gestion du mode LRE (recommandé électronique)
  // ---------------------------------------------------------------------------

  function startLre() {
    setMode("lre");
    setStep("lre_dictate");
    const text = "Dictez ou tapez le contenu de votre recommandé électronique.";
    pushMsg("koraly", text);
    announce(text);
    setTimeout(() => inputRef.current?.focus(), 100);
  }

  async function doLreBody(body: string) {
    if (!body.trim()) return;
    pushMsg("user", body);
    setLreDraft((d) => ({ ...d, body: body.trim() }));

    setStep("lre_recipient_name");
    const text = "Quel est le nom complet du destinataire ?";
    pushMsg("koraly", text);
    announce(text);
    setInputText("");
    prevTranscriptRef.current = "";
  }

  async function doLreRecipientName(name: string) {
    if (!name.trim()) return;
    pushMsg("user", name);
    setLreDraft((d) => ({ ...d, recipientName: name.trim() }));

    setStep("lre_recipient_email");
    const text = "Quelle est l'adresse e-mail du destinataire pour le recommandé électronique ?";
    pushMsg("koraly", text);
    announce(text);
    setInputText("");
    prevTranscriptRef.current = "";
  }

  async function doLreRecipientEmail(email: string) {
    if (!email.trim()) return;
    pushMsg("user", email);

    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRe.test(email.trim())) {
      const errText = "L'adresse e-mail ne semble pas valide. Veuillez la saisir à nouveau.";
      pushMsg("koraly", errText);
      announce(errText);
      setInputText("");
      prevTranscriptRef.current = "";
      return;
    }

    setLreDraft((d) => ({ ...d, recipientEmail: email.trim() }));

    const summary = `Je vais envoyer un recommandé électronique à ${lreDraft.recipientName} (${email.trim()}). Confirmez-vous l'envoi ? Dites « envoyer » pour valider.`;
    pushMsg("koraly", summary);
    announce(summary);
    setStep("lre_confirm");
    setInputText("");
    prevTranscriptRef.current = "";
  }

  async function doLreSend(response: string) {
    const r = response.trim().toLowerCase();
    const isConfirm = /^(envoyer|envoie|oui|yes|ok|confirme|valide|go)/.test(r);

    if (!isConfirm) {
      pushMsg("user", response);
      const cancelText = "Envoi annulé. Dites « accueil » pour revenir ou corrigez vos informations.";
      pushMsg("koraly", cancelText);
      announce(cancelText);
      return;
    }

    pushMsg("user", response);
    setBusy(true);
    const loadingId = pushLoadingMsg();
    announce("Envoi du recommandé électronique en cours…");

    try {
      const res = await fetch("/api/poste/lre", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `VoixPoste-LRE-${Date.now()}`,
          senderEmail: "hello@coraly.fr",
          recipientEmail: lreDraft.recipientEmail,
          recipientName: lreDraft.recipientName,
          body: lreDraft.body,
        }),
      });
      const data = await res.json() as { sending?: LreSendingResult; error?: string };

      if (!res.ok || data.error) {
        const errText = data.error ?? "Envoi du recommandé électronique impossible. Réessayez.";
        resolveMsg(loadingId, errText);
        announce(errText);
      } else {
        const sending = data.sending!;
        const doneText = `Recommandé électronique transmis avec succès à ${lreDraft.recipientName} (référence : ${sending.id}). Statut : ${sending.status}.`;
        resolveMsg(loadingId, doneText);
        announce(doneText);
        setStep("lre_done");
      }
    } catch (err) {
      console.error("[poste] lre send failed:", err);
      const errText = "Erreur de connexion lors de l'envoi du recommandé. Veuillez réessayer.";
      resolveMsg(loadingId, errText);
      announce(errText);
    } finally {
      setBusy(false);
      setInputText("");
      prevTranscriptRef.current = "";
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }

  // ---------------------------------------------------------------------------
  // Dispatch principal
  // ---------------------------------------------------------------------------

  const handleSubmit = useCallback(
    async (query: string) => {
      const q = query.trim();
      if (!q || busy) return;

      setInputText("");
      prevTranscriptRef.current = "";

      // Commandes globales de navigation
      const ql = q.toLowerCase();
      if (/^(accueil|menu|retour|revenir|annuler|cancel|quitter|stop)/.test(ql)) {
        resetHome();
        const text = "Revenu à l'accueil. Que puis-je faire pour vous ?";
        pushMsg("user", q);
        pushMsg("koraly", text);
        announce(text);
        return;
      }

      // Mode HOME : sélection du service
      if (mode === "home") {
        pushMsg("user", q);
        if (/suivi|colis|paquet|livraison|suivre/.test(ql)) {
          startTracking();
        } else if (/courrier|lettre|envoyer|envoi|poster|physique/.test(ql)) {
          startMail();
        } else if (/recommandé|lre|électronique|recommande/.test(ql)) {
          startLre();
        } else if (q === "1") {
          startTracking();
        } else if (q === "2") {
          startMail();
        } else if (q === "3") {
          startLre();
        } else {
          const helpText = "Je n'ai pas compris. Dites « Suivre un colis », « Envoyer un courrier » ou « Recommandé électronique ». Vous pouvez aussi appuyer sur 1, 2 ou 3.";
          pushMsg("koraly", helpText);
          announce(helpText);
        }
        return;
      }

      // Mode TRACKING
      if (mode === "tracking") {
        if (step === "tracking_await_number" || step === "tracking_result") {
          await doTracking(q);
        }
        return;
      }

      // Mode MAIL
      if (mode === "mail") {
        if (step === "mail_dictate") {
          await doMailContent(q);
        } else if (step === "mail_address") {
          // Première entrée = nom destinataire (si pas encore saisi)
          if (!mailDraft.recipientName) {
            await doMailRecipientName(q);
          } else {
            await doMailAddressSearch(q);
          }
        } else if (step === "mail_confirm") {
          await doMailConfirm(q);
        } else if (step === "mail_sending") {
          await doMailSend(q);
        } else if (step === "mail_done") {
          resetHome();
          startMail();
        }
        return;
      }

      // Mode LRE
      if (mode === "lre") {
        if (step === "lre_dictate") {
          await doLreBody(q);
        } else if (step === "lre_recipient_name") {
          await doLreRecipientName(q);
        } else if (step === "lre_recipient_email") {
          await doLreRecipientEmail(q);
        } else if (step === "lre_confirm") {
          await doLreSend(q);
        } else if (step === "lre_done") {
          resetHome();
          startLre();
        }
        return;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [busy, mode, step, mailDraft, lreDraft, voiceEnabled]
  );

  function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    handleSubmit(inputText);
  }

  function toggleMic() {
    if (isListening) {
      stopListening();
    } else {
      cancelSpeech();
      setInputText("");
      startListening();
    }
  }

  // ---------------------------------------------------------------------------
  // Raccourcis clavier
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (typeof window === "undefined") return;

    function handler(e: KeyboardEvent) {
      if (helpOpen) return;
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      const target = e.target as HTMLElement | null;
      const inInput =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable;

      // V = micro (hors champ de saisie)
      if ((e.key === "v" || e.key === "V") && !inInput && isSupported) {
        e.preventDefault();
        toggleMic();
        return;
      }

      // Échap = stop parole / retour accueil
      if (e.key === "Escape") {
        cancelSpeech();
        if (isListening) stopListening();
        if (mode !== "home") {
          resetHome();
          const text = "Revenu à l'accueil.";
          setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "koraly", text }]);
          announce(text);
        }
        return;
      }

      // 1/2/3 pour sélection service depuis l'accueil (hors input)
      if (mode === "home" && !inInput) {
        if (e.key === "1") { e.preventDefault(); startTracking(); return; }
        if (e.key === "2") { e.preventDefault(); startMail(); return; }
        if (e.key === "3") { e.preventDefault(); startLre(); return; }
      }

      // Backspace dans un champ vide → accueil
      if (e.key === "Backspace" && inInput) {
        const inp = target as HTMLInputElement;
        if (inp.value === "") {
          if (mode !== "home") {
            resetHome();
          } else {
            router.push("/");
          }
        }
      }
    }

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [helpOpen, isSupported, isListening, mode, cancelSpeech, stopListening, router]);

  // ---------------------------------------------------------------------------
  // Placeholder selon le step
  // ---------------------------------------------------------------------------

  function inputPlaceholder(): string {
    if (isListening) return "Parlez maintenant…";
    if (mode === "home") return "Dites ce que vous voulez faire…";
    if (mode === "tracking") return "Numéro de suivi (ex: 6T12345678901)…";
    if (mode === "mail") {
      if (step === "mail_dictate") return "Dictez le contenu de votre lettre…";
      if (step === "mail_address" && !mailDraft.recipientName) return "Nom du destinataire…";
      if (step === "mail_address") return "Adresse postale (ex: 1 rue de Rivoli Paris)…";
      if (step === "mail_confirm") return "Dites « oui » pour confirmer…";
      if (step === "mail_sending") return "Dites « envoyer » pour confirmer l'envoi…";
    }
    if (mode === "lre") {
      if (step === "lre_dictate") return "Dictez le contenu de votre recommandé…";
      if (step === "lre_recipient_name") return "Nom complet du destinataire…";
      if (step === "lre_recipient_email") return "Adresse e-mail du destinataire…";
      if (step === "lre_confirm") return "Dites « envoyer » pour confirmer…";
    }
    return "Votre réponse…";
  }

  // ---------------------------------------------------------------------------
  // Rendu
  // ---------------------------------------------------------------------------

  return (
    <KoralyPageShell
      service="poste"
      announcement={announcement}
      onVoiceToggle={setVoiceEnabled}
      helpOpen={helpOpen}
      onHelpClose={() => setHelpOpen(false)}
      onHelpOpen={() => setHelpOpen(true)}
      mainClassName="flex flex-col min-h-screen px-4 py-8 max-w-2xl mx-auto"
    >
        <h1 className="vc-h1 mb-1">VoixPoste</h1>
        <p className="mb-4 text-sm" style={{ color: "var(--text-soft)" }}>
          La Poste par la voix — suivi de colis, courrier, recommandé électronique.
        </p>

        {/* Orbe Koraly */}
        <div
          className="flex flex-col items-center mb-6"
          role="region"
          aria-label="Statut de Koraly"
        >
          <KoralyOrb status={orbStatus} size={100} />
          <p
            className="mt-2 text-sm font-semibold"
            style={{ color: "var(--text-muted)" }}
            aria-hidden="true"
          >
            {isListening
              ? "Koraly vous écoute… parlez"
              : isSpeaking
              ? "Koraly répond…"
              : "Koraly est prête"}
          </p>
        </div>

        {/* Actions rapides — affichées uniquement sur l'accueil */}
        {mode === "home" && (
          <div
            role="group"
            aria-label="Services disponibles"
            className="flex flex-wrap gap-2 mb-6"
          >
            {HOME_ACTIONS.map(({ label, mode: m, key }) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  if (m === "tracking") startTracking();
                  else if (m === "mail") startMail();
                  else startLre();
                }}
                disabled={busy}
                className="text-sm px-4 py-2 rounded-xl font-medium"
                style={{
                  background: "var(--bg-surface)",
                  color: "var(--text-soft)",
                  border: "1px solid var(--border-hi)",
                  cursor: busy ? "not-allowed" : "pointer",
                  opacity: busy ? 0.5 : 1,
                }}
              >
                <span aria-hidden="true" className="mr-1 text-xs font-mono">{key}</span>
                {label}
              </button>
            ))}
          </div>
        )}

        {/* Breadcrumb de mode */}
        {mode !== "home" && (
          <div className="flex items-center gap-2 mb-4">
            <button
              type="button"
              onClick={() => {
                resetHome();
                const text = "Revenu à l'accueil.";
                setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "koraly", text }]);
              }}
              className="text-xs px-3 py-1 rounded-full"
              style={{
                background: "var(--bg-surface)",
                color: "var(--text-muted)",
                border: "1px solid var(--border)",
              }}
              aria-label="Retour à l'accueil VoixPoste"
            >
              ← Accueil
            </button>
            <span
              className="text-xs font-semibold px-3 py-1 rounded-full"
              style={{ background: "var(--accent)", color: "#fff" }}
            >
              {mode === "tracking"
                ? "Suivi colis"
                : mode === "mail"
                ? "Courrier physique"
                : "Recommandé électronique"}
            </span>
          </div>
        )}

        {/* Fil de conversation */}
        <section
          aria-label="Conversation avec Koraly"
          aria-live="polite"
          aria-relevant="additions"
          className="flex-1 flex flex-col gap-3 mb-6 overflow-y-auto"
          style={{ maxHeight: "40vh", minHeight: "200px", paddingBottom: "0.5rem" }}
        >
          {messages.map((msg) => (
            <KoralyMsgBubble key={msg.id} role={msg.role} text={msg.text} loading={msg.loading} />
          ))}
          <div ref={chatEndRef} aria-hidden="true" />
        </section>

        {/* Zone de saisie */}
        <form
          onSubmit={handleFormSubmit}
          aria-label="Répondre à Koraly"
          className="flex items-center gap-2"
        >
          <label htmlFor="poste-input" className="sr-only">
            Votre réponse à Koraly
          </label>
          <input
            ref={inputRef}
            id="poste-input"
            type="text"
            autoComplete="off"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={busy}
            placeholder={inputPlaceholder()}
            aria-label="Réponse à Koraly (VoixPoste)"
            className="flex-1 rounded-xl px-4 py-3 text-base border"
            style={{
              background: "var(--bg-surface)",
              color: "var(--text)",
              borderColor: isListening ? "var(--brass)" : "var(--border-hi)",
              outline: "none",
              boxShadow: isListening ? "0 0 0 3px rgba(181,136,66,0.3)" : undefined,
            }}
            onFocus={(e) =>
              (e.currentTarget.style.boxShadow = isListening
                ? "0 0 0 3px rgba(181,136,66,0.3)"
                : "0 0 0 3px var(--focus-ring)")
            }
            onBlur={(e) => (e.currentTarget.style.boxShadow = "")}
          />

          {/* Bouton micro */}
          {isSupported && (
            <button
              type="button"
              onClick={toggleMic}
              disabled={busy}
              aria-label={
                isListening
                  ? "Arrêter la reconnaissance vocale (raccourci V)"
                  : "Activer la reconnaissance vocale (raccourci V)"
              }
              aria-pressed={isListening}
              className="rounded-xl px-3 py-3 shrink-0"
              style={{
                background: isListening ? "var(--brass)" : "var(--bg-surface)",
                color: isListening ? "#fff" : "var(--text-soft)",
                border: "1px solid var(--border-hi)",
                cursor: busy ? "not-allowed" : "pointer",
                fontSize: "1.25rem",
                lineHeight: 1,
                opacity: busy ? 0.5 : 1,
              }}
            >
              🎤
            </button>
          )}

          {/* Bouton envoi */}
          <button
            type="submit"
            disabled={!inputText.trim() || busy}
            aria-label="Envoyer"
            className="rounded-xl px-4 py-3 font-semibold text-sm shrink-0"
            style={{
              background: inputText.trim() && !busy ? "var(--accent)" : "var(--bg-surface)",
              color: inputText.trim() && !busy ? "#fff" : "var(--text-muted)",
              border: inputText.trim() && !busy ? "none" : "1px solid var(--border-hi)",
              cursor: inputText.trim() && !busy ? "pointer" : "not-allowed",
            }}
          >
            Envoyer
          </button>
        </form>

        {/* Raccourcis */}
        <p
          className="mt-4 text-xs"
          style={{ color: "var(--text-muted)" }}
          aria-hidden="true"
        >
          Raccourcis :{" "}
          <kbd>1</kbd> Suivi ·{" "}
          <kbd>2</kbd> Courrier ·{" "}
          <kbd>3</kbd> LRE ·{" "}
          <kbd>V</kbd> micro ·{" "}
          <kbd>Échap</kbd> accueil
        </p>
    </KoralyPageShell>
  );
}
