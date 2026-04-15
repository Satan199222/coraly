/**
 * Client Maileva — envoi de courrier physique (Sendings API) et recommandé
 * électronique LRE (Registered Mail API).
 *
 * Documentation :
 *   - Courrier physique : https://dev.maileva.com/api-catalog/mail
 *   - LRE               : https://dev.maileva.com/api-catalog/registered-mail
 *
 * Variables d'environnement requises :
 *   MAILEVA_CLIENT_ID      — identifiant OAuth2
 *   MAILEVA_CLIENT_SECRET  — secret OAuth2
 *
 * Le token OAuth2 est mis en cache en mémoire (expiration respectée).
 *
 * Fonctions exposées :
 *   createMailSending(options)   → crée un envoi de courrier physique
 *   getMailSendingStatus(id)     → statut d'un envoi courrier
 *   createLreSending(options)    → crée un recommandé électronique LRE
 *   getLreSendingStatus(id)      → statut d'un envoi LRE
 */

import type {
  LreSendingOptions,
  LreSendingResult,
  LreSendingStatus,
  MailAddress,
  MailSendingOptions,
  MailSendingResult,
  MailSendingStatus,
} from "./types";

const MAILEVA_BASE = "https://api.maileva.com";
const MAILEVA_AUTH = "https://connect.maileva.com/auth/realms/maileva/protocol/openid-connect/token";
const FETCH_TIMEOUT_MS = 15_000;

// ---------------------------------------------------------------------------
// OAuth2 token cache
// ---------------------------------------------------------------------------

interface TokenCache {
  accessToken: string;
  expiresAt: number; // Unix ms
}

let tokenCache: TokenCache | null = null;

function getCredentials(): { clientId: string; clientSecret: string } {
  const clientId = process.env.MAILEVA_CLIENT_ID;
  const clientSecret = process.env.MAILEVA_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      "[maileva] MAILEVA_CLIENT_ID ou MAILEVA_CLIENT_SECRET absent — " +
        "créez un compte sur https://dev.maileva.com/ et configurez vos identifiants OAuth2."
    );
  }

  return { clientId, clientSecret };
}

async function getAccessToken(): Promise<string> {
  const now = Date.now();

  // Retourne le token en cache s'il est valide (marge de 60 s)
  if (tokenCache && tokenCache.expiresAt - now > 60_000) {
    return tokenCache.accessToken;
  }

  const { clientId, clientSecret } = getCredentials();

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
  });

  const res = await fetch(MAILEVA_AUTH, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`[maileva] Authentification OAuth2 échouée — HTTP ${res.status}: ${text}`);
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };
  tokenCache = {
    accessToken: data.access_token,
    expiresAt: now + data.expires_in * 1000,
  };

  return tokenCache.accessToken;
}

// ---------------------------------------------------------------------------
// Fetch helper authentifié
// ---------------------------------------------------------------------------

async function malevaFetch<T>(
  method: "GET" | "POST" | "DELETE",
  path: string,
  body?: unknown
): Promise<T> {
  const token = await getAccessToken();
  const url = `${MAILEVA_BASE}/${path}`;

  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`[maileva] HTTP ${res.status} pour ${method} ${path} — ${text}`);
  }

  // 204 No Content
  if (res.status === 204) return undefined as T;

  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Types bruts Maileva Sendings API
// ---------------------------------------------------------------------------

interface MalevaRecipient {
  address_line_1: string;
  address_line_2?: string;
  address_line_3?: string;
  address_line_4?: string;
  address_line_5?: string;
  address_line_6: string;
  country_code?: string;
  custom_id?: string;
  custom_data?: string;
}

interface MalevaSendingBody {
  name: string;
  postage_type?: "ECOPLI" | "LETTRE_PRIORITAIRE" | "LETTRE_RECOMMANDEE" | "LETTRE_RECOMMANDEE_AR";
  color_printing?: "COLOR" | "MONOCHROME";
  duplex_printing?: boolean;
  envelope_window_type?: "SIMPLE" | "DOUBLE" | "NONE";
  recipients: MalevaRecipient[];
  documents?: Array<{ content: string; priority: number }>; // base64 PDF
}

interface MalevaSendingResponse {
  id: string;
  name: string;
  status: string;
  created_at: string;
  sent_at?: string;
  rejection_reason?: string;
}

// ---------------------------------------------------------------------------
// Types bruts Maileva LRE API
// ---------------------------------------------------------------------------

interface MalevaLreBody {
  name: string;
  sender_email: string;
  recipients: Array<{
    email: string;
    name: string;
  }>;
  subject?: string;
  body: string;
  attachments?: Array<{
    filename: string;
    content: string; // base64
    content_type: string;
  }>;
}

interface MalevaLreResponse {
  id: string;
  name: string;
  status: string;
  created_at: string;
  sent_at?: string;
  delivered_at?: string;
  ar_received_at?: string;
  rejection_reason?: string;
}

// ---------------------------------------------------------------------------
// Normalisation adresse → Maileva format
// ---------------------------------------------------------------------------

