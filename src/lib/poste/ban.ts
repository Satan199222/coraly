/**
 * Client BAN — Base Adresse Nationale (API Adresse data.gouv.fr).
 *
 * Documentation : https://adresse.data.gouv.fr/api-doc/adresse
 *
 * API ouverte, sans authentification.
 *
 * Fonctions exposées :
 *   searchAddress(query, limit?)   → autocomplétion d'adresse
 *   reverseGeocode(lat, lon)       → adresse depuis coordonnées GPS
 */

import type { BanAddress } from "./types";

const BAN_BASE = "https://api-adresse.data.gouv.fr";
const FETCH_TIMEOUT_MS = 6_000;

// ---------------------------------------------------------------------------
// Types bruts BAN GeoJSON
// ---------------------------------------------------------------------------

interface BanFeatureProperties {
  id: string;
  label: string;
  name: string;
  postcode: string;
  city: string;
  citycode: string;
  x: number;
  y: number;
  score: number;
  type: "housenumber" | "street" | "locality" | "municipality";
}

interface BanFeature {
  type: "Feature";
  geometry: {
    type: "Point";
    coordinates: [number, number]; // [lon, lat]
  };
  properties: BanFeatureProperties;
}

interface BanFeatureCollection {
  type: "FeatureCollection";
  features: BanFeature[];
}

// ---------------------------------------------------------------------------
// Normalisation
// ---------------------------------------------------------------------------

function normalizeFeature(feature: BanFeature): BanAddress {
  const p = feature.properties;
  const [lon, lat] = feature.geometry.coordinates;
  return {
    id: p.id,
    label: p.label,
    name: p.name,
    postcode: p.postcode,
    city: p.city,
    citycode: p.citycode,
    lat,
    lon,
    score: p.score,
    type: p.type,
  };
}

// ---------------------------------------------------------------------------
// Fetch helper (pas d'auth)
// ---------------------------------------------------------------------------

async function banFetch<T>(path: string): Promise<T> {
  const url = `${BAN_BASE}/${path}`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  if (!res.ok) {
    throw new Error(`[ban] HTTP ${res.status} pour ${path}`);
  }

  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// API publique
// ---------------------------------------------------------------------------

/**
 * Autocomplétion d'adresse par saisie vocale ou texte.
 *
 * @param query  Saisie libre (ex: "3 rue de rivoli paris")
 * @param limit  Nombre max de résultats (1–20, défaut 8)
 */
export async function searchAddress(
  query: string,
  limit = 8
): Promise<BanAddress[]> {
  const safeLimit = Math.min(20, Math.max(1, limit));
  const params = new URLSearchParams({
    q: query,
    limit: String(safeLimit),
  });

  const data = await banFetch<BanFeatureCollection>(`search/?${params}`);
  return data.features.map(normalizeFeature);
}

/**
 * Géocodage inverse — retrouve l'adresse la plus proche d'un point GPS.
 *
 * @param lat  Latitude WGS-84
 * @param lon  Longitude WGS-84
 */
export async function reverseGeocode(
  lat: number,
  lon: number
): Promise<BanAddress | null> {
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
  });

  const data = await banFetch<BanFeatureCollection>(`reverse/?${params}`);
  const first = data.features[0];
  return first ? normalizeFeature(first) : null;
}
