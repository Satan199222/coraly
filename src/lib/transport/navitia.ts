/**
 * Client Navitia API pour la planification de transport.
 *
 * Requiert les variables d'environnement :
 *   NAVITIA_TOKEN      — clé d'API Navitia (https://navitia.io)
 *   NAVITIA_COVERAGE   — couverture géographique (défaut: "fr-idf")
 *
 * Doc API : https://doc.navitia.io/
 */

import type {
  NavitiaJourney,
  NavitiaPlace,
  NavitiaSection,
  TransportJourney,
  TransportLeg,
  TransportStop,
} from "./types";

const NAVITIA_BASE = "https://api.navitia.io/v1";
const FETCH_TIMEOUT_MS = 8_000;

function getToken(): string {
  const token = process.env.NAVITIA_TOKEN;
  if (!token) {
    throw new Error(
      "[transport] NAVITIA_TOKEN absent — configurez cette variable d'environnement."
    );
  }
  return token;
}

function getCoverage(): string {
  return process.env.NAVITIA_COVERAGE ?? "fr-idf";
}

async function navitiaFetch<T>(path: string): Promise<T> {
  const url = `${NAVITIA_BASE}/${path}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${getToken()}`,
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  if (!res.ok) {
    throw new Error(`[transport] Navitia HTTP ${res.status} pour ${path}`);
  }

  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Helpers de normalisation
// ---------------------------------------------------------------------------

function normalizePlace(place: NavitiaPlace): TransportStop {
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

/** Convertit "YYYYMMDDTHHMMSS" (Navitia) → ISO 8601. */
function navitiaDateToISO(dt: string): string {
  // Format: 20250414T143000
  const y = dt.slice(0, 4);
  const mo = dt.slice(4, 6);
  const d = dt.slice(6, 8);
  const h = dt.slice(9, 11);
  const mi = dt.slice(11, 13);
  const s = dt.slice(13, 15);
  return `${y}-${mo}-${d}T${h}:${mi}:${s}`;
}

function normalizeLeg(section: NavitiaSection): TransportLeg {
  const from = section.from?.name;
  const to = section.to?.name;

  if (section.type === "public_transport") {
    const info = section.display_informations;
    const stops =
      section.stop_date_times
        ?.slice(1, -1)
        .map((sdt) => sdt.stop_point.name) ?? [];
    return {
      type: "transit",
      duration: section.duration,
      from,
      to,
      lineName: info?.label,
      lineColor: info?.color ? `#${info.color}` : undefined,
      direction: info?.direction,
      mode: info?.physical_mode ?? info?.commercial_mode,
      stops,
    };
  }

  if (section.type === "waiting") {
    return { type: "wait", duration: section.duration };
  }

  // street_network, transfer, crow_fly → à pied
  return { type: "walk", duration: section.duration, from, to };
}

function normalizeJourney(
  journey: NavitiaJourney,
  index: number
): TransportJourney {
  return {
    id: `journey-${index}`,
    totalDuration: journey.duration,
    transfers: journey.nb_transfers,
    departure: navitiaDateToISO(journey.departure_date_time),
    arrival: navitiaDateToISO(journey.arrival_date_time),
    legs: journey.sections.map(normalizeLeg),
    fare:
      journey.fare?.found
        ? {
            amount: journey.fare.total.value,
            currency: journey.fare.total.currency,
          }
        : undefined,
  };
}

// ---------------------------------------------------------------------------
// API publique
// ---------------------------------------------------------------------------

/**
 * Autocomplete de lieux (arrêts, adresses) depuis Navitia.
 */
export async function searchPlaces(query: string): Promise<TransportStop[]> {
  const coverage = getCoverage();
  const params = new URLSearchParams({ q: query, count: "8" });
  params.append("type[]", "stop_area");
  params.append("type[]", "address");

  const data = await navitiaFetch<{ places?: NavitiaPlace[] }>(
    `coverage/${coverage}/places?${params}`
  );

  return (data.places ?? []).map(normalizePlace);
}

/**
 * Calcule les itinéraires optimaux entre deux lieux Navitia.
 * @param from ID Navitia de l'origine  (ex: "stop_area:IDFM:111")
 * @param to   ID Navitia de la destination
 * @param datetime Format YYYYMMDDTHHMMSS — départ au plus tôt (défaut: maintenant)
 */
export async function getJourneys(
  from: string,
  to: string,
  datetime?: string
): Promise<TransportJourney[]> {
  const coverage = getCoverage();
  const params = new URLSearchParams({ from, to, count: "3" });
  if (datetime) params.set("datetime", datetime);

  const data = await navitiaFetch<{ journeys?: NavitiaJourney[] }>(
    `coverage/${coverage}/journeys?${params}`
  );

  return (data.journeys ?? []).map(normalizeJourney);
}
