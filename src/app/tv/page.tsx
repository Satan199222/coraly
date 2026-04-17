"use client";

/**
 * VoixTV — Page /tv
 * Interface vocale pour consulter les programmes du soir à la télé.
 *
 * Fonctionnalités :
 * - Koraly annonce ce soir à la télé (programmes soirée)
 * - Navigation jour par jour (← / → ou boutons)
 * - Raccourcis numériques 1-9 → chaînes TNT correspondantes
 * - WCAG AAA, police Luciole, design system marine
 *
 * GROA-223 — Phase 1c VoixTV
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { AccessibilityBar } from "@/lib/shared/components/accessibility-bar";
import { LiveRegion } from "@/lib/shared/components/live-region";
import { SiteHeader } from "@/components/site-header";
import { Footer } from "@/components/footer";
import { HelpDialog } from "@/components/help-dialog";
import { useSpeech } from "@/lib/shared/speech/use-speech";
import { usePreferences, SPEECH_RATE_VALUE } from "@/lib/preferences/use-preferences";
import { useDocumentTitle } from "@/lib/useDocumentTitle";
import type { TvProgramsResponse } from "@/app/api/tv/programs/route";
import type { TvChannelDto, TvProgramDto } from "@/lib/tv/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Formate une date ISO en heure locale "HH:MM" (Europe/Paris). */
function formatHeure(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("fr-FR", {
      timeZone: "Europe/Paris",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

/** Formate une date YYYY-MM-DD en texte lisible (ex: "mardi 14 avril"). */
function formatDateLabel(dateStr: string): string {
  try {
    const [y, m, d] = dateStr.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
  } catch {
    return dateStr;
  }
}

/** Retourne la date du jour (Europe/Paris) au format YYYY-MM-DD. */
function todayParis(): string {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(new Date())
    .split("/")
    .reverse()
    .join("-");
}

/** Ajoute `delta` jours à une date YYYY-MM-DD. */
function shiftDate(dateStr: string, delta: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d + delta);
  return [
    dt.getFullYear(),
    String(dt.getMonth() + 1).padStart(2, "0"),
    String(dt.getDate()).padStart(2, "0"),
  ].join("-");
}

/** Construit le texte oral pour un programme (Koraly). */
function programToSpeech(prog: TvProgramDto): string {
  const heure = formatHeure(prog.startAt);
  let text = `À ${heure} : ${prog.title}`;
  if (prog.subtitle) text += `, ${prog.subtitle}`;
  if (prog.genre) text += ` — ${prog.genre}`;
  return text;
}

/** Construit le texte oral résumant la soirée d'une chaîne. */
function channelEveningSpeech(
  channel: TvChannelDto,
  programs: TvProgramDto[]
): string {
  if (programs.length === 0) {
    return `${channel.name} : aucun programme disponible ce soir.`;
  }
  const lines = programs.slice(0, 4).map(programToSpeech);
  return `${channel.name} ce soir : ${lines.join(". ")}.`;
}

// ---------------------------------------------------------------------------
// Sous-composant : carte d'une chaîne
// ---------------------------------------------------------------------------

interface ChannelCardProps {
  channel: TvChannelDto;
  programs: TvProgramDto[];
  shortcutKey: number | null; // 1-9 ou null
  focused: boolean;
  cardRef: React.RefCallback<HTMLElement>;
  onReadChannel: (channel: TvChannelDto, programs: TvProgramDto[]) => void;
}

function ChannelCard({
  channel,
  programs,
  shortcutKey,
  focused,
  cardRef,
  onReadChannel,
}: ChannelCardProps) {
  return (
    <article
      ref={cardRef}
      tabIndex={-1}
      aria-label={`Chaîne ${channel.tntNumber} — ${channel.name}${shortcutKey ? `, raccourci clavier ${shortcutKey}` : ""}`}
      className="rounded-xl border p-4 flex flex-col gap-2"
      style={{
        background: "var(--bg-card)",
        borderColor: focused ? "var(--brass)" : "var(--border)",
        outline: focused ? "3px solid var(--brass)" : "none",
        outlineOffset: "2px",
        transition: "border-color 0.15s",
      }}
    >
      {/* En-tête chaîne */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {shortcutKey !== null && (
            <span
              aria-hidden="true"
              className="text-xs font-bold rounded px-1.5 py-0.5 shrink-0"
              style={{
                background: "var(--accent)",
                color: "#fff",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {shortcutKey}
            </span>
          )}
          <span
            className="font-bold text-base"
            style={{ color: "var(--text)" }}
          >
            {channel.name}
          </span>
          <span
            className="text-xs"
            style={{ color: "var(--text-muted)" }}
            aria-label={`TNT ${channel.tntNumber}`}
          >
            TNT {channel.tntNumber}
          </span>
        </div>
        <button
          type="button"
          onClick={() => onReadChannel(channel, programs)}
          aria-label={`Lire la soirée de ${channel.name} à voix haute`}
          className="text-xs font-semibold px-2 py-1 rounded shrink-0"
          style={{
            background: "var(--accent)",
            color: "#fff",
            cursor: "pointer",
          }}
        >
          Écouter
        </button>
      </div>

      {/* Programmes */}
      {programs.length === 0 ? (
        <p className="text-sm italic" style={{ color: "var(--text-muted)" }}>
          Aucun programme disponible
        </p>
      ) : (
        <ol aria-label={`Programmes du soir sur ${channel.name}`} className="space-y-1.5">
          {programs.slice(0, 4).map((prog) => (
            <li key={prog.id} className="text-sm">
              <span
                className="font-semibold tabular-nums"
                style={{ color: "var(--accent)", minWidth: "3.5rem", display: "inline-block" }}
              >
                {formatHeure(prog.startAt)}
              </span>
              <span style={{ color: "var(--text)" }}>{prog.title}</span>
              {prog.genre && (
                <span className="ml-2 text-xs" style={{ color: "var(--text-muted)" }}>
                  {prog.genre}
                </span>
              )}
            </li>
          ))}
          {programs.length > 4 && (
            <li
              className="text-xs italic"
              style={{ color: "var(--text-muted)" }}
              aria-label={`et ${programs.length - 4} programme${programs.length - 4 > 1 ? "s" : ""} de plus`}
            >
              + {programs.length - 4} de plus
            </li>
          )}
        </ol>
      )}
    </article>
  );
}

// ---------------------------------------------------------------------------
// Page principale
// ---------------------------------------------------------------------------

export default function TvPage() {
  useDocumentTitle("VoixTV — Ce soir à la télé");

  const { prefs } = usePreferences();
  const { speak, cancelSpeech } = useSpeech({
    rate: SPEECH_RATE_VALUE[prefs.speechRate],
    lang: prefs.speechLocale,
    premiumVoice: prefs.premiumVoice,
  });

  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [helpOpen, setHelpOpen] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  // Date sélectionnée (YYYY-MM-DD)
  const [selectedDate, setSelectedDate] = useState<string>(() => todayParis());
  const today = todayParis();

  // Données EPG
  const [data, setData] = useState<TvProgramsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Chaîne actuellement focalisée (pour raccourcis 1-9)
  const [focusedChannelIdx, setFocusedChannelIdx] = useState<number | null>(null);

  // Refs pour focus programmatique sur les cartes
  const cardRefs = useRef<Map<string, HTMLElement>>(new Map());

  // Indique si c'est la première charge (pour le welcome vocal)
  const firstLoadRef = useRef(true);

  // ---------------------------------------------------------------------------
  // Chargement des programmes
  // ---------------------------------------------------------------------------

  const loadPrograms = useCallback(async (date: string) => {
    setLoading(true);
    setError(null);
    setAnnouncement("Chargement des programmes…");

    try {
      const res = await fetch(`/api/tv/programs?date=${encodeURIComponent(date)}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          (body as { error?: string }).error ?? `HTTP ${res.status}`
        );
      }
      const json: TvProgramsResponse = await res.json();
      setData(json);

      const dateLabel = formatDateLabel(date);
      const channelCount = json.channels.length;
      const msg = `Programmes du ${dateLabel} chargés — ${channelCount} chaîne${channelCount > 1 ? "s" : ""}.`;
      setAnnouncement(msg);

      // Annonce vocale Koraly au premier chargement
      if (firstLoadRef.current && voiceEnabled) {
        firstLoadRef.current = false;
        const firstChannels = json.channels.slice(0, 3);
        if (firstChannels.length > 0) {
          const intro = `Bonsoir. Ce soir à la télé, le ${dateLabel}.`;
          const summaries = firstChannels
            .map((c) => channelEveningSpeech(c.channel, c.programs))
            .join(" ");
          cancelSpeech();
          speak(`${intro} ${summaries}`).catch((err) =>
            console.warn("[tv] speak welcome failed:", err)
          );
        }
      }
    } catch (err) {
      console.error("[tv] loadPrograms failed:", err);
      const msg = err instanceof Error ? err.message : "Erreur inconnue.";
      setError(msg);
      setAnnouncement(`Erreur : ${msg}`);
    } finally {
      setLoading(false);
    }
  }, [speak, cancelSpeech, voiceEnabled]);

  // Chargement initial + changement de date
  useEffect(() => {
    loadPrograms(selectedDate);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  // ---------------------------------------------------------------------------
  // Navigation jour par jour
  // ---------------------------------------------------------------------------

  const goToDate = useCallback(
    (delta: number) => {
      const next = shiftDate(selectedDate, delta);
      // Limiter à J-1 … J+6 (EPG dispo 7 jours)
      const todayMs = new Date(today).getTime();
      const nextMs = new Date(next).getTime();
      const diffDays = (nextMs - todayMs) / (1000 * 60 * 60 * 24);
      if (diffDays < -1 || diffDays > 6) return;
      setSelectedDate(next);
      setFocusedChannelIdx(null);
    },
    [selectedDate, today]
  );

  // ---------------------------------------------------------------------------
  // Lecture vocale d'une chaîne
  // ---------------------------------------------------------------------------

  const readChannel = useCallback(
    (channel: TvChannelDto, programs: TvProgramDto[]) => {
      if (!voiceEnabled) return;
      cancelSpeech();
      const text = channelEveningSpeech(channel, programs);
      setAnnouncement(text);
      speak(text).catch((err) => console.warn("[tv] speak channel failed:", err));
    },
    [voiceEnabled, cancelSpeech, speak]
  );

  // ---------------------------------------------------------------------------
  // Lecture "ce soir" (résumé des 3 premières chaînes)
  // ---------------------------------------------------------------------------

  const readTonight = useCallback(() => {
    if (!data || !voiceEnabled) return;
    cancelSpeech();
    const dateLabel = formatDateLabel(selectedDate);
    const intro = `Ce soir, le ${dateLabel}.`;
    const summaries = data.channels
      .slice(0, 3)
      .map((c) => channelEveningSpeech(c.channel, c.programs))
      .join(" ");
    const text = `${intro} ${summaries}`;
    setAnnouncement(text);
    speak(text).catch((err) => console.warn("[tv] speak tonight failed:", err));
  }, [data, voiceEnabled, cancelSpeech, speak, selectedDate]);

  // ---------------------------------------------------------------------------
  // Raccourcis clavier
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (typeof window === "undefined") return;

    function handler(e: KeyboardEvent) {
      if (helpOpen) return;
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      const target = e.target as HTMLElement | null;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable
      )
        return;

      // Navigation jour (← / →)
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goToDate(-1);
        return;
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        goToDate(1);
        return;
      }

      // Lecture "ce soir" (touche T)
      if (e.key === "t" || e.key === "T") {
        e.preventDefault();
        readTonight();
        return;
      }

      // Raccourcis 1-9 → chaînes (sorted by tntNumber)
      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= 9 && data) {
        e.preventDefault();
        const idx = num - 1;
        const channelData = data.channels[idx];
        if (!channelData) return;

        setFocusedChannelIdx(idx);
        const el = cardRefs.current.get(channelData.channel.id);
        el?.focus();

        setAnnouncement(
          `Chaîne ${channelData.channel.tntNumber} — ${channelData.channel.name}`
        );
        if (voiceEnabled) {
          cancelSpeech();
          readChannel(channelData.channel, channelData.programs);
        }
      }
    }

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [helpOpen, goToDate, readTonight, data, voiceEnabled, cancelSpeech, readChannel]);

  // ---------------------------------------------------------------------------
  // Rendu
  // ---------------------------------------------------------------------------

  const dateLabel = formatDateLabel(selectedDate);
  const isToday = selectedDate === today;
  const isTomorrow = selectedDate === shiftDate(today, 1);

  const dateLabelShort = isToday
    ? "Aujourd'hui"
    : isTomorrow
    ? "Demain"
    : dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1);

  const canGoPrev =
    (new Date(selectedDate).getTime() - new Date(today).getTime()) /
      (1000 * 60 * 60 * 24) >
    -1;
  const canGoNext =
    (new Date(selectedDate).getTime() - new Date(today).getTime()) /
      (1000 * 60 * 60 * 24) <
    6;

  return (
    <>
      <LiveRegion message={announcement} />

      <AccessibilityBar
        service="tv"
        onVoiceToggle={setVoiceEnabled}
        onHelpRequest={() => setHelpOpen(true)}
      />

      <SiteHeader />

      <main
        id="main"
        tabIndex={-1}
        className="min-h-screen px-4 py-10 max-w-5xl mx-auto"
        style={{ outline: "none" }}
      >
        <h1 className="vc-h1 mb-1">VoixTV</h1>
        <p className="mb-6 text-base" style={{ color: "var(--text-soft)" }}>
          Les programmes du soir à la télé, lus par Koraly.
        </p>

        {/* Barre de navigation date + bouton "ce soir" */}
        <div
          className="flex items-center flex-wrap gap-3 mb-8"
          role="group"
          aria-label="Navigation par date"
        >
          <button
            type="button"
            onClick={() => goToDate(-1)}
            disabled={!canGoPrev}
            aria-label="Jour précédent (raccourci ←)"
            className="rounded-lg border-2 font-bold disabled:opacity-40 transition-colors"
            style={{
              height: 48,
              width: 48,
              fontSize: 22,
              borderColor: "var(--border-hi)",
              color: "var(--text)",
              background: "var(--bg-surface)",
              cursor: canGoPrev ? "pointer" : "not-allowed",
            }}
          >
            ←
          </button>

          <span
            className="font-bold text-xl"
            aria-live="polite"
            aria-atomic="true"
            style={{ color: "var(--text)", minWidth: "14rem", textAlign: "center" }}
          >
            {dateLabelShort}
          </span>

          <button
            type="button"
            onClick={() => goToDate(1)}
            disabled={!canGoNext}
            aria-label="Jour suivant (raccourci →)"
            className="rounded-lg border-2 font-bold disabled:opacity-40 transition-colors"
            style={{
              height: 48,
              width: 48,
              fontSize: 22,
              borderColor: "var(--border-hi)",
              color: "var(--text)",
              background: "var(--bg-surface)",
              cursor: canGoNext ? "pointer" : "not-allowed",
            }}
          >
            →
          </button>

          {!isToday && (
            <button
              type="button"
              onClick={() => setSelectedDate(today)}
              className="rounded-lg px-4 font-semibold text-sm"
              aria-label="Revenir à aujourd'hui"
              style={{
                height: 48,
                background: "var(--bg-surface)",
                color: "var(--text-soft)",
                border: "1px solid var(--border-hi)",
                cursor: "pointer",
              }}
            >
              Aujourd&apos;hui
            </button>
          )}

          <button
            type="button"
            onClick={readTonight}
            disabled={!data || loading}
            aria-label="Écouter le résumé de ce soir (raccourci T)"
            className="rounded-xl font-semibold text-sm px-5"
            style={{
              height: 48,
              background: "var(--accent)",
              color: "#fff",
              cursor: data && !loading ? "pointer" : "not-allowed",
              opacity: !data || loading ? 0.6 : 1,
              marginLeft: "auto",
            }}
          >
            🔊 Ce soir
          </button>
        </div>

        {/* Légende raccourcis */}
        <p className="mb-6 text-xs" style={{ color: "var(--text-muted)" }} aria-hidden="true">
          Raccourcis : <kbd>1</kbd>–<kbd>9</kbd> = chaînes · <kbd>←</kbd><kbd>→</kbd> = jours ·
          <kbd>T</kbd> = lire ce soir
        </p>

        {/* Chargement */}
        {loading && (
          <div
            className="text-center py-16"
            aria-live="polite"
            style={{ color: "var(--text-muted)" }}
          >
            Chargement des programmes…
          </div>
        )}

        {/* Erreur */}
        {error && !loading && (
          <div
            role="alert"
            className="rounded-xl p-4 text-sm mb-6"
            style={{
              background: "color-mix(in srgb, var(--danger) 10%, transparent)",
              color: "var(--danger)",
              border: "1px solid var(--danger)",
            }}
          >
            {error}
          </div>
        )}

        {/* Grille des chaînes */}
        {!loading && data && (
          <section
            aria-label={`Programmes du ${dateLabel} — ${data.channels.length} chaîne${data.channels.length > 1 ? "s" : ""}`}
          >
            {data.channels.length === 0 ? (
              <p
                className="text-center py-16"
                style={{ color: "var(--text-muted)" }}
              >
                Aucune chaîne disponible.
              </p>
            ) : (
              <div
                className="grid gap-4"
                style={{
                  gridTemplateColumns:
                    "repeat(auto-fill, minmax(min(100%, 320px), 1fr))",
                }}
              >
                {data.channels.map((c, idx) => (
                  <ChannelCard
                    key={c.channel.id}
                    channel={c.channel}
                    programs={c.programs}
                    shortcutKey={idx < 9 ? idx + 1 : null}
                    focused={focusedChannelIdx === idx}
                    cardRef={(el) => {
                      if (el) cardRefs.current.set(c.channel.id, el);
                      else cardRefs.current.delete(c.channel.id);
                    }}
                    onReadChannel={readChannel}
                  />
                ))}
              </div>
            )}
          </section>
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
