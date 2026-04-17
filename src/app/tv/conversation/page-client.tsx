"use client";

/**
 * Page conversation TV — Agent ElevenLabs Coraly TV
 *
 * Tools client exposés à l'agent :
 *   - search_program      : recherche par titre / genre parmi la soirée
 *   - get_channel_schedule : programme complet d'une chaîne pour une date
 *   - set_reminder         : confirme un rappel vocal (stocké sessionStorage)
 *   - get_now_playing      : ce qui passe en ce moment sur toutes les chaînes
 *
 * Variables dynamiques :
 *   - current_time        : heure locale Paris HH:MM
 *   - current_date        : date YYYY-MM-DD Europe/Paris
 *   - favorite_channels   : chaînes TNT favorites (localStorage)
 *
 * GROA-282 — Agent ElevenLabs Coraly TV
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useConversationClientTool } from "@elevenlabs/react";
import { ConversationShell, useShellContext } from "@/lib/conversation";
import type { TvProgramsResponse } from "@/app/api/tv/programs/route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function nowParis(): { time: string; date: string } {
  const now = new Date();
  const time = now.toLocaleTimeString("fr-FR", {
    timeZone: "Europe/Paris",
    hour: "2-digit",
    minute: "2-digit",
  });
  const date = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(now)
    .split("/")
    .reverse()
    .join("-");
  return { time, date };
}

function safeLocalGet(key: string): string {
  try {
    return localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

function safeLocalSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch (err) {
    console.warn(`[tv/conversation] localStorage.setItem(${key}) failed:`, err);
  }
}

// ---------------------------------------------------------------------------
// Sous-composant : outils client (doit être monté DANS ConversationProvider)
// ---------------------------------------------------------------------------

interface TvToolsProps {
  programs: TvProgramsResponse | null;
  refreshPrograms: (date?: string) => Promise<TvProgramsResponse | null>;
}

function TvClientTools({ programs, refreshPrograms }: TvToolsProps) {
  const { pushToolEvent, setAnnounce } = useShellContext();

  // Référence mutable pour accès sync dans les tools
  const programsRef = useRef<TvProgramsResponse | null>(null);
  useEffect(() => {
    programsRef.current = programs;
  }, [programs]);

  // -------------------------------------------------------------------
  // Tool : search_program
  // Recherche un programme par titre ou genre parmi la soirée d'aujourd'hui
  // -------------------------------------------------------------------
  useConversationClientTool(
    "search_program",
    async (params: Record<string, unknown>): Promise<string> => {
      const query =
        typeof params.query === "string" ? params.query.toLowerCase().trim() : "";
      const date =
        typeof params.date === "string" ? params.date : nowParis().date;

      if (!query) return JSON.stringify({ error: "Paramètre query manquant." });

      pushToolEvent("search_program", `🔍 ${params.query}`);

      let data = programsRef.current;
      if (!data || data.date !== date) {
        data = await refreshPrograms(date);
      }
      if (!data) return JSON.stringify({ error: "Programmes non disponibles." });

      const results: { channel: string; tnt: number; title: string; genre: string | null; startAt: string; endAt: string }[] = [];

      for (const { channel, programs: progs } of data.channels) {
        for (const p of progs) {
          if (
            p.title.toLowerCase().includes(query) ||
            (p.genre ?? "").toLowerCase().includes(query) ||
            (p.subtitle ?? "").toLowerCase().includes(query) ||
            (p.synopsis ?? "").toLowerCase().includes(query)
          ) {
            results.push({
              channel: channel.name,
              tnt: channel.tntNumber,
              title: p.title,
              genre: p.genre,
              startAt: p.startAt,
              endAt: p.endAt,
            });
          }
        }
      }

      return JSON.stringify({ date, query: params.query, results: results.slice(0, 10) });
    }
  );

  // -------------------------------------------------------------------
  // Tool : get_channel_schedule
  // Retourne le programme complet d'une chaîne (par nom ou numéro TNT)
  // -------------------------------------------------------------------
  useConversationClientTool(
    "get_channel_schedule",
    async (params: Record<string, unknown>): Promise<string> => {
      const channelQuery =
        typeof params.channel === "string" ? params.channel.toLowerCase().trim() : "";
      const date =
        typeof params.date === "string" ? params.date : nowParis().date;

      if (!channelQuery)
        return JSON.stringify({ error: "Paramètre channel manquant." });

      pushToolEvent("get_channel_schedule", `📺 ${params.channel}`);

      let data = programsRef.current;
      if (!data || data.date !== date) {
        data = await refreshPrograms(date);
      }
      if (!data) return JSON.stringify({ error: "Programmes non disponibles." });

      // Recherche par numéro TNT ou nom
      const tntNum = parseInt(channelQuery, 10);
      const channelData = data.channels.find(({ channel }) => {
        if (!isNaN(tntNum) && channel.tntNumber === tntNum) return true;
        return channel.name.toLowerCase().includes(channelQuery);
      });

      if (!channelData)
        return JSON.stringify({
          error: `Chaîne "${params.channel}" introuvable.`,
          available: data.channels.map((c) => `${c.channel.tntNumber} — ${c.channel.name}`),
        });

      const { channel, programs: progs } = channelData;
      return JSON.stringify({
        channel: channel.name,
        tnt: channel.tntNumber,
        date,
        programs: progs.map((p) => ({
          title: p.title,
          subtitle: p.subtitle,
          genre: p.genre,
          startAt: p.startAt,
          endAt: p.endAt,
        })),
      });
    }
  );

  // -------------------------------------------------------------------
  // Tool : get_now_playing
  // Retourne ce qui passe EN CE MOMENT sur toutes les chaînes
  // -------------------------------------------------------------------
  useConversationClientTool(
    "get_now_playing",
    async (): Promise<string> => {
      pushToolEvent("get_now_playing", "📡 En ce moment");
      const { date } = nowParis();
      const now = new Date();

      let data = programsRef.current;
      if (!data || data.date !== date) {
        data = await refreshPrograms(date);
      }
      if (!data) return JSON.stringify({ error: "Programmes non disponibles." });

      const nowPlaying: {
        channel: string;
        tnt: number;
        title: string;
        genre: string | null;
        startAt: string;
        endAt: string;
      }[] = [];

      for (const { channel, programs: progs } of data.channels) {
        const current = progs.find(
          (p) => new Date(p.startAt) <= now && new Date(p.endAt) > now
        );
        if (current) {
          nowPlaying.push({
            channel: channel.name,
            tnt: channel.tntNumber,
            title: current.title,
            genre: current.genre,
            startAt: current.startAt,
            endAt: current.endAt,
          });
        }
      }

      return JSON.stringify({
        time: nowParis().time,
        now_playing: nowPlaying,
      });
    }
  );

  // -------------------------------------------------------------------
  // Tool : set_reminder
  // Enregistre un rappel pour un programme (sessionStorage)
  // -------------------------------------------------------------------
  useConversationClientTool(
    "set_reminder",
    (params: Record<string, unknown>): string => {
      const channel =
        typeof params.channel === "string" ? params.channel : "";
      const title =
        typeof params.title === "string" ? params.title : "";
      const startAt =
        typeof params.start_at === "string" ? params.start_at : "";

      if (!channel || !title)
        return JSON.stringify({ error: "Paramètres channel et title requis." });

      pushToolEvent("set_reminder", `⏰ ${title}`);

      // Stocke dans sessionStorage (rappel valable pour la session)
      try {
        const key = "tv_reminders";
        const existing = JSON.parse(
          sessionStorage.getItem(key) ?? "[]"
        ) as { channel: string; title: string; startAt: string }[];
        existing.push({ channel, title, startAt });
        sessionStorage.setItem(key, JSON.stringify(existing));
      } catch (err) {
        console.warn("[tv/conversation] set_reminder sessionStorage failed:", err);
      }

      const msg = startAt
        ? `Rappel enregistré : ${title} sur ${channel} à ${new Date(startAt).toLocaleTimeString("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" })}.`
        : `Rappel enregistré : ${title} sur ${channel}.`;

      setAnnounce(msg);
      return JSON.stringify({ success: true, message: msg });
    }
  );

  return null;
}

// ---------------------------------------------------------------------------
// Page principale
// ---------------------------------------------------------------------------

export default function TvConversationPageClient() {
  const [programs, setPrograms] = useState<TvProgramsResponse | null>(null);

  const { time, date } = nowParis();

  // Canaux favoris stockés dans localStorage (ex: "TF1,M6")
  const favoriteChannels =
    typeof window !== "undefined" ? safeLocalGet("tv_favorite_channels") : "";

  const refreshPrograms = useCallback(async (dateStr?: string): Promise<TvProgramsResponse | null> => {
    const target = dateStr ?? nowParis().date;
    try {
      const res = await fetch(`/api/tv/programs?date=${encodeURIComponent(target)}`);
      if (!res.ok) {
        console.error("[tv/conversation] refreshPrograms failed:", res.status);
        return null;
      }
      const data: TvProgramsResponse = await res.json();
      if (target === nowParis().date) setPrograms(data);
      return data;
    } catch (err) {
      console.error("[tv/conversation] refreshPrograms error:", err);
      return null;
    }
  }, []);

  // Précharge les programmes au montage
  useEffect(() => {
    refreshPrograms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dynamicVariables: Record<string, string> = {
    current_time: time,
    current_date: date,
    favorite_channels: favoriteChannels || "non défini",
  };

  const channelCount = programs?.channels.length ?? 0;
  const contextualUpdate = programs
    ? `Programmes chargés pour ${date} — ${channelCount} chaîne${channelCount > 1 ? "s" : ""} disponible${channelCount > 1 ? "s" : ""}.`
    : undefined;

  return (
    <ConversationShell
      service="tv"
      config={{
        title: "Koraly TV — Programmes du soir",
        description:
          "Demandez à Koraly ce qui passe ce soir, cherchez un film ou une série, et configurez des rappels pour ne pas rater vos émissions préférées.",
        agentName: "Koraly",
        badge: "TV",
        hintText:
          "Dites par exemple : « Qu'est-ce qui passe ce soir sur TF1 ? », « Y a-t-il un film d'action ? », ou « Rappelle-moi le match de foot ».",
        backHref: "/tv",
        backLabel: "Retour programmes",
      }}
      dynamicVariables={dynamicVariables}
      contextualUpdateText={contextualUpdate}
      signedUrlEndpoint="/api/agent/tv/signed-url"
      renderSidePanel={() => (
        <section
          aria-label="Chaînes disponibles ce soir"
          className="p-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] min-h-[280px]"
        >
          <h2 className="text-lg font-bold mb-3 sticky top-0 bg-[var(--bg-surface)] pb-2 border-b border-[var(--border)]">
            📺 Chaînes disponibles
          </h2>
          {!programs ? (
            <p className="text-sm text-[var(--text-muted)] italic">
              Chargement des programmes…
            </p>
          ) : programs.channels.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)] italic">
              Aucune chaîne disponible.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {programs.channels.map(({ channel }) => (
                <li
                  key={channel.id}
                  className="flex items-center gap-2 text-sm"
                >
                  <span
                    className="text-xs font-bold tabular-nums px-1.5 py-0.5 rounded"
                    style={{
                      background: "var(--accent)",
                      color: "#fff",
                      minWidth: "2rem",
                      textAlign: "center",
                    }}
                  >
                    {channel.tntNumber}
                  </span>
                  <span style={{ color: "var(--text)" }}>{channel.name}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    >
      <TvClientTools programs={programs} refreshPrograms={refreshPrograms} />
    </ConversationShell>
  );
}
