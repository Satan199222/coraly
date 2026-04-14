"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { AccessibilityBar } from "@/components/accessibility-bar";
import { LiveRegion } from "@/components/live-region";
import { SiteHeader } from "@/components/site-header";
import { Footer } from "@/components/footer";
import { HelpDialog } from "@/components/help-dialog";
import { useSpeech } from "@/lib/speech/use-speech";
import { usePreferences, SPEECH_RATE_VALUE } from "@/lib/preferences/use-preferences";
import { useDocumentTitle } from "@/lib/useDocumentTitle";
import type {
  TransportStop,
  TransportJourney,
  TransportLeg,
} from "@/lib/transport/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0 && m > 0) return `${h}h${m.toString().padStart(2, "0")}`;
  if (h > 0) return `${h}h`;
  return `${m} min`;
}

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

function journeyToSpeech(journey: TransportJourney): string {
  const depart = formatTime(journey.departure);
  const arrivee = formatTime(journey.arrival);
  const duree = formatDuration(journey.totalDuration);
  const correspondances =
    journey.transfers === 0
      ? "sans correspondance"
      : `${journey.transfers} correspondance${journey.transfers > 1 ? "s" : ""}`;

  const lignes = journey.legs
    .filter((l): l is TransportLeg & { type: "transit" } => l.type === "transit")
    .map((l) => {
      const stops = l.stops?.length ? ` (${l.stops.length + 1} arrêts)` : "";
      return `${l.mode ?? "Ligne"} ${l.lineName ?? ""} direction ${l.direction ?? "inconnue"}${stops}`;
    })
    .join(", puis ");

  return `Départ à ${depart}, arrivée à ${arrivee}, durée ${duree}, ${correspondances}. ${lignes}`;
}

// ---------------------------------------------------------------------------
// Composant Autocomplete (combobox ARIA)
// ---------------------------------------------------------------------------

interface StopComboboxProps {
  id: string;
  label: string;
  value: string;
  selectedStop: TransportStop | null;
  onChange: (value: string) => void;
  onSelect: (stop: TransportStop) => void;
}

