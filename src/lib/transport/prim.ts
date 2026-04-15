/**
 * Client PRIM/IDFM — Portail Régional d'Information Multimodale.
 *
 * Portail open data Île-de-France Mobilités.
 * Inscription gratuite et instantanée sur https://prim.iledefrance-mobilites.fr/
 *
 * Variables d'environnement requises :
 *   PRIM_API_KEY   — clé API obtenue sur le portail PRIM
 *
 * Fonctions exposées :
 *   searchStop(query)           → arrêts correspondants (autocomplete)
 *   getNextDepartures(stopId)   → prochains passages temps réel
 *   getLineInfo(lineId)         → informations statiques sur une ligne
 *   getDisruptions(lineId)      → perturbations actives / futures
 */

import type {
  TransportDeparture,
  TransportDisruption,
  TransportLineInfo,
  TransportStop,
} from "./types";

const PRIM_BASE = "https://prim.iledefrance-mobilites.fr/marketplace";
const FETCH_TIMEOUT_MS = 8_000;

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

function getApiKey(): string {
  const key = process.env.PRIM_API_KEY;
  if (!key) {
    throw new Error(
      "[prim] PRIM_API_KEY absent — inscrivez-vous sur https://prim.iledefrance-mobilites.fr/ pour obtenir une clé."
    );
  }
  return key;
}

