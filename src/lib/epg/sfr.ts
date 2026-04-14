/**
 * lib/epg/sfr.ts — Abstraction source EPG SFR
 *
 * Fetch et parse le guide EPG SFR (gen8) pour une date donnée.
 * URL source : https://static-cdn.tv.sfr.net/data/epg/gen8/guide_web_YYYYMMDD.json
 *
 * Format JSON SFR :
 * {
 *   "channels": [
 *     {
 *       "channelId": 192,
 *       "name": "TF1",
 *       "programs": [
 *         {
 *           "programId": "...",
 *           "title": "...",
 *           "subtitle": "...",
 *           "genre": { "name": "..." },
 *           "synopsis": "...",
 *           "startTime": 1704067200,   // Unix timestamp (secondes)
 *           "duration": 3600,           // durée en secondes
 *           "image": "https://...",
 *           "season": 1,
 *           "episode": 2
 *         }
 *       ]
 *     }
 *   ]
 * }
 */

/** Programme brut retourné par l'API SFR EPG */
export interface SfrRawProgram {
  programId?: string;
  title?: string;
  subtitle?: string;
  genre?: { name?: string } | string | null;
  synopsis?: string;
  startTime?: number; // Unix timestamp en secondes
  duration?: number;  // secondes
  image?: string;
  season?: number;
  episode?: number;
  [key: string]: unknown;
}

/** Chaîne brute retournée par l'API SFR EPG */
export interface SfrRawChannel {
  channelId?: number;
  name?: string;
  programs?: SfrRawProgram[];
  [key: string]: unknown;
}

/** Réponse brute complète de l'API SFR EPG */
export interface SfrEpgResponse {
  channels?: SfrRawChannel[];
  [key: string]: unknown;
}

/** Programme normalisé après parsing */
export interface SfrProgram {
  sfrEpgId: number;
  title: string;
  subtitle: string | null;
  genre: string | null;
  synopsis: string | null;
  startAt: Date;
  endAt: Date;
  imageUrl: string | null;
  season: number | null;
  episode: number | null;
}

/** Groupe de programmes par chaîne */
export interface SfrChannelPrograms {
  sfrEpgId: number;
  programs: SfrProgram[];
}

/**
 * Formate une date en YYYYMMDD pour l'URL SFR EPG.
 */
export function formatDateSfr(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

/**
 * Construit l'URL de l'EPG SFR pour une date donnée.
 */
export function buildSfrEpgUrl(date: Date): string {
  return `https://static-cdn.tv.sfr.net/data/epg/gen8/guide_web_${formatDateSfr(date)}.json`;
}

/**
 * Extrait le nom du genre depuis la structure variable de l'API SFR.
 * Le champ "genre" peut être un objet { name: "..." } ou une chaîne.
 */
function extractGenreName(genre: SfrRawProgram["genre"]): string | null {
  if (!genre) return null;
  if (typeof genre === "string") return genre || null;
  if (typeof genre === "object" && typeof genre.name === "string") {
    return genre.name || null;
  }
  return null;
}

/**
 * Parse un programme SFR brut en SfrProgram normalisé.
 * Retourne null si les champs obligatoires (titre, startTime, duration) sont manquants.
 */
function parseSfrProgram(raw: SfrRawProgram, sfrEpgId: number): SfrProgram | null {
  const title = typeof raw.title === "string" ? raw.title.trim() : "";
  if (!title) {
    console.warn("[epg/sfr] Programme sans titre ignoré (channelId=%d)", sfrEpgId);
    return null;
  }

  const startTime = typeof raw.startTime === "number" ? raw.startTime : null;
  const duration = typeof raw.duration === "number" ? raw.duration : null;

  if (startTime === null || duration === null || duration <= 0) {
    console.warn("[epg/sfr] Programme sans startTime/duration ignoré (channelId=%d, title=%s)", sfrEpgId, title);
    return null;
  }

  const startAt = new Date(startTime * 1000);
  const endAt = new Date((startTime + duration) * 1000);

  return {
    sfrEpgId,
    title,
    subtitle: typeof raw.subtitle === "string" && raw.subtitle.trim() ? raw.subtitle.trim() : null,
    genre: extractGenreName(raw.genre),
    synopsis: typeof raw.synopsis === "string" && raw.synopsis.trim() ? raw.synopsis.trim() : null,
    startAt,
    endAt,
    imageUrl: typeof raw.image === "string" && raw.image.trim() ? raw.image.trim() : null,
    season: typeof raw.season === "number" ? raw.season : null,
    episode: typeof raw.episode === "number" ? raw.episode : null,
  };
}

/**
 * Fetch et parse l'EPG SFR pour une date donnée.
 *
 * @param date - La date cible (UTC)
 * @param validSfrIds - Ensemble des sfrEpgId à conserver (chaînes TNT mappées)
 * @returns Tableau de SfrChannelPrograms pour les chaînes valides uniquement
 */
export async function fetchSfrEpg(
  date: Date,
  validSfrIds: Set<number>,
): Promise<SfrChannelPrograms[]> {
  const url = buildSfrEpgUrl(date);
  console.info("[epg/sfr] Fetch EPG : %s", url);

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { "Accept": "application/json" },
      // next.js cache désactivé — on veut toujours la donnée fraîche
      cache: "no-store",
    });
  } catch (err) {
    console.error("[epg/sfr] Erreur réseau lors du fetch EPG (%s) :", url, err);
    throw new Error(`[epg/sfr] Fetch EPG réseau échoué : ${String(err)}`);
  }

  if (!response.ok) {
    console.error("[epg/sfr] Réponse HTTP %d pour %s", response.status, url);
    throw new Error(`[epg/sfr] HTTP ${response.status} pour ${url}`);
  }

  let json: SfrEpgResponse;
  try {
    json = (await response.json()) as SfrEpgResponse;
  } catch (err) {
    console.error("[epg/sfr] JSON invalide reçu de %s :", url, err);
    throw new Error(`[epg/sfr] Parse JSON échoué : ${String(err)}`);
  }

  if (!Array.isArray(json.channels)) {
    console.error("[epg/sfr] Réponse inattendue — champ 'channels' absent ou non-tableau");
    throw new Error("[epg/sfr] Format EPG SFR inattendu : 'channels' manquant");
  }

  const result: SfrChannelPrograms[] = [];

  for (const channel of json.channels) {
    const sfrEpgId = typeof channel.channelId === "number" ? channel.channelId : null;
    if (sfrEpgId === null || !validSfrIds.has(sfrEpgId)) continue;

    if (!Array.isArray(channel.programs)) {
      console.warn("[epg/sfr] Chaîne %d sans tableau programs — ignorée", sfrEpgId);
      continue;
    }

    const programs: SfrProgram[] = [];
    for (const rawProg of channel.programs) {
      const parsed = parseSfrProgram(rawProg, sfrEpgId);
      if (parsed) programs.push(parsed);
    }

    result.push({ sfrEpgId, programs });
  }

  console.info(
    "[epg/sfr] EPG parsé : %d chaînes, %d programmes total",
    result.length,
    result.reduce((acc, c) => acc + c.programs.length, 0),
  );

  return result;
}
