/**
 * Client La Poste Suivi v2.
 *
 * Documentation : https://developer.laposte.fr/products/suivi/2
 *
 * Variables d'environnement requises :
 *   LAPOSTE_API_KEY   — clé API obtenue sur https://developer.laposte.fr/
 *
 * Fonctions exposées :
 *   trackShipment(idShip)   → suivi d'un envoi par numéro de colis
 */

import type { TrackingEvent, TrackingResult, TrackingStatus } from "./types";

const LAPOSTE_BASE = "https://api.laposte.fr/suivi/v2";
const FETCH_TIMEOUT_MS = 10_000;

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

function getApiKey(): string {
  const key = process.env.LAPOSTE_API_KEY;
  if (!key) {
    throw new Error(
      "[laposte] LAPOSTE_API_KEY absent — créez un compte sur https://developer.laposte.fr/ et souscrivez à l'API Suivi v2."
    );
  }
  return key;
}

async function laposteFetch<T>(path: string): Promise<T> {
  const url = `${LAPOSTE_BASE}/${path}`;
  const res = await fetch(url, {
    headers: {
      "X-Okapi-Key": getApiKey(),
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`[laposte] HTTP ${res.status} pour ${path} — ${body}`);
  }

  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Types bruts La Poste Suivi v2
// ---------------------------------------------------------------------------

interface LaPosteEvent {
  /** ISO 8601 ou format La Poste "YYYY-MM-DDTHH:mm:ss+02:00". */
  date: string;
  label: string;
  location?: string;
  description?: string;
}

interface LaPosteIdShip {
  idShip: string;
  product?: string;
  isFinal: boolean;
  isDelivered?: boolean;
  estimatedDeliveryDate?: string;
  deliveryDate?: string;
  event: LaPosteEvent[];
  returnedByConsignee?: boolean;
  returnedByPostman?: boolean;
  waitingForPickup?: boolean;
}

interface LaPosteSuiviResponse {
  shipment?: LaPosteIdShip;
  returnCode?: number;
  returnMessage?: string;
}

// ---------------------------------------------------------------------------
// Normalisation
// ---------------------------------------------------------------------------

function mapStatus(ship: LaPosteIdShip): TrackingStatus {
  if (ship.isDelivered) return "delivered";
  if (ship.returnedByConsignee || ship.returnedByPostman) return "returned";
  if (ship.waitingForPickup) return "waiting_for_pickup";
  if (ship.isFinal) return "delivery_failed";
  return "in_transit";
}

function normalizeEvent(ev: LaPosteEvent): TrackingEvent {
  return {
    date: ev.date,
    label: ev.label,
    description: ev.description,
    location: ev.location,
  };
}

function normalizeShipment(ship: LaPosteIdShip): TrackingResult {
  const status = mapStatus(ship);
  const events = (ship.event ?? []).map(normalizeEvent);

  // La Poste renvoie les événements du plus récent au plus ancien — on conserve cet ordre.
  const statusLabel = events[0]?.label ?? "Inconnu";

  return {
    idShip: ship.idShip,
    product: ship.product,
    status,
    statusLabel,
    estimatedDelivery: ship.estimatedDeliveryDate,
    deliveredAt: ship.deliveryDate,
    events,
  };
}

// ---------------------------------------------------------------------------
// API publique
// ---------------------------------------------------------------------------

/**
 * Suit un envoi La Poste par numéro de colis.
 *
 * @param idShip  Numéro de suivi (ex: "6T12345678901" pour un Colissimo)
 * @throws Error si l'envoi est introuvable ou si l'API retourne une erreur
 */
export async function trackShipment(idShip: string): Promise<TrackingResult> {
  const normalized = idShip.trim().toUpperCase();
  const data = await laposteFetch<LaPosteSuiviResponse>(
    `idships/${encodeURIComponent(normalized)}?lang=fr_FR`
  );

  if (!data.shipment) {
    const msg = data.returnMessage ?? "Envoi introuvable";
    throw new Error(`[laposte] ${msg} (code: ${data.returnCode ?? "N/A"})`);
  }

  return normalizeShipment(data.shipment);
}
