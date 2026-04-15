// ---------------------------------------------------------------------------
// Types VoixPoste — La Poste Suivi, BAN, Maileva
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// La Poste Suivi v2
// ---------------------------------------------------------------------------

/** Événement de suivi d'un colis La Poste. */
export interface TrackingEvent {
  /** Date et heure de l'événement (ISO 8601). */
  date: string;
  /** Libellé court de l'événement (ex: "En cours d'acheminement"). */
  label: string;
  /** Libellé long / message détaillé, si disponible. */
  description?: string;
  /** Localisation de l'événement (ex: "Paris Colis Lourd"). */
  location?: string;
}

/** Résultat de suivi d'un envoi. */
export interface TrackingResult {
  /** Numéro de suivi (identifiant envoi). */
  idShip: string;
  /** Libellé du produit (ex: "Colissimo", "Lettre suivie"). */
  product?: string;
  /** Statut global de l'envoi. */
  status: TrackingStatus;
  /** Libellé du statut actuel. */
  statusLabel: string;
  /** Date de livraison estimée (ISO 8601), si disponible. */
  estimatedDelivery?: string;
  /** Date de livraison effective (ISO 8601), si disponible. */
  deliveredAt?: string;
  /** Historique des événements, du plus récent au plus ancien. */
  events: TrackingEvent[];
}

export type TrackingStatus =
  | "in_transit"
  | "delivered"
  | "delivery_failed"
  | "returned"
  | "waiting_for_pickup"
  | "unknown";

/** Payload API GET /api/poste/tracking */
export interface TrackingApiResponse {
  tracking: TrackingResult;
}

// ---------------------------------------------------------------------------
// BAN / API Adresse
// ---------------------------------------------------------------------------

/** Adresse normalisée retournée par l'API Adresse BAN. */
export interface BanAddress {
  /** Identifiant BAN (ex: "75056_9575_00003"). */
  id: string;
  /** Libellé complet (ex: "3 Rue de Rivoli 75004 Paris"). */
  label: string;
  /** Numéro + nom de voie. */
  name: string;
  /** Code postal. */
  postcode: string;
  /** Nom de la ville. */
  city: string;
  /** Code INSEE de la commune. */
  citycode: string;
  /** Latitude WGS-84. */
  lat: number;
  /** Longitude WGS-84. */
  lon: number;
  /** Score de pertinence (0–1). */
  score: number;
  /** Type de résultat BAN. */
  type: "housenumber" | "street" | "locality" | "municipality";
}

/** Payload API GET /api/poste/address */
export interface AddressSearchApiResponse {
  query: string;
  addresses: BanAddress[];
}

// ---------------------------------------------------------------------------
// Maileva — courrier physique
// ---------------------------------------------------------------------------

export type MailSendingStatus =
  | "DRAFT"
  | "PENDING"
  | "PROCESSING"
  | "ACCEPTED"
  | "REJECTED"
  | "SENT";

export type LreSendingStatus =
  | "DRAFT"
  | "PENDING"
  | "PROCESSED"
  | "REJECTED"
  | "SENT"
  | "DELIVERED"
  | "AR_RECEIVED"
  | "NOT_DELIVERED";

/** Adresse postale pour un destinataire Maileva. */
export interface MailAddress {
  line1: string;
  line2?: string;
  line3?: string;
  line4?: string;
  line5?: string;
  line6: string; // "CP Ville"
  country_code?: string; // ISO 3166-1 alpha-2, défaut "FR"
}

/** Options pour l'envoi d'un courrier Maileva. */
export interface MailSendingOptions {
  /** Référence client (max 50 caractères). */
  name: string;
  /** Nom complet du destinataire (affiché sur l'enveloppe). */
  recipientName: string;
  /** Adresse postale du destinataire. */
  recipientAddress: MailAddress;
  /** Contenu PDF en base64 (ou URL accessible). */
  documentBase64?: string;
  documentUrl?: string;
  /** Options d'impression : recto/recto-verso. */
  duplex?: boolean;
  /** Couleur : "color" | "monochrome" (défaut "monochrome"). */
  colorPrinting?: "color" | "monochrome";
}

/** Statut d'un envoi Maileva. */
export interface MailSendingResult {
  id: string;
  name: string;
  status: MailSendingStatus;
  createdAt: string;
  /** Date d'envoi effective (ISO 8601). */
  sentAt?: string;
  /** Raison du rejet, si applicable. */
  rejectionReason?: string;
}

/** Options pour un recommandé électronique LRE. */
export interface LreSendingOptions {
  /** Référence client. */
  name: string;
  /** Adresse e-mail de l'expéditeur. */
  senderEmail: string;
  /** Adresse e-mail du destinataire. */
  recipientEmail: string;
  /** Nom complet du destinataire. */
  recipientName: string;
  /** Contenu du message. */
  body: string;
  /** Pièces jointes (base64). */
  attachments?: Array<{ filename: string; contentBase64: string; mimeType: string }>;
}

/** Statut d'un envoi LRE Maileva. */
export interface LreSendingResult {
  id: string;
  name: string;
  status: LreSendingStatus;
  createdAt: string;
  sentAt?: string;
  deliveredAt?: string;
  arReceivedAt?: string;
  rejectionReason?: string;
}

/** Payload API POST /api/poste/mail */
export interface MailSendingApiResponse {
  sending: MailSendingResult;
}

/** Payload API POST /api/poste/lre */
export interface LreSendingApiResponse {
  sending: LreSendingResult;
}