function normalizeAddress(addr: MailAddress): MalevaRecipient {
  return {
    address_line_1: addr.line1,
    address_line_2: addr.line2,
    address_line_3: addr.line3,
    address_line_4: addr.line4,
    address_line_5: addr.line5,
    address_line_6: addr.line6,
    country_code: addr.country_code ?? "FR",
  };
}

function normalizeMailStatus(raw: string): MailSendingStatus {
  const s = raw.toUpperCase();
  if (
    s === "DRAFT" ||
    s === "PENDING" ||
    s === "PROCESSING" ||
    s === "ACCEPTED" ||
    s === "REJECTED" ||
    s === "SENT"
  ) {
    return s as MailSendingStatus;
  }
  return "PENDING";
}

function normalizeLreStatus(raw: string): LreSendingStatus {
  const s = raw.toUpperCase();
  const valid: LreSendingStatus[] = [
    "DRAFT", "PENDING", "PROCESSED", "REJECTED", "SENT",
    "DELIVERED", "AR_RECEIVED", "NOT_DELIVERED",
  ];
  return valid.includes(s as LreSendingStatus) ? (s as LreSendingStatus) : "PENDING";
}

function normalizeMailSending(raw: MalevaSendingResponse): MailSendingResult {
  return {
    id: raw.id,
    name: raw.name,
    status: normalizeMailStatus(raw.status),
    createdAt: raw.created_at,
    sentAt: raw.sent_at,
    rejectionReason: raw.rejection_reason,
  };
}

function normalizeLreSending(raw: MalevaLreResponse): LreSendingResult {
  return {
    id: raw.id,
    name: raw.name,
    status: normalizeLreStatus(raw.status),
    createdAt: raw.created_at,
    sentAt: raw.sent_at,
    deliveredAt: raw.delivered_at,
    arReceivedAt: raw.ar_received_at,
    rejectionReason: raw.rejection_reason,
  };
}

// ---------------------------------------------------------------------------
// API publique — courrier physique
// ---------------------------------------------------------------------------

/**
 * Crée un envoi de courrier physique via Maileva Sendings API.
 *
 * Le document doit être fourni soit en base64 (`documentBase64`) soit via URL
 * (`documentUrl`). Si les deux sont fournis, `documentBase64` est prioritaire.
 */
export async function createMailSending(
  options: MailSendingOptions
): Promise<MailSendingResult> {
  const recipient = normalizeAddress(options.recipientAddress);
  recipient.address_line_1 = options.recipientName;

  const body: MalevaSendingBody = {
    name: options.name,
    color_printing: options.colorPrinting === "color" ? "COLOR" : "MONOCHROME",
    duplex_printing: options.duplex ?? false,
    recipients: [recipient],
  };

  if (options.documentBase64) {
    body.documents = [{ content: options.documentBase64, priority: 1 }];
  } else if (options.documentUrl) {
    // Maileva accepte également les documents par URL en les téléchargeant.
    // On délègue au caller de fournir le base64 si l'URL n'est pas accessible
    // depuis les serveurs Maileva.
    console.warn(
      "[maileva] documentUrl fourni — assurez-vous que l'URL est accessible publiquement par Maileva."
    );
    body.documents = [{ content: options.documentUrl, priority: 1 }];
  }

  const raw = await malevaFetch<MalevaSendingResponse>(
    "POST",
    "mail/v2/sendings",
    body
  );

  return normalizeMailSending(raw);
}

/**
 * Retourne le statut d'un envoi courrier physique.
 *
 * @param sendingId  Identifiant retourné par `createMailSending`
 */
export async function getMailSendingStatus(
  sendingId: string
): Promise<MailSendingResult> {
  const raw = await malevaFetch<MalevaSendingResponse>(
    "GET",
    `mail/v2/sendings/${encodeURIComponent(sendingId)}`
  );

  return normalizeMailSending(raw);
}

// ---------------------------------------------------------------------------
// API publique — recommandé électronique LRE
// ---------------------------------------------------------------------------

/**
 * Crée un envoi de recommandé électronique LRE via Maileva.
 */
export async function createLreSending(
  options: LreSendingOptions
): Promise<LreSendingResult> {
  const body: MalevaLreBody = {
    name: options.name,
    sender_email: options.senderEmail,
    recipients: [{ email: options.recipientEmail, name: options.recipientName }],
    body: options.body,
    attachments: options.attachments?.map((a) => ({
      filename: a.filename,
      content: a.contentBase64,
      content_type: a.mimeType,
    })),
  };

  const raw = await malevaFetch<MalevaLreResponse>(
    "POST",
    "registered_mail/v1/sendings",
    body
  );

  return normalizeLreSending(raw);
}

/**
 * Retourne le statut d'un envoi LRE.
 *
 * @param sendingId  Identifiant retourné par `createLreSending`
 */
export async function getLreSendingStatus(
  sendingId: string
): Promise<LreSendingResult> {
  const raw = await malevaFetch<MalevaLreResponse>(
    "GET",
    `registered_mail/v1/sendings/${encodeURIComponent(sendingId)}`
  );

  return normalizeLreSending(raw);
}
