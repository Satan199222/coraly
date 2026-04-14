/**
 * Referral system — génération, validation, conversion et récompenses.
 *
 * Stockage : Upstash Redis (même instance que le rate-limiter).
 * Fallback dev/CI : Map in-process (non persistant entre instances).
 *
 * Structure des clés Redis :
 *   referral:code:{CODE}         → ReferralCodeEntry  (code → propriétaire)
 *   referral:email:{email}       → string (code)      (email → code)
 *   referral:conv:{CODE}:{email} → ReferralConvEntry  (dédup conversion)
 *   referral:reward:{email}      → ReferralRewardEntry (récompense active)
 *
 * Toutes les clés sont persistantes (pas de TTL). Un email ne peut avoir
 * qu'un seul code ; une paire (parrain, filleul) qu'une seule conversion.
 */

import { Redis } from "@upstash/redis";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ReferralCodeEntry {
  email: string;
  createdAt: string; // ISO 8601
}

export interface ReferralConvEntry {
  referrerCode: string;
  convertedAt: string;
  rewarded: boolean;
}

export interface ReferralRewardEntry {
  months: number;
  grantedAt: string;
  fromCode: string | null;
}

// ---------------------------------------------------------------------------
// Redis client (singleton, lazy)
// ---------------------------------------------------------------------------

let redisClient: Redis | null | undefined; // undefined = not yet tried

function getRedis(): Redis | null {
  if (redisClient !== undefined) return redisClient;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    console.warn(
      "[referral] UPSTASH_REDIS_REST_URL/TOKEN absent — fallback mémoire (non persistant)."
    );
    redisClient = null;
    return null;
  }

  redisClient = new Redis({ url, token });
  return redisClient;
}

// ---------------------------------------------------------------------------
// In-memory fallback (dev / CI)
// ---------------------------------------------------------------------------

interface MemStore {
  codes: Map<string, ReferralCodeEntry>; // code → entry
  emails: Map<string, string>; // email → code
  conversions: Map<string, ReferralConvEntry>; // `${code}:${email}` → entry
  rewards: Map<string, ReferralRewardEntry>; // email → reward
}

function getMem(): MemStore {
  // @ts-expect-error global augmentation pour Fluid Compute
  return (globalThis.__vc_referral ??= {
    codes: new Map(),
    emails: new Map(),
    conversions: new Map(),
    rewards: new Map(),
  });
}

// ---------------------------------------------------------------------------
// Code generation
// ---------------------------------------------------------------------------

const CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sans I, O, 0, 1 (ambiguïté visuelle)
const CODE_LENGTH = 8;

/**
 * Génère un code referral aléatoire de 8 caractères alphanumériques.
 * Insensible à la casse (stocké en majuscules).
 */
export function generateReferralCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CHARSET[Math.floor(Math.random() * CHARSET.length)];
  }
  return code;
}

/**
 * Normalise un code referral : majuscules, espaces trimés.
 * Les codes sont toujours stockés et comparés en majuscules.
 */
export function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}

// ---------------------------------------------------------------------------
// Core operations
// ---------------------------------------------------------------------------

/**
 * Crée ou retrouve le code referral d'un utilisateur identifié par son email.
 * Idempotent : si un code existe déjà pour cet email, le retourne.
 * Retourne le code (8 caractères, majuscules).
 */
export async function getOrCreateReferralCode(email: string): Promise<string> {
  const normalizedEmail = email.toLowerCase().trim();
  const redis = getRedis();

  if (redis) {
    // Lookup existant
    const existing = await redis.get<string>(
      `referral:email:${normalizedEmail}`
    );
    if (existing) return existing;

    // Génération avec unicité garantie (retry jusqu'à trouver un code libre)
    let code: string;
    let attempts = 0;
    do {
      code = generateReferralCode();
      attempts++;
      if (attempts > 10) {
        // Théoriquement impossible avec 32^8 possibilités
        throw new Error("[referral] Impossible de générer un code unique");
      }
    } while (await redis.exists(`referral:code:${code}`));

    const entry: ReferralCodeEntry = {
      email: normalizedEmail,
      createdAt: new Date().toISOString(),
    };

    // Pipeline atomique : code → email + email → code
    await redis.mset({
      [`referral:code:${code}`]: JSON.stringify(entry),
      [`referral:email:${normalizedEmail}`]: code,
    });

    console.info(`[referral] Code créé: ${code} pour ${normalizedEmail}`);
    return code;
  }

  // Fallback mémoire
  const store = getMem();
  const existing = store.emails.get(normalizedEmail);
  if (existing) return existing;

  let code: string;
  do {
    code = generateReferralCode();
  } while (store.codes.has(code));

  const entry: ReferralCodeEntry = {
    email: normalizedEmail,
    createdAt: new Date().toISOString(),
  };
  store.codes.set(code, entry);
  store.emails.set(normalizedEmail, code);
  console.info(`[referral] Code créé (mem): ${code} pour ${normalizedEmail}`);
  return code;
}

