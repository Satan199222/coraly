"use client";

/**
 * Page conversation Transport — Agent ElevenLabs Coraly Transport
 *
 * Tools client exposés à l'agent :
 *   - find_station       : recherche un arrêt/gare par nom
 *   - get_next_departures : prochains départs depuis un arrêt
 *   - track_disruptions  : perturbations sur une ligne IDFM
 *   - search_itinerary   : itinéraire A→B via l'API transport
 *
 * Variables dynamiques :
 *   - current_time       : heure locale Paris HH:MM
 *   - current_date       : date YYYY-MM-DD Europe/Paris
 *   - position           : position GPS si disponible (lat,lon)
 *   - trajets_favoris    : trajets favoris (localStorage)
 *
 * GROA-283 — Agent ElevenLabs Coraly Transport
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useConversationClientTool } from "@elevenlabs/react";
import { ConversationShell, useShellContext } from "@/lib/conversation";
import type {
  TransportDeparture,
  TransportDisruption,
  TransportJourney,
  TransportStop,
  TransportLineInfo,
} from "@/lib/transport/types";

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

// ---------------------------------------------------------------------------
// Sous-composant : outils client (monté DANS ConversationProvider)
// ---------------------------------------------------------------------------

function TransportClientTools() {
  const { pushToolEvent } = useShellContext();

  // Cache de stations consulté par les tools
  const stopsCache = useRef<Record<string, TransportStop[]>>({});
  const linesCache = useRef<Record<string, TransportLineInfo[]>>({});

  // -------------------------------------------------------------------
  // Helper interne : chercher des arrêts
  // -------------------------------------------------------------------
  const fetchStops = useCallback(async (q: string): Promise<TransportStop[]> => {
    const key = q.toLowerCase().trim();
    if (stopsCache.current[key]) return stopsCache.current[key];
    try {
      const res = await fetch(`/api/transport/stops?q=${encodeURIComponent(q)}`);
      if (!res.ok) {
        console.error("[transport/conversation] fetchStops failed:", res.status);
        return [];
      }
      const data = await res.json();
      const stops: TransportStop[] = (data as { stops: TransportStop[] }).stops ?? [];
      stopsCache.current[key] = stops;
      return stops;
    } catch (err) {
      console.error("[transport/conversation] fetchStops error:", err);
      return [];
    }
  }, []);

  // -------------------------------------------------------------------
  // Helper interne : chercher des lignes IDFM
  // -------------------------------------------------------------------
  const fetchLines = useCallback(async (q: string): Promise<TransportLineInfo[]> => {
    const key = q.toLowerCase().trim();
    if (linesCache.current[key]) return linesCache.current[key];
    try {
      const res = await fetch(`/api/transport/idfm/lines?q=${encodeURIComponent(q)}`);
      if (!res.ok) return [];
      const data = await res.json();
      const lines: TransportLineInfo[] = (data as { lines: TransportLineInfo[] }).lines ?? [];
      linesCache.current[key] = lines;
      return lines;
    } catch (err) {
      console.error("[transport/conversation] fetchLines error:", err);
      return [];
    }
  }, []);

  // -------------------------------------------------------------------
  // Tool : find_station
  // Recherche un arrêt ou une gare par nom, retourne les correspondances
  // -------------------------------------------------------------------
  useConversationClientTool(
    "find_station",
    async (params: Record<string, unknown>): Promise<string> => {
      const query =
        typeof params.query === "string" ? params.query.trim() : "";
      if (!query) return JSON.stringify({ error: "Paramètre query manquant." });

      pushToolEvent("find_station", `🔍 ${query}`);

      const stops = await fetchStops(query);
      if (stops.length === 0) {
        return JSON.stringify({
          error: `Aucun arrêt trouvé pour « ${query} ». Essayez un nom plus précis.`,
        });
      }

      return JSON.stringify({
        query,
        results: stops.slice(0, 5).map((s) => ({
          id: s.id,
          name: s.name,
          label: s.label,
          type: s.type,
        })),
      });
    }
  );

  // -------------------------------------------------------------------
  // Tool : get_next_departures
  // Prochains départs depuis un arrêt (par nom ou ID)
  // -------------------------------------------------------------------
  useConversationClientTool(
    "get_next_departures",
    async (params: Record<string, unknown>): Promise<string> => {
      const stopQuery =
        typeof params.stop === "string" ? params.stop.trim() : "";
      const lineFilter =
        typeof params.line === "string" ? params.line.trim() : "";
      const countRaw = typeof params.count === "number" ? params.count : 5;
      const count = Math.min(Math.max(1, countRaw), 10);

      if (!stopQuery)
        return JSON.stringify({ error: "Paramètre stop manquant." });

      pushToolEvent("get_next_departures", `🚉 ${stopQuery}${lineFilter ? ` · ${lineFilter}` : ""}`);

      const stops = await fetchStops(stopQuery);
      if (stops.length === 0) {
        return JSON.stringify({
          error: `Arrêt « ${stopQuery} » introuvable. Essayez « Nation », « Châtelet - Les Halles »…`,
        });
      }
      const stop = stops[0];

      try {
        const res = await fetch(
          `/api/transport/idfm/departures?stop_id=${encodeURIComponent(stop.id)}&count=${count}`
        );
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          const msg = (body as { error?: string }).error ?? `HTTP ${res.status}`;
          console.error("[transport/conversation] get_next_departures failed:", msg);
          return JSON.stringify({ error: msg });
        }
        const data = await res.json();
        let departures: TransportDeparture[] =
          (data as { departures: TransportDeparture[] }).departures ?? [];

        if (lineFilter) {
          const lf = lineFilter.toLowerCase();
          const filtered = departures.filter(
            (d) =>
              d.lineName.toLowerCase().includes(lf) ||
              d.lineCode.toLowerCase().includes(lf) ||
              d.mode.toLowerCase().includes(lf)
          );
          if (filtered.length > 0) departures = filtered;
        }

        if (departures.length === 0) {
          return JSON.stringify({
            stop: stop.name,
            error: "Aucun départ trouvé pour le moment.",
          });
        }

        const results = departures.slice(0, count).map((d) => {
          const inMin = delayInMinutes(d.expectedTime);
          return {
            mode: d.mode,
            line: d.lineName,
            lineCode: d.lineCode,
            direction: d.direction,
            inMinutes: inMin,
            time: formatTime(d.expectedTime),
          };
        });

        return JSON.stringify({ stop: stop.name, departures: results });
      } catch (err) {
        console.error("[transport/conversation] get_next_departures error:", err);
        return JSON.stringify({ error: "Erreur lors de la récupération des départs." });
      }
    }
  );

  // -------------------------------------------------------------------
  // Tool : track_disruptions
  // Perturbations actives et à venir sur une ligne IDFM
  // -------------------------------------------------------------------
  useConversationClientTool(
    "track_disruptions",
    async (params: Record<string, unknown>): Promise<string> => {
      const lineQuery =
        typeof params.line === "string" ? params.line.trim() : "";
      if (!lineQuery)
        return JSON.stringify({ error: "Paramètre line manquant." });

      pushToolEvent("track_disruptions", `⚠️ ${lineQuery}`);

      const lines = await fetchLines(lineQuery);
      if (lines.length === 0) {
        return JSON.stringify({
          error: `Ligne « ${lineQuery} » introuvable. Essayez « Métro 13 », « RER A », « Tramway 3b »…`,
        });
      }
      const line = lines[0];

      try {
        const res = await fetch(
          `/api/transport/idfm/disruptions?line_id=${encodeURIComponent(line.id)}`
        );
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          const msg = (body as { error?: string }).error ?? `HTTP ${res.status}`;
          console.error("[transport/conversation] track_disruptions failed:", msg);
          return JSON.stringify({ error: msg });
        }
        const data = await res.json();
        const disruptions: TransportDisruption[] =
          (data as { disruptions: TransportDisruption[] }).disruptions ?? [];

        if (disruptions.length === 0) {
          return JSON.stringify({
            line: `${line.mode} ${line.code}`,
            lineName: line.name,
            status: "ok",
            message: "Aucune perturbation active.",
          });
        }

        const active = disruptions
          .filter((d) => d.status === "active")
          .slice(0, 3)
          .map((d) => ({
            severity: d.severity,
            title: d.title ?? d.message,
            cause: d.cause,
          }));
        const future = disruptions
          .filter((d) => d.status === "future")
          .slice(0, 2)
          .map((d) => ({
            severity: d.severity,
            title: d.title ?? d.message,
          }));

        return JSON.stringify({
          line: `${line.mode} ${line.code}`,
          lineName: line.name,
          active,
          future,
        });
      } catch (err) {
        console.error("[transport/conversation] track_disruptions error:", err);
        return JSON.stringify({ error: "Erreur lors de la récupération des perturbations." });
      }
    }
  );

  // -------------------------------------------------------------------
  // Tool : search_itinerary
  // Itinéraire A→B via l'API journey
  // -------------------------------------------------------------------
  useConversationClientTool(
    "search_itinerary",
    async (params: Record<string, unknown>): Promise<string> => {
      const fromQuery =
        typeof params.from === "string" ? params.from.trim() : "";
      const toQuery =
        typeof params.to === "string" ? params.to.trim() : "";

      if (!fromQuery || !toQuery)
        return JSON.stringify({ error: "Paramètres from et to requis." });

      pushToolEvent("search_itinerary", `🗺️ ${fromQuery} → ${toQuery}`);

      const [fromStops, toStops] = await Promise.all([
        fetchStops(fromQuery),
        fetchStops(toQuery),
      ]);

      if (fromStops.length === 0) {
        return JSON.stringify({
          error: `Départ « ${fromQuery} » introuvable. Précisez le nom de l'arrêt ou de l'adresse.`,
        });
      }
      if (toStops.length === 0) {
        return JSON.stringify({
          error: `Destination « ${toQuery} » introuvable. Précisez le nom de l'arrêt ou de l'adresse.`,
        });
      }

      const from = fromStops[0];
      const to = toStops[0];

      try {
        const res = await fetch(
          `/api/transport/journey?from=${encodeURIComponent(from.id)}&to=${encodeURIComponent(to.id)}`
        );
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          const msg = (body as { error?: string }).error ?? `HTTP ${res.status}`;
          console.error("[transport/conversation] search_itinerary failed:", msg);
          return JSON.stringify({ error: msg });
        }
        const data = await res.json();
        const journeys: TransportJourney[] =
          (data as { journeys: TransportJourney[] }).journeys ?? [];

        if (journeys.length === 0) {
          return JSON.stringify({
            error: `Aucun itinéraire trouvé de « ${from.name} » vers « ${to.name} ».`,
          });
        }

        const results = journeys.slice(0, 3).map((j) => ({
          departure: formatTime(j.departure),
          arrival: formatTime(j.arrival),
          durationMin: Math.round(j.totalDuration / 60),
          transfers: j.transfers,
          legs: j.legs?.map((l) => ({
            mode: l.mode,
            line: l.lineName,
            from: l.from,
            to: l.to,
          })),
        }));

        return JSON.stringify({
          from: from.name,
          to: to.name,
          journeys: results,
        });
      } catch (err) {
        console.error("[transport/conversation] search_itinerary error:", err);
        return JSON.stringify({ error: "Erreur lors de la recherche d'itinéraire." });
      }
    }
  );

  return null;
}

// ---------------------------------------------------------------------------
// Side panel : derniers trajets favoris
// ---------------------------------------------------------------------------

function FavorisSidePanel() {
  const [favoris] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem("transport_favoris");
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  });

  return (
    <section
      aria-label="Trajets favoris"
      className="p-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] min-h-[280px]"
    >
      <h2 className="text-lg font-bold mb-3 sticky top-0 bg-[var(--bg-surface)] pb-2 border-b border-[var(--border)]">
        ⭐ Trajets favoris
      </h2>
      {favoris.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)] italic">
          Vos trajets fréquents apparaîtront ici après votre première recherche.
        </p>
      ) : (
        <ul className="space-y-2">
          {favoris.map((f, i) => (
            <li key={i} className="text-sm" style={{ color: "var(--text)" }}>
              🚇 {f}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-6">
        <h3 className="text-sm font-semibold mb-2" style={{ color: "var(--text-soft)" }}>
          Exemples
        </h3>
        <ul className="space-y-1 text-xs" style={{ color: "var(--text-muted)" }}>
          <li>« Prochain RER A à Nation »</li>
          <li>« Perturbations ligne 13 »</li>
          <li>« Aller de Châtelet à La Défense »</li>
          <li>« Bus 91 à Denfert-Rochereau »</li>
        </ul>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Page principale
// ---------------------------------------------------------------------------

export default function TransportConversationPageClient() {
  const { time, date } = nowParis();

  const [position, setPosition] = useState<string>("non disponible");
  const favoris =
    typeof window !== "undefined"
      ? safeLocalGet("transport_favoris")
      : "";

  // Géolocalisation optionnelle
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPosition(
          `${pos.coords.latitude.toFixed(5)},${pos.coords.longitude.toFixed(5)}`
        );
      },
      () => {
        // Refus ou indisponible — silence volontaire, position reste "non disponible"
      },
      { timeout: 5000, maximumAge: 300_000 }
    );
  }, []);

  const dynamicVariables: Record<string, string> = {
    current_time: time,
    current_date: date,
    position,
    trajets_favoris: favoris || "aucun trajet favori",
  };

  return (
    <ConversationShell
      config={{
        title: "Koraly Transport — Transports en commun IdF",
        description:
          "Demandez à Koraly les prochains départs, les perturbations sur votre ligne, ou un itinéraire de A à B en Île-de-France.",
        agentName: "Koraly",
        badge: "Transport",
        hintText:
          "Dites par exemple : « Prochain RER A à Nation ? », « Perturbations ligne 13 ? », ou « Aller de Châtelet à La Défense ».",
        backHref: "/transport",
        backLabel: "Retour transport",
      }}
      dynamicVariables={dynamicVariables}
      signedUrlEndpoint="/api/agent/transport/signed-url"
      renderSidePanel={() => <FavorisSidePanel />}
    >
      <TransportClientTools />
    </ConversationShell>
  );
}
