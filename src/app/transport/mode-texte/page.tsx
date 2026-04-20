"use client";

/**
 * VoixTransport — Page /transport
 * Interface conversationnelle Koraly pour les transports en commun IdF.
 *
 * Fonctionnalités :
 * - Koraly répond en langage naturel aux questions transport
 * - Exemples : "Prochain RER A à Nation ?", "Perturbations ligne 13 ?"
 * - Orchestration PRIM/IDFM + SNCF par détection d'intention
 * - Raccourcis vocaux (V = micro, Échap = stop)
 * - WCAG AAA, police Luciole, design system marine
 *
 * Limite V1 : bus urbains hors IdF non couverts.
 * GROA-232 — Phase 2b VoixTransport
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
import { KoralyChatInput } from "@/lib/shared/components/koraly-chat-input";
import { KoralyOrb } from "@/lib/shared/components/koraly-orb";
import type { KoralyOrbStatus } from "@/lib/shared/components/koraly-orb";
import { useSpeech } from "@/lib/shared/speech/use-speech";
import { usePreferences, SPEECH_RATE_VALUE } from "@/lib/preferences/use-preferences";
import { useDocumentTitle } from "@/lib/useDocumentTitle";
import type {
  TransportDeparture,
  TransportDisruption,
  TrainDeparture,
  TransportJourney,
  TransportStop,
  TransportLineInfo,
} from "@/lib/transport/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type KoralyIntent =
  | { type: "departures_idfm"; stopQuery: string; lineFilter?: string }
  | { type: "departures_sncf"; stationQuery: string }
  | { type: "disruptions"; lineQuery: string }
  | { type: "journey"; fromQuery: string; toQuery: string }
  | { type: "unknown"; originalQuery: string };

interface ChatMsg {
  id: string;
  role: "user" | "koraly";
  text: string;
  loading?: boolean;
}

// ---------------------------------------------------------------------------
// Intent parser — détection d'intention en français
// ---------------------------------------------------------------------------

function parseIntent(query: string): KoralyIntent {
  const q = query.trim();
  const ql = q.toLowerCase();

  // Itinéraire A→B
  const journeyRx =
    /(?:aller|itinéraire|trajet|comment aller|chemin|route)\s+(?:de\s+)?(.+?)\s+(?:à|vers|pour|jusqu[''à]+)\s+(.+?)[\s?!.]*$/i;
  const jm = ql.match(journeyRx);
  if (jm) {
    return { type: "journey", fromQuery: jm[1].trim(), toQuery: jm[2].trim() };
  }

  // Perturbations / infos trafic
  const disruptRx =
    /(?:perturbation[s]?|problème[s]?|incident[s]?|travaux|info[s]? trafic|alerte[s]?|retard[s]?)\s+(?:sur\s+)?(?:la\s+|le\s+|l[''a]?\s+)?(?:ligne\s+)?([a-z0-9\s+]+?)[\s?!.]*$/i;
  const dm = ql.match(disruptRx);
  if (dm) {
    return { type: "disruptions", lineQuery: dm[1].trim() };
  }
  // Aussi : "y a-t-il des perturbations sur le RER B"
  const disruptRx2 =
    /(?:perturbation[s]?|problème[s]?)\s+(?:sur|pour|ligne)\s+(.+?)[\s?!.]*$/i;
  const dm2 = ql.match(disruptRx2);
  if (dm2) {
    return { type: "disruptions", lineQuery: dm2[1].trim() };
  }

  // Trains longue distance SNCF
  if (/\b(tgv|ter|ouigo|intercités|intercites|grandes lignes|eurostar|thalys|inoui)\b/i.test(ql)) {
    const trainRx = /(?:depuis|de|gare\s+de|station\s+de|à)\s+(.+?)(?:\s+vers|\s+pour|\s+direction|\?|!|\.|$)/i;
    const tm = ql.match(trainRx);
    return { type: "departures_sncf", stationQuery: tm?.[1]?.trim() ?? q };
  }

  // Départs IDFM — "Prochain [ligne] à [arrêt]" ou "Bus X à [arrêt]"
  const depRx =
    /(?:prochain[se]?|passage[s]?|départ[s]?|bus|métro|rer|tram(?:way)?|t\d|ligne)\s+([a-z0-9+]+(?:\s+[a-z0-9]+)?)\s+(?:à|au|aux|en direction|depuis|station|stop)\s+(.+?)[\s?!.]*$/i;
  const depm = ql.match(depRx);
  if (depm) {
    return {
      type: "departures_idfm",
      lineFilter: depm[1].trim(),
      stopQuery: depm[2].trim(),
    };
  }

  // Départs sans ligne : "Prochains passages à Nation"
  const depRx2 =
    /(?:prochain[se]?|passage[s]?|départ[s]?|quand passe)\s+(?:le\s+|les\s+)?(?:prochain[es]?\s+)?(?:(?:métro|bus|rer|tram)\s+)?(?:à|au|à la|station|arrêt)\s+(.+?)[\s?!.]*$/i;
  const depm2 = ql.match(depRx2);
  if (depm2) {
    return { type: "departures_idfm", stopQuery: depm2[1].trim() };
  }

  // Arrêt simple mentionné après "à" ou en fin de phrase (ex: "Nation ?")
  // Heuristique : si ≤ 4 mots et ressemble à un arrêt connu
  const words = q.split(/\s+/);
  if (words.length <= 5 && !ql.match(/^(?:aide|help|bonjour|merci|salut)/)) {
    return { type: "departures_idfm", stopQuery: q.replace(/[?!.]+$/, "").trim() };
  }

  return { type: "unknown", originalQuery: q };
}

// ---------------------------------------------------------------------------
// Helpers de formatage oral
// ---------------------------------------------------------------------------

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function delayInMinutes(expectedISO: string): number {
  return Math.round((new Date(expectedISO).getTime() - Date.now()) / 60_000);
}

function departureToText(dep: TransportDeparture): string {
  const inMin = delayInMinutes(dep.expectedTime);
  const timeStr =
    inMin <= 0 ? "maintenant" : inMin === 1 ? "dans 1 minute" : `dans ${inMin} minutes`;
  return `${dep.mode} ${dep.lineName} direction ${dep.direction} — ${timeStr}`;
}

function trainDepartureToText(dep: TrainDeparture): string {
  const time = formatTime(dep.expectedTime);
  const delayTxt = dep.delay > 60 ? ` (retard ${Math.round(dep.delay / 60)} min)` : "";
  return `${dep.trainNumber} vers ${dep.direction} à ${time}${delayTxt}${dep.platform ? `, voie ${dep.platform}` : ""}`;
}

function disruptionToText(d: TransportDisruption): string {
  const sev =
    d.severity === "blocking"
      ? "Trafic bloqué"
      : d.severity === "significant_delays"
      ? "Retards importants"
      : d.severity === "reduced_service"
      ? "Service réduit"
      : "Information";
  return `${sev} — ${d.title || d.message}`;
}

function journeyToSpeech(journey: TransportJourney): string {
  const dur = Math.round(journey.totalDuration / 60);
  const dep = formatTime(journey.departure);
  const arr = formatTime(journey.arrival);
  const transf =
    journey.transfers === 0
      ? "sans correspondance"
      : `${journey.transfers} correspondance${journey.transfers > 1 ? "s" : ""}`;
  return `Départ à ${dep}, arrivée à ${arr}, ${dur} minutes, ${transf}.`;
}

// ---------------------------------------------------------------------------
// Orchestrateur Koraly — appels API + formatage réponse
// ---------------------------------------------------------------------------

async function fetchStops(q: string): Promise<TransportStop[]> {
  const res = await fetch(`/api/transport/stops?q=${encodeURIComponent(q)}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return (data as { stops: TransportStop[] }).stops ?? [];
}

async function fetchLines(q: string): Promise<TransportLineInfo[]> {
  const res = await fetch(`/api/transport/idfm/lines?q=${encodeURIComponent(q)}`);
  if (!res.ok) return [];
  const data = await res.json();
  return (data as { lines: TransportLineInfo[] }).lines ?? [];
}

async function handleIntent(intent: KoralyIntent): Promise<string> {
  switch (intent.type) {
    // ------------------------------------------------------------------
    // Départs IDFM
    // ------------------------------------------------------------------
    case "departures_idfm": {
      const stops = await fetchStops(intent.stopQuery);
      if (stops.length === 0) {
        return `Je n'ai pas trouvé l'arrêt « ${intent.stopQuery} ». Essayez un nom plus précis, par exemple « Châtelet - Les Halles » ou « Nation ».`;
      }
      const stop = stops[0];
      const res = await fetch(
        `/api/transport/idfm/departures?stop_id=${encodeURIComponent(stop.id)}&count=6`
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      let departures: TransportDeparture[] = (data as { departures: TransportDeparture[] }).departures ?? [];

      // Filtrer par ligne si demandé
      if (intent.lineFilter) {
        const lf = intent.lineFilter.toLowerCase();
        const filtered = departures.filter(
          (d) =>
            d.lineName.toLowerCase().includes(lf) ||
            d.lineCode.toLowerCase().includes(lf) ||
            d.mode.toLowerCase().includes(lf)
        );
        if (filtered.length > 0) departures = filtered;
      }

      if (departures.length === 0) {
        return `Aucun départ trouvé à « ${stop.name} » pour le moment.`;
      }

      const lines = departures
        .slice(0, 4)
        .map(departureToText)
        .join(". ");
      return `À ${stop.name} : ${lines}.`;
    }

    // ------------------------------------------------------------------
    // Départs SNCF
    // ------------------------------------------------------------------
    case "departures_sncf": {
      const stops = await fetchStops(intent.stationQuery);
      const sncfStop = stops.find(
        (s) => s.id.includes("SNCF") || s.label?.toLowerCase().includes("gare")
      ) ?? stops[0];
      if (!sncfStop) {
        return `Je n'ai pas trouvé la gare « ${intent.stationQuery} ». Essayez le nom complet, ex: « Paris Gare de Lyon ».`;
      }
      const res = await fetch(
        `/api/transport/sncf/departures?stop_id=${encodeURIComponent(sncfStop.id)}&count=5`
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      const departures: TrainDeparture[] = (data as { departures: TrainDeparture[] }).departures ?? [];

      if (departures.length === 0) {
        return `Aucun départ de train trouvé depuis « ${sncfStop.name} » pour le moment.`;
      }

      const lines = departures
        .slice(0, 4)
        .map(trainDepartureToText)
        .join(". ");
      return `Depuis ${sncfStop.name} : ${lines}.`;
    }

    // ------------------------------------------------------------------
    // Perturbations
    // ------------------------------------------------------------------
    case "disruptions": {
      const lines = await fetchLines(intent.lineQuery);
      if (lines.length === 0) {
        return `Je n'ai pas trouvé la ligne « ${intent.lineQuery} » dans le réseau Île-de-France. Essayez « Métro 13 », « RER A », « Tramway 3b »…`;
      }
      const line = lines[0];
      const res = await fetch(
        `/api/transport/idfm/disruptions?line_id=${encodeURIComponent(line.id)}`
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      const disruptions: TransportDisruption[] = (data as { disruptions: TransportDisruption[] }).disruptions ?? [];

      if (disruptions.length === 0) {
        return `Bonne nouvelle ! Aucune perturbation active sur ${line.mode} ${line.code} (${line.name}).`;
      }

      const active = disruptions.filter((d) => d.status === "active");
      const future = disruptions.filter((d) => d.status === "future");
      let reply = `${line.mode} ${line.code} — `;

      if (active.length > 0) {
        reply += `${active.length} perturbation${active.length > 1 ? "s" : ""} en cours : `;
        reply += active
          .slice(0, 2)
          .map(disruptionToText)
          .join(". ");
        reply += ".";
      }
      if (future.length > 0) {
        reply += ` Et ${future.length} perturbation${future.length > 1 ? "s" : ""} à venir.`;
      }
      return reply;
    }

    // ------------------------------------------------------------------
    // Itinéraire A→B
    // ------------------------------------------------------------------
    case "journey": {
      const [fromStops, toStops] = await Promise.all([
        fetchStops(intent.fromQuery),
        fetchStops(intent.toQuery),
      ]);
      if (fromStops.length === 0) {
        return `Je n'ai pas trouvé le point de départ « ${intent.fromQuery} ». Précisez le nom de l'arrêt ou de l'adresse.`;
      }
      if (toStops.length === 0) {
        return `Je n'ai pas trouvé la destination « ${intent.toQuery} ». Précisez le nom de l'arrêt ou de l'adresse.`;
      }
      const from = fromStops[0];
      const to = toStops[0];
      const res = await fetch(
        `/api/transport/journey?from=${encodeURIComponent(from.id)}&to=${encodeURIComponent(to.id)}`
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      const journeys: TransportJourney[] = (data as { journeys: TransportJourney[] }).journeys ?? [];

      if (journeys.length === 0) {
        return `Aucun itinéraire trouvé de « ${from.name} » vers « ${to.name} ».`;
      }

      const best = journeys[0];
      const others =
        journeys.length > 1
          ? ` Il y a aussi ${journeys.length - 1} autre${journeys.length > 2 ? "s" : ""} itinéraire${journeys.length > 2 ? "s" : ""}.`
          : "";
      return `De ${from.name} à ${to.name} — ${journeyToSpeech(best)}${others}`;
    }

    // ------------------------------------------------------------------
    // Intent inconnu
    // ------------------------------------------------------------------
    case "unknown":
      return `Je n'ai pas compris votre demande « ${intent.originalQuery} ». Essayez par exemple : « Prochain RER A à Nation », « Perturbations ligne 13 », ou « Aller de Châtelet à La Défense ».`;
  }
}

// ---------------------------------------------------------------------------
// Composant message
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Suggestions rapides
// ---------------------------------------------------------------------------

const SUGGESTIONS = [
  "Prochain RER A à Nation",
  "Perturbations ligne 13",
  "Bus 91 à Denfert-Rochereau",
  "Aller de Châtelet à La Défense",
  "Perturbations RER B",
  "Prochains trains Gare de Lyon",
];

// ---------------------------------------------------------------------------
// Page principale
// ---------------------------------------------------------------------------

export default function TransportPage() {
  useDocumentTitle("VoixTransport — Transports en commun par la voix");

  const router = useRouter();
  const { prefs } = usePreferences();
  const { speak, cancelSpeech, startListening, stopListening, transcript, isListening, isSpeaking, isSupported } =
    useSpeech({
      rate: SPEECH_RATE_VALUE[prefs.speechRate],
      lang: prefs.speechLocale,
      premiumVoice: prefs.premiumVoice,
    });

  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [helpOpen, setHelpOpen] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      id: "welcome",
      role: "koraly",
      text: "Bonjour ! Je suis Koraly. Posez-moi une question sur les transports en commun d'Île-de-France. Par exemple : « Prochain RER A à Nation ? » ou « Perturbations ligne 13 ? »",
    },
  ]);
  const [inputText, setInputText] = useState("");
  const [busy, setBusy] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const prevTranscriptRef = useRef("");

  // Scroll en bas du chat à chaque nouveau message
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Quand la reconnaissance vocale produit un transcript, l'injecter dans l'input
  useEffect(() => {
    if (transcript && transcript !== prevTranscriptRef.current) {
      prevTranscriptRef.current = transcript;
      setInputText(transcript);
    }
  }, [transcript]);

  // Quand la reconnaissance s'arrête avec un transcript valide → soumettre
  useEffect(() => {
    if (!isListening && inputText.trim() && inputText === transcript) {
      submitQuery(inputText);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isListening]);

  // Statut orbe Koraly
  const orbStatus: KoralyOrbStatus = isListening
    ? "listening"
    : isSpeaking
    ? "speaking"
    : "idle";

  // ---------------------------------------------------------------------------
  // Soumission d'une requête
  // ---------------------------------------------------------------------------

  const submitQuery = useCallback(
    async (query: string) => {
      const q = query.trim();
      if (!q || busy) return;

      const userMsgId = crypto.randomUUID();
      const koralyMsgId = crypto.randomUUID();

      setMessages((prev) => [
        ...prev,
        { id: userMsgId, role: "user", text: q },
        { id: koralyMsgId, role: "koraly", text: "", loading: true },
      ]);
      setInputText("");
      prevTranscriptRef.current = "";
      setBusy(true);
      setAnnouncement("Koraly réfléchit…");

      try {
        const intent = parseIntent(q);
        const answer = await handleIntent(intent);

        setMessages((prev) =>
          prev.map((m) =>
            m.id === koralyMsgId ? { ...m, text: answer, loading: false } : m
          )
        );
        setAnnouncement(answer);

        if (voiceEnabled) {
          cancelSpeech();
          speak(answer).catch((err) =>
            console.warn("[transport] speak failed:", err)
          );
        }
      } catch (err) {
        console.error("[transport] handleIntent failed:", err);
        const errText =
          "Une erreur s'est produite lors de la recherche. Veuillez réessayer.";
        setMessages((prev) =>
          prev.map((m) =>
            m.id === koralyMsgId
              ? { ...m, text: errText, loading: false }
              : m
          )
        );
        setAnnouncement(errText);
      } finally {
        setBusy(false);
        // Redonner le focus au champ de saisie
        setTimeout(() => inputRef.current?.focus(), 100);
      }
    },
    [busy, voiceEnabled, speak, cancelSpeech]
  );

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

      // V = micro (seulement hors champ de saisie)
      if ((e.key === "v" || e.key === "V") && !inInput && isSupported) {
        e.preventDefault();
        toggleMic();
        return;
      }

      // Échap = stop parole
      if (e.key === "Escape") {
        cancelSpeech();
        if (isListening) stopListening();
        return;
      }

      // Navigation : Retour arrière depuis le champ → page précédente si vide
      if (e.key === "Backspace" && inInput) {
        const inp = target as HTMLInputElement;
        if (inp.value === "") {
          router.push("/");
        }
      }
    }

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [helpOpen, isSupported, isListening, cancelSpeech, stopListening, router, toggleMic]);

  return (
    <KoralyPageShell
      service="transport"
      announcement={announcement}
      onVoiceToggle={setVoiceEnabled}
      helpOpen={helpOpen}
      onHelpClose={() => setHelpOpen(false)}
      onHelpOpen={() => setHelpOpen(true)}
      mainClassName="flex flex-col min-h-screen px-4 py-8 max-w-2xl mx-auto"
    >
        <h1 className="vc-h1 mb-1">VoixTransport</h1>
        <p
          className="mb-6 text-sm"
          style={{ color: "var(--text-soft)" }}
        >
          Transports en commun Île-de-France — consultez par la voix ou par écrit.
        </p>

        {/* Koraly orb + état */}
        <div
          className="flex flex-col items-center mb-6"
          role="region"
          aria-label="Statut de Koraly"
        >
          <KoralyOrb status={orbStatus} size={120} />
          <p
            className="mt-3 text-sm font-semibold"
            style={{ color: "var(--text-muted)" }}
            aria-hidden="true"
          >
            {isListening
              ? "Koraly vous écoute… parlez maintenant"
              : isSpeaking
              ? "Koraly répond…"
              : "Koraly est prête"}
          </p>
        </div>

        {/* Suggestions rapides */}
        <div
          role="group"
          aria-label="Exemples de questions"
          className="flex flex-wrap gap-2 mb-6"
        >
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => submitQuery(s)}
              disabled={busy}
              className="text-xs px-3 py-1.5 rounded-full font-medium"
              style={{
                background: "var(--bg-surface)",
                color: "var(--text-soft)",
                border: "1px solid var(--border-hi)",
                cursor: busy ? "not-allowed" : "pointer",
                opacity: busy ? 0.5 : 1,
              }}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Fil de conversation */}
        <section
          aria-label="Conversation avec Koraly"
          aria-live="polite"
          aria-relevant="additions"
          className="flex-1 flex flex-col gap-3 mb-6 min-h-[200px] overflow-y-auto"
          style={{
            maxHeight: "40vh",
            paddingBottom: "0.5rem",
          }}
        >
          {messages.map((msg) => (
            <KoralyMsgBubble key={msg.id} role={msg.role} text={msg.text} loading={msg.loading} />
          ))}
          <div ref={chatEndRef} aria-hidden="true" />
        </section>

        {/* Zone de saisie */}
        <KoralyChatInput
          inputId="koraly-input"
          inputLabel="Question à Koraly — ex: Prochain RER A à Nation"
          formLabel="Poser une question à Koraly"
          placeholder="Posez votre question…"
          value={inputText}
          onChange={setInputText}
          onSubmit={() => submitQuery(inputText)}
          onMicToggle={toggleMic}
          isListening={isListening}
          isSupported={isSupported}
          busy={busy}
        />

        {/* Légende raccourcis */}
        <p
          className="mt-4 text-xs"
          style={{ color: "var(--text-muted)" }}
          aria-hidden="true"
        >
          Raccourcis :{" "}
          <kbd>V</kbd> = micro ·{" "}
          <kbd>Échap</kbd> = stop · Limite V1 : bus hors IdF non couverts
        </p>
    </KoralyPageShell>
  );
}