/**
 * Valide un code referral et retourne les infos du propriétaire si valide.
 * Retourne null si le code n'existe pas.
 */
export async function validateReferralCode(
  code: string
): Promise<ReferralCodeEntry | null> {
  const normalized = normalizeCode(code);
  const redis = getRedis();

  if (redis) {
    const raw = await redis.get<string>(`referral:code:${normalized}`);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as ReferralCodeEntry;
    } catch (err) {
      console.error("[referral] Erreur parsing entry Redis:", err);
      return null;
    }
  }

  return getMem().codes.get(normalized) ?? null;
}

/**
 * Enregistre une conversion referral : un filleul s'inscrit via un code.
 *
 * - Vérifie que le code existe.
 * - Déduplication : une paire (parrain, filleul) ne peut convertir qu'une fois.
 * - Accorde 2 mois de premium au parrain ET au filleul.
 * - Log la conversion côté serveur.
 *
 * Retourne `{ ok: true }` si succès, ou `{ ok: false, reason }` si invalide.
 */
export async function recordConversion(
  referrerCode: string,
  referreeEmail: string
): Promise<{ ok: boolean; reason?: string }> {
  const normalizedCode = normalizeCode(referrerCode);
  const normalizedReferreeEmail = referreeEmail.toLowerCase().trim();

  const codeEntry = await validateReferralCode(normalizedCode);
  if (!codeEntry) {
    return { ok: false, reason: "code_invalide" };
  }

  // Auto-referral interdit
  if (codeEntry.email === normalizedReferreeEmail) {
    return { ok: false, reason: "auto_referral" };
  }

  const convKey = `${normalizedCode}:${normalizedReferreeEmail}`;
  const redis = getRedis();

  if (redis) {
    const existing = await redis.get(`referral:conv:${convKey}`);
    if (existing) {
      return { ok: false, reason: "conversion_deja_enregistree" };
    }

    const convEntry: ReferralConvEntry = {
      referrerCode: normalizedCode,
      convertedAt: new Date().toISOString(),
      rewarded: true,
    };

    const referrerReward: ReferralRewardEntry = {
      months: 2,
      grantedAt: new Date().toISOString(),
      fromCode: null,
    };
    const referreeReward: ReferralRewardEntry = {
      months: 2,
      grantedAt: new Date().toISOString(),
      fromCode: normalizedCode,
    };

    // Écriture atomique groupée
    await redis.mset({
      [`referral:conv:${convKey}`]: JSON.stringify(convEntry),
      [`referral:reward:${codeEntry.email}`]: JSON.stringify(referrerReward),
      [`referral:reward:${normalizedReferreeEmail}`]:
        JSON.stringify(referreeReward),
    });

    console.info(
      `[referral] Conversion enregistrée — parrain: ${codeEntry.email} (code: ${normalizedCode}), filleul: ${normalizedReferreeEmail}. Récompense : 2 mois chacun.`
    );
    return { ok: true };
  }

  // Fallback mémoire
  const store = getMem();
  if (store.conversions.has(convKey)) {
    return { ok: false, reason: "conversion_deja_enregistree" };
  }

  store.conversions.set(convKey, {
    referrerCode: normalizedCode,
    convertedAt: new Date().toISOString(),
    rewarded: true,
  });
  store.rewards.set(codeEntry.email, {
    months: 2,
    grantedAt: new Date().toISOString(),
    fromCode: null,
  });
  store.rewards.set(normalizedReferreeEmail, {
    months: 2,
    grantedAt: new Date().toISOString(),
    fromCode: normalizedCode,
  });
  console.info(
    `[referral] Conversion enregistrée (mem) — parrain: ${codeEntry.email}, filleul: ${normalizedReferreeEmail}`
  );
  return { ok: true };
}

/**
 * Récupère la récompense active d'un utilisateur (si elle existe).
 * Retourne null si aucune récompense n'a été accordée.
 */
export async function getReferralReward(
  email: string
): Promise<ReferralRewardEntry | null> {
  const normalizedEmail = email.toLowerCase().trim();
  const redis = getRedis();

  if (redis) {
    const raw = await redis.get<string>(`referral:reward:${normalizedEmail}`);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as ReferralRewardEntry;
    } catch (err) {
      console.error("[referral] Erreur parsing reward Redis:", err);
      return null;
    }
  }

  return getMem().rewards.get(normalizedEmail) ?? null;
}

/**
 * Construit l'URL de parrainage complète à partir d'un code.
 */
export function buildReferralLink(
  code: string,
  baseUrl = "https://voixcourses.fr"
): string {
  return `${baseUrl}/invitation/${encodeURIComponent(code)}`;
}
