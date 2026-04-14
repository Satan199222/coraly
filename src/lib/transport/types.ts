// ---------------------------------------------------------------------------
// Types Navitia API (réponses brutes)
// ---------------------------------------------------------------------------

export interface NavitiaCoords {
  lat: number;
  lon: number;
}

export interface NavitiaStopArea {
  id: string;
  name: string;
  label: string;
  coord: NavitiaCoords;
  timezone: string;
}

export interface NavitiaAddress {
  id: string;
  name: string;
  label: string;
  coord: NavitiaCoords;
  house_number: number;
}

export interface NavitiaPlace {
  id: string;
  name: string;
  quality: number;
  embedded_type: "stop_area" | "address" | "poi" | "administrative_region";
  stop_area?: NavitiaStopArea;
  address?: NavitiaAddress;
}

export interface NavitiaDisplayInfo {
  network: string;
  direction: string;
  label: string;
  color: string;
  text_color: string;
  commercial_mode: string;
  physical_mode: string;
  description: string;
}

export interface NavitiaStopDateTime {
  stop_point: {
    id: string;
    name: string;
    label: string;
    coord: NavitiaCoords;
  };
  departure_date_time: string;
  arrival_date_time: string;
}

export interface NavitiaSection {
  type:
    | "public_transport"
    | "street_network"
    | "waiting"
    | "transfer"
    | "crow_fly";
  duration: number; // secondes
  departure_date_time: string; // YYYYMMDDTHHMMSS
  arrival_date_time: string;
  from?: NavitiaPlace;
  to?: NavitiaPlace;
  display_informations?: NavitiaDisplayInfo;
  stop_date_times?: NavitiaStopDateTime[];
}

export interface NavitiaFare {
  total: { value: string; currency: string };
  found: boolean;
}

export interface NavitiaJourney {
  duration: number; // secondes
  departure_date_time: string;
  arrival_date_time: string;
  nb_transfers: number;
  sections: NavitiaSection[];
  fare: NavitiaFare;
}

// ---------------------------------------------------------------------------
// Types normalisés pour l'UI
// ---------------------------------------------------------------------------

export interface TransportStop {
  id: string;
  name: string;
  label: string;
  lat: number;
  lon: number;
  type: NavitiaPlace["embedded_type"];
}

export interface TransportLeg {
  type: "transit" | "walk" | "wait";
  duration: number; // secondes
  from?: string;
  to?: string;
  lineName?: string;
  lineColor?: string;
  direction?: string;
  mode?: string;
  stops?: string[];
}

export interface TransportJourney {
  id: string;
  totalDuration: number; // secondes
  transfers: number;
  departure: string; // ISO 8601
  arrival: string;
  legs: TransportLeg[];
  fare?: { amount: string; currency: string };
}

// ---------------------------------------------------------------------------
// Payloads API
// ---------------------------------------------------------------------------

export interface StopsApiResponse {
  stops: TransportStop[];
}

export interface JourneyApiResponse {
  journeys: TransportJourney[];
}