async function primFetch<T>(path: string): Promise<T> {
  const url = `${PRIM_BASE}/${path}`;
  const res = await fetch(url, {
    headers: {
      apikey: getApiKey(),
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  if (!res.ok) {
    throw new Error(`[prim] HTTP ${res.status} pour ${path}`);
  }

  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Types bruts PRIM (sous-ensemble de Navitia)
// ---------------------------------------------------------------------------

interface PrimPlace {
  id: string;
  name: string;
  embedded_type: "stop_area" | "address" | "poi" | "administrative_region";
  stop_area?: {
    id: string;
    name: string;
    label: string;
    coord: { lat: number; lon: number };
  };
  address?: {
    id: string;
    name: string;
    label: string;
    coord: { lat: number; lon: number };
  };
}

interface PrimStopSchedule {
  display_informations: {
    network: string;
    direction: string;
    label: string;
    color: string;
    text_color: string;
    commercial_mode: string;
    physical_mode: string;
    trip_short_name: string;
  };
  stop_point: {
    id: string;
    name: string;
    label: string;
  };
  date_times: Array<{
    date_time: string; // YYYYMMDDTHHMMSS
    base_date_time: string;
    data_freshness: "realtime" | "base_schedule";
    links: Array<{ id: string; type: string }>;
  }>;
}

interface PrimLine {
  id: string;
  name: string;
  code: string;
  color: string;
  text_color: string;
  commercial_mode: { id: string; name: string };
  network: { id: string; name: string };
}

interface PrimDisruption {
  id: string;
  status: string;
  severity: {
    name: string;
    effect: string;
    color: string;
  };
  cause: string;
  messages: Array<{ text: string; channel: { name: string } }>;
  application_periods: Array<{ begin: string; end: string }>;
  impacted_objects: Array<{
    pt_object: { id: string; name: string; embedded_type: string };
  }>;
}

// ---------------------------------------------------------------------------
// Helpers de normalisation
// ---------------------------------------------------------------------------

/** Convertit "YYYYMMDDTHHMMSS" (Navitia/PRIM) → ISO 8601. */
function primDateToISO(dt: string): string {
  const y = dt.slice(0, 4);
  const mo = dt.slice(4, 6);
  const d = dt.slice(6, 8);
  const h = dt.slice(9, 11);
  const mi = dt.slice(11, 13);
  const s = dt.slice(13, 15);
  return `${y}-${mo}-${d}T${h}:${mi}:${s}`;
}

function normalizePlace(place: PrimPlace): TransportStop {
  const area = place.stop_area ?? place.address;
  return {
    id: place.id,
    name: place.name,
    label: area?.label ?? place.name,
    lat: area?.coord.lat ?? 0,
    lon: area?.coord.lon ?? 0,
    type: place.embedded_type,
  };
}

function normalizeDeparture(
  schedule: PrimStopSchedule,
  dtEntry: PrimStopSchedule["date_times"][number],
  idx: number
): TransportDeparture {
  const info = schedule.display_informations;
  const expectedISO = primDateToISO(dtEntry.date_time);
  const scheduledISO = primDateToISO(dtEntry.base_date_time);

  const expectedMs = new Date(expectedISO).getTime();
  const scheduledMs = new Date(scheduledISO).getTime();
  const delay = Math.round((expectedMs - scheduledMs) / 1000);

  return {
    id: `${schedule.stop_point.id}-${dtEntry.date_time}-${idx}`,
    lineName: info.label,
    lineCode: info.label,
    mode: info.physical_mode || info.commercial_mode,
    direction: info.direction,
    expectedTime: expectedISO,
    scheduledTime: scheduledISO,
    delay,
    realTime: dtEntry.data_freshness === "realtime",
    lineColor: info.color ? `#${info.color}` : undefined,
  };
}

function mapSeverity(
  effect: string
): TransportDisruption["severity"] {
  switch (effect) {
    case "NO_SERVICE":
    case "STOP_MOVED":
      return "blocking";
    case "SIGNIFICANT_DELAYS":
      return "significant_delays";
    case "REDUCED_SERVICE":
    case "DETOUR":
      return "reduced_service";
    default:
      return "information";
  }
}

function mapStatus(
  status: string
): TransportDisruption["status"] {
  if (status === "active") return "active";
  if (status === "future") return "future";
  return "past";
}

function normalizeDisruption(d: PrimDisruption): TransportDisruption {
  const mainMsg =
    d.messages.find((m) => m.channel.name === "titre")?.text ??
    d.messages[0]?.text ??
    "";
  const detailMsg =
    d.messages.find((m) => m.channel.name === "message")?.text ??
    mainMsg;

  const period = d.application_periods[0];
  const lines = d.impacted_objects
    .filter(
      (o) =>
        o.pt_object.embedded_type === "line" ||
        o.pt_object.embedded_type === "line_section"
    )
    .map((o) => o.pt_object.id);

  return {
    id: d.id,
    status: mapStatus(d.status),
    severity: mapSeverity(d.severity.effect),
    cause: d.cause,
    title: mainMsg,
    message: detailMsg,
    startDate: period?.begin ? primDateToISO(period.begin) : undefined,
    endDate: period?.end ? primDateToISO(period.end) : undefined,
    lines: lines.length > 0 ? lines : undefined,
  };
}

// ---------------------------------------------------------------------------
// API publique
// ---------------------------------------------------------------------------

/**
 * Recherche des arrêts/lieux par nom (autocomplete PRIM/Navitia Île-de-France).
 */
export async function searchStop(query: string): Promise<TransportStop[]> {
  const params = new URLSearchParams({ q: query, count: "8" });
  params.append("type[]", "stop_area");
  params.append("type[]", "address");

  const data = await primFetch<{ places?: PrimPlace[] }>(
    `navitia/coverage/fr-idf/places?${params}`
  );

  return (data.places ?? []).map(normalizePlace);
}

/**
 * Prochains passages temps réel à un arrêt (stop_area:IDFM:…).
 * @param stopId  Identifiant Navitia (ex: "stop_area:IDFM:monomodalStopPlace:SP_2")
 * @param count   Nombre max de passages par ligne (défaut 3)
 */
export async function getNextDepartures(
  stopId: string,
  count = 3
): Promise<TransportDeparture[]> {
  const params = new URLSearchParams({
    count: String(count),
    data_freshness: "realtime",
  });

  const data = await primFetch<{
    stop_schedules?: PrimStopSchedule[];
  }>(
    `navitia/coverage/fr-idf/stop_areas/${encodeURIComponent(stopId)}/stop_schedules?${params}`
  );

  const departures: TransportDeparture[] = [];
  for (const schedule of data.stop_schedules ?? []) {
    schedule.date_times.slice(0, count).forEach((dt, idx) => {
      departures.push(normalizeDeparture(schedule, dt, idx));
    });
  }

  // Tri chronologique
  departures.sort(
    (a, b) =>
      new Date(a.expectedTime).getTime() - new Date(b.expectedTime).getTime()
  );

  return departures;
}

/**
 * Informations statiques sur une ligne IDFM.
 * @param lineId  Identifiant Navitia (ex: "line:IDFM:C01371")
 */
export async function getLineInfo(lineId: string): Promise<TransportLineInfo> {
  const data = await primFetch<{ lines?: PrimLine[] }>(
    `navitia/coverage/fr-idf/lines/${encodeURIComponent(lineId)}`
  );

  const line = data.lines?.[0];
  if (!line) {
    throw new Error(`[prim] Ligne introuvable : ${lineId}`);
  }

  return {
    id: line.id,
    name: line.name,
    code: line.code,
    mode: line.commercial_mode.name,
    network: line.network.name,
    color: line.color || undefined,
    textColor: line.text_color || undefined,
  };
}

/**
 * Recherche de lignes de transport par code ou nom (Navitia IDFM).
 * @param query  Code court (ex: "13", "A") ou nom de ligne
 */
export async function searchLine(query: string): Promise<TransportLineInfo[]> {
  const params = new URLSearchParams({
    q: query,
    count: "8",
  });

  const data = await primFetch<{ lines?: PrimLine[] }>(
    `navitia/coverage/fr-idf/lines?${params}`
  );

  return (data.lines ?? []).map((l) => ({
    id: l.id,
    name: l.name,
    code: l.code,
    mode: l.commercial_mode.name,
    network: l.network.name,
    color: l.color || undefined,
    textColor: l.text_color || undefined,
  }));
}

/**
 * Perturbations actives ou futures pour une ligne IDFM.
 * @param lineId  Identifiant Navitia (ex: "line:IDFM:C01371")
 */
export async function getDisruptions(
  lineId: string
): Promise<TransportDisruption[]> {
  const params = new URLSearchParams({
    "filter": `line.id=${lineId}`,
    "status": "active future",
  });

  const data = await primFetch<{ disruptions?: PrimDisruption[] }>(
    `navitia/coverage/fr-idf/disruptions?${params}`
  );

  return (data.disruptions ?? []).map(normalizeDisruption);
}