function StopCombobox({
  id,
  label,
  value,
  selectedStop,
  onChange,
  onSelect,
}: StopComboboxProps) {
  const listboxId = `${id}-listbox`;
  const [suggestions, setSuggestions] = useState<TransportStop[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Cherche les arrêts après 300ms de pause de frappe.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (value.length < 2 || selectedStop) {
      setSuggestions([]);
      setOpen(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/transport/stops?q=${encodeURIComponent(value)}`
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setSuggestions(data.stops ?? []);
        setOpen((data.stops ?? []).length > 0);
        setActiveIndex(-1);
      } catch (err) {
        console.warn("[transport] autocomplete failed:", err);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value, selectedStop]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      const stop = suggestions[activeIndex];
      if (stop) selectStop(stop);
    } else if (e.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
    }
  }

  function selectStop(stop: TransportStop) {
    onSelect(stop);
    setSuggestions([]);
    setOpen(false);
    setActiveIndex(-1);
  }

  return (
    <div className="relative w-full">
      <label
        htmlFor={id}
        className="block text-sm font-semibold mb-1"
        style={{ color: "var(--text-soft)" }}
      >
        {label}
      </label>
      <input
        ref={inputRef}
        id={id}
        type="text"
        autoComplete="off"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-activedescendant={
          activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined
        }
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="w-full rounded-lg px-4 py-3 text-base border"
        style={{
          background: "var(--bg-surface)",
          color: "var(--text)",
          borderColor: "var(--border-hi)",
          outline: "none",
        }}
        onFocus={(e) =>
          (e.currentTarget.style.boxShadow =
            "0 0 0 3px var(--focus-ring)")
        }
        onBlurCapture={(e) => (e.currentTarget.style.boxShadow = "")}
        placeholder={`Rechercher un arrêt ou une adresse…`}
        aria-label={`${label} — tapez au moins 2 caractères`}
      />
      {loading && (
        <span
          className="sr-only"
          aria-live="polite"
        >
          Recherche en cours…
        </span>
      )}
      {open && (
        <ul
          id={listboxId}
          role="listbox"
          aria-label={`Suggestions pour ${label}`}
          className="absolute left-0 right-0 z-20 mt-1 rounded-lg border shadow-lg overflow-hidden"
          style={{
            background: "var(--bg-card)",
            borderColor: "var(--border-hi)",
          }}
        >
          {suggestions.map((stop, i) => (
            <li
              key={stop.id}
              id={`${listboxId}-option-${i}`}
              role="option"
              aria-selected={i === activeIndex}
              onMouseDown={() => selectStop(stop)}
              className="px-4 py-3 cursor-pointer text-sm"
              style={{
                background:
                  i === activeIndex ? "var(--accent)" : undefined,
                color:
                  i === activeIndex ? "#fff" : "var(--text)",
              }}
            >
              <span className="font-medium">{stop.name}</span>
              {stop.label !== stop.name && (
                <span
                  className="block text-xs mt-0.5"
                  style={{
                    color:
                      i === activeIndex
                        ? "rgba(255,255,255,0.75)"
                        : "var(--text-muted)",
                  }}
                >
                  {stop.label}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Composant carte d'itinéraire
// ---------------------------------------------------------------------------

interface JourneyCardProps {
  journey: TransportJourney;
  index: number;
  onRead: (text: string) => void;
}

function JourneyCard({ journey, index, onRead }: JourneyCardProps) {
  const transitLegs = journey.legs.filter((l) => l.type === "transit");

  return (
    <article
      aria-label={`Itinéraire ${index + 1} — ${formatDuration(journey.totalDuration)}, départ ${formatTime(journey.departure)}`}
      className="rounded-xl border p-5"
      style={{
        background: "var(--bg-card)",
        borderColor: "var(--border)",
      }}
    >
      {/* En-tête résumé */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <span
            className="text-2xl font-bold"
            style={{ color: "var(--text)" }}
          >
            {formatDuration(journey.totalDuration)}
          </span>
          <span
            className="ml-3 text-sm"
            style={{ color: "var(--text-muted)" }}
          >
            {formatTime(journey.departure)} → {formatTime(journey.arrival)}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {journey.transfers === 0 ? (
            <span
              className="text-xs font-semibold px-2 py-1 rounded-full"
              style={{
                background: "var(--success)",
                color: "#fff",
              }}
            >
              Direct
            </span>
          ) : (
            <span
              className="text-xs font-semibold px-2 py-1 rounded-full"
              style={{
                background: "var(--bg-surface)",
                color: "var(--text-soft)",
                border: "1px solid var(--border-hi)",
              }}
            >
              {journey.transfers} correspondance
              {journey.transfers > 1 ? "s" : ""}
            </span>
          )}
          <button
            type="button"
            onClick={() => onRead(journeyToSpeech(journey))}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg"
            style={{
              background: "var(--accent)",
              color: "#fff",
              cursor: "pointer",
            }}
            aria-label={`Lire l'itinéraire ${index + 1} à voix haute`}
          >
            Lire
          </button>
        </div>
      </div>

      {/* Étapes */}
      {transitLegs.length > 0 && (
        <ol
          aria-label="Étapes du trajet"
          className="mt-4 space-y-2"
        >
          {journey.legs.map((leg, i) => (
            <li key={i} className="flex items-start gap-3 text-sm">
              {leg.type === "transit" ? (
                <>
                  <span
                    className="mt-0.5 w-7 h-5 flex items-center justify-center rounded text-xs font-bold shrink-0"
                    style={{
                      background: leg.lineColor ?? "var(--accent)",
                      color: "#fff",
                    }}
                    aria-hidden="true"
                  >
                    {leg.lineName ?? "?"}
                  </span>
                  <span style={{ color: "var(--text)" }}>
                    <span className="font-medium">
                      {leg.mode ?? "Transport"} {leg.lineName}
                    </span>
                    {leg.direction && (
                      <span style={{ color: "var(--text-soft)" }}>
                        {" "}→ {leg.direction}
                      </span>
                    )}
                    {leg.stops && leg.stops.length > 0 && (
                      <span style={{ color: "var(--text-muted)" }}>
                        {" "}({leg.stops.length + 1} arrêts,{" "}
                        {formatDuration(leg.duration)})
                      </span>
                    )}
                  </span>
                </>
              ) : leg.type === "walk" ? (
                <>
                  <span
                    className="mt-0.5 w-7 text-center shrink-0 text-base"
                    aria-hidden="true"
                  >
                    🚶
                  </span>
                  <span style={{ color: "var(--text-soft)" }}>
                    À pied — {formatDuration(leg.duration)}
                    {leg.to && (
                      <span style={{ color: "var(--text-muted)" }}>
                        {" "}jusqu'à {leg.to}
                      </span>
                    )}
                  </span>
                </>
              ) : (
                <span
                  className="text-xs italic"
                  style={{ color: "var(--text-muted)" }}
                >
                  Attente — {formatDuration(leg.duration)}
                </span>
              )}
            </li>
          ))}
        </ol>
      )}

      {journey.fare && (
        <p
          className="mt-3 text-xs"
          style={{ color: "var(--text-muted)" }}
        >
          Tarif indicatif : {journey.fare.amount} {journey.fare.currency}
        </p>
      )}
    </article>
  );
}

// ---------------------------------------------------------------------------
// Page principale
// ---------------------------------------------------------------------------

export default function TransportPage() {
  useDocumentTitle("VoixTransport — Itinéraires accessibles par la voix");

  const { prefs } = usePreferences();
  const { speak, cancelSpeech } = useSpeech({
    rate: SPEECH_RATE_VALUE[prefs.speechRate],
    lang: prefs.speechLocale,
    premiumVoice: prefs.premiumVoice,
  });

  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [helpOpen, setHelpOpen] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  // Inputs
  const fromId = useId();
  const toId = useId();
  const [fromText, setFromText] = useState("");
  const [toText, setToText] = useState("");
  const [fromStop, setFromStop] = useState<TransportStop | null>(null);
  const [toStop, setToStop] = useState<TransportStop | null>(null);

  // Résultats
  const [journeys, setJourneys] = useState<TransportJourney[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Réinitialise le stop sélectionné si l'utilisateur modifie le texte
  function handleFromChange(text: string) {
    setFromText(text);
    if (fromStop && text !== fromStop.name) setFromStop(null);
  }
  function handleToChange(text: string) {
    setToText(text);
    if (toStop && text !== toStop.name) setToStop(null);
  }

  function handleFromSelect(stop: TransportStop) {
    setFromStop(stop);
    setFromText(stop.name);
  }
  function handleToSelect(stop: TransportStop) {
    setToStop(stop);
    setToText(stop.name);
  }

  function swapStops() {
    setFromText(toText);
    setToText(fromText);
    setFromStop(toStop);
    setToStop(fromStop);
  }

  const searchJourneys = useCallback(async () => {
    if (!fromStop || !toStop) return;

    setLoading(true);
    setError(null);
    setJourneys([]);
    setAnnouncement("Calcul de l'itinéraire en cours…");

    try {
      const res = await fetch(
        `/api/transport/journey?from=${encodeURIComponent(fromStop.id)}&to=${encodeURIComponent(toStop.id)}`
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          (data as { error?: string }).error ?? `HTTP ${res.status}`
        );
      }
      const data = await res.json();
      const results: TransportJourney[] = data.journeys ?? [];
      setJourneys(results);

      if (results.length === 0) {
        setAnnouncement("Aucun itinéraire trouvé pour ce trajet.");
      } else {
        const count = results.length;
        setAnnouncement(
          `${count} itinéraire${count > 1 ? "s" : ""} trouvé${count > 1 ? "s" : ""}. Le plus rapide : ${formatDuration(results[0].totalDuration)}, départ à ${formatTime(results[0].departure)}.`
        );
        // Focus les résultats
        setTimeout(
          () => resultsRef.current?.focus(),
          100
        );
      }
    } catch (err) {
      console.error("[transport] searchJourneys failed:", err);
      const msg =
        err instanceof Error ? err.message : "Erreur inconnue.";
      setError(msg);
      setAnnouncement(`Erreur : ${msg}`);
    } finally {
      setLoading(false);
    }
  }, [fromStop, toStop]);

  // Soumission via Entrée dans les champs
  function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (fromStop && toStop) {
      searchJourneys();
    }
  }

  function readJourney(text: string) {
    if (!voiceEnabled) return;
    cancelSpeech();
    speak(text).catch((err) =>
      console.warn("[transport] speak failed:", err)
    );
  }

  const canSearch = Boolean(fromStop && toStop);

  return (
    <>
      <AccessibilityBar
        onVoiceToggle={setVoiceEnabled}
        onHelpRequest={() => setHelpOpen(true)}
      />

      <LiveRegion message={announcement} />

      <SiteHeader />

      <main
        id="main"
        tabIndex={-1}
        className="min-h-screen px-4 py-10 max-w-2xl mx-auto"
        style={{ outline: "none" }}
      >
        <h1 className="vc-h1 mb-2">
          VoixTransport
        </h1>
        <p
          className="mb-8 text-base"
          style={{ color: "var(--text-soft)" }}
        >
          Calculez votre itinéraire en transports en commun, accessible par la voix.
        </p>

        {/* Formulaire de recherche */}
        <form
          onSubmit={handleFormSubmit}
          aria-label="Recherche d'itinéraire"
          className="space-y-4"
          noValidate
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="flex-1">
              <StopCombobox
                id={fromId}
                label="Départ"
                value={fromText}
                selectedStop={fromStop}
                onChange={handleFromChange}
                onSelect={handleFromSelect}
              />
            </div>

            <button
              type="button"
              onClick={swapStops}
              aria-label="Inverser départ et arrivée"
              className="px-3 py-2 rounded-lg text-xl shrink-0 self-end sm:self-auto sm:mb-0"
              style={{
                background: "var(--bg-surface)",
                color: "var(--text-soft)",
                border: "1px solid var(--border-hi)",
                cursor: "pointer",
                lineHeight: 1,
              }}
            >
              ⇅
            </button>

            <div className="flex-1">
              <StopCombobox
                id={toId}
                label="Arrivée"
                value={toText}
                selectedStop={toStop}
                onChange={handleToChange}
                onSelect={handleToSelect}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={!canSearch || loading}
            aria-busy={loading}
            className="w-full py-3 rounded-xl font-semibold text-base"
            style={{
              background: canSearch ? "var(--accent)" : "var(--bg-surface)",
              color: canSearch ? "#fff" : "var(--text-muted)",
              border: canSearch
                ? "none"
                : "1px solid var(--border-hi)",
              cursor: canSearch && !loading ? "pointer" : "not-allowed",
              transition: "background 0.2s",
            }}
          >
            {loading ? "Calcul en cours…" : "Calculer l'itinéraire"}
          </button>
        </form>

        {/* Erreur */}
        {error && (
          <div
            role="alert"
            className="mt-6 rounded-xl p-4 text-sm"
            style={{
              background: "color-mix(in srgb, var(--danger) 10%, transparent)",
              color: "var(--danger)",
              border: "1px solid var(--danger)",
            }}
          >
            {error}
          </div>
        )}

        {/* Résultats */}
        {journeys.length > 0 && (
          <section
            aria-label={`${journeys.length} itinéraire${journeys.length > 1 ? "s" : ""} trouvé${journeys.length > 1 ? "s" : ""}`}
            ref={resultsRef}
            tabIndex={-1}
            className="mt-8 space-y-4"
            style={{ outline: "none" }}
          >
            <h2
              className="vc-h2 mb-4"
              id="results-heading"
            >
              {journeys.length} itinéraire
              {journeys.length > 1 ? "s" : ""} trouvé
              {journeys.length > 1 ? "s" : ""}
            </h2>
            {journeys.map((journey, i) => (
              <JourneyCard
                key={journey.id}
                journey={journey}
                index={i}
                onRead={readJourney}
              />
            ))}
          </section>
        )}

        {/* État initial — invitation */}
        {!loading && journeys.length === 0 && !error && (
          <div
            className="mt-12 text-center text-base"
            style={{ color: "var(--text-muted)" }}
            aria-hidden="true"
          >
            Entrez un départ et une arrivée pour calculer votre itinéraire.
          </div>
        )}
      </main>

      <Footer />

      <HelpDialog
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
      />
    </>
  );
}
