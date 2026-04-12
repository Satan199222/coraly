/**
 * Client ScrapFly pour les requêtes carrefour.fr.
 *
 * Pourquoi ScrapFly : Cloudflare Managed Challenge bloque les IPs datacenter
 * (Vercel, Browserless free, etc.). ScrapFly intègre un "Anti-Scraping
 * Protection" (`asp=true`) qui résout Cloudflare en natif.
 *
 * Stratégie deux-temps (validée empiriquement) :
 * 1. **Warmup session** : GET `/` avec `render_js=true` → résout le challenge
 *    JS Cloudflare, pose les cookies `cf_clearance` dans la session (30 min).
 *    Coût : ~80 credits (une fois par instance Vercel + renouvelé toutes les
 *    25 min).
 * 2. **Calls API** dans la même session avec `asp=true` mais `render_js=false`
 *    → Carrefour honore `x-requested-with` et répond en JSON.
 *    Coût : ~40 credits par call.
 *
 * Sans warmup, Carrefour retourne du HTML (ignore `x-requested-with` sur les
 * requêtes non-authentifiées par cf_clearance).
 *
 * Format headers critique : ScrapFly attend `headers[name]=value` (bracket
 * notation PHP-style), PAS un JSON stringifié.
 */

const SCRAPFLY_ENDPOINT = "https://api.scrapfly.io/scrape";
const CARREFOUR_ORIGIN = "https://www.carrefour.fr";

/** Session globale partagée par l'instance Fluid Compute.
 *  Réutilisée entre requêtes pour amortir le coût du warmup (80 cr) sur
 *  plusieurs user calls. */
const GLOBAL_SESSION = "voixcourses-main";
/** Durée de vie cookies Cloudflare — on re-warmup avant expiration. */
const SESSION_LIFETIME_MS = 25 * 60 * 1000; // 25 min (marge de 5 min)

// Map session → last warmup timestamp. Partagée entre requêtes d'une instance
// Fluid Compute. Si plusieurs sessions (multi-store), on tracke chacune.
// @ts-expect-error globalThis augment pour réutilisation entre requêtes
const warmupCache: Map<string, number> = (globalThis.__vc_warmup ??= new Map());

// Single-flight : si N requêtes arrivent en parallèle et doivent toutes
// warmup, on partage UNE seule Promise warmup pour éviter le rate limit
// ScrapFly (429 Too Many Requests) quand 5 search déclenchent 5 warmups.
// @ts-expect-error globalThis augment
const warmupInflight: Map<string, Promise<void>> = (globalThis.__vc_warmup_inflight ??= new Map());

interface ScrapflyOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: string;
  headers?: Record<string, string>;
  /** Session partagée (même user, même magasin) pour préserver cookies. */
  session?: string;
  /** Force render_js=true (scraper HTML avec exécution JS). Coûte +5 credits. */
  renderJs?: boolean;
}

interface ScrapflyResponse {
  result?: {
    content: string;
    content_format: string;
    content_type?: string;
    status_code: number;
    success: boolean;
    error?: { code: string; message: string } | null;
    url: string;
  };
  context?: {
    cost?: { total?: number };
  };
}

/**
 * Construit l'URL ScrapFly avec bracket notation pour les headers.
 * `URLSearchParams` ne supporte pas les [] dans les clés → construction manuelle.
 */
function buildScrapflyUrl(params: {
  targetUrl: string;
  asp: boolean;
  renderJs: boolean;
  session?: string;
  method?: string;
  body?: string;
  forwardHeaders?: Record<string, string>;
  waitForSelector?: string;
}): string {
  const apiKey = process.env.SCRAPFLY_API_KEY;
  if (!apiKey) {
    throw new Error(
      "SCRAPFLY_API_KEY manquant. Configurez la variable d'environnement."
    );
  }

  const parts: string[] = [
    `key=${encodeURIComponent(apiKey)}`,
    `url=${encodeURIComponent(params.targetUrl)}`,
    `country=fr`,
  ];
  if (params.asp) parts.push("asp=true");
  if (params.renderJs) parts.push("render_js=true");
  if (params.session) {
    parts.push(`session=${encodeURIComponent(params.session)}`);
    parts.push("session_sticky_proxy=true");
  }
  if (params.waitForSelector) {
    parts.push(`wait_for_selector=${encodeURIComponent(params.waitForSelector)}`);
  }
  if (params.method && params.method !== "GET") {
    parts.push(`method=${params.method}`);
  }
  if (params.body) {
    parts.push(`body=${encodeURIComponent(params.body)}`);
  }
  // Bracket notation : headers[name]=value (ScrapFly spec)
  if (params.forwardHeaders) {
    for (const [name, value] of Object.entries(params.forwardHeaders)) {
      parts.push(`headers[${encodeURIComponent(name)}]=${encodeURIComponent(value)}`);
    }
  }
  return `${SCRAPFLY_ENDPOINT}?${parts.join("&")}`;
}

/**
 * Résout le challenge Cloudflare pour cette session.
 *
 * Idempotent ET single-flight :
 * - Si session valide (warmup récent) → no-op
 * - Si warmup déjà en cours → attend la même Promise (pas de duplicate call)
 * - Sinon → exécute le warmup et cache le résultat
 *
 * Le single-flight évite les 429 ScrapFly quand N requêtes parallèles
 * (ex: Promise.allSettled sur 5 search produits) déclenchent toutes le
 * warmup en même temps sur une session froide.
 */
async function ensureWarmup(session: string): Promise<void> {
  const last = warmupCache.get(session);
  const now = Date.now();
  if (last && now - last < SESSION_LIFETIME_MS) {
    return; // session toujours valide
  }

  // Déjà en cours : rejoindre la Promise existante au lieu d'en créer une nouvelle
  const inflight = warmupInflight.get(session);
  if (inflight) return inflight;

  const promise = doWarmup(session).finally(() => {
    warmupInflight.delete(session);
  });
  warmupInflight.set(session, promise);
  return promise;
}

async function doWarmup(session: string): Promise<void> {
  const url = buildScrapflyUrl({
    targetUrl: `${CARREFOUR_ORIGIN}/`,
    asp: true,
    renderJs: true,
    session,
  });
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(
      `ScrapFly warmup HTTP ${res.status} : ${err.slice(0, 200)}`
    );
  }
  const wrapper = (await res.json()) as ScrapflyResponse;
  if (!wrapper.result?.success) {
    throw new Error(
      `ScrapFly warmup failed : ${wrapper.result?.error?.message ?? "inconnu"}`
    );
  }
  warmupCache.set(session, Date.now());
}

/**
 * Execute une requête vers carrefour.fr via ScrapFly.
 * Garantit qu'un warmup Cloudflare a été fait dans la session avant le call.
 */
export async function scrapflyFetch<T>(
  path: string,
  options: ScrapflyOptions = {}
): Promise<T> {
  const session = options.session ?? GLOBAL_SESSION;

  // Warmup si nécessaire (n'a lieu que si session expirée)
  await ensureWarmup(session);

  const targetUrl = path.startsWith("http") ? path : `${CARREFOUR_ORIGIN}${path}`;

  // `x-requested-with: XMLHttpRequest` est CRITIQUE : sans lui, Carrefour
  // retourne du HTML au lieu du JSON, même avec Cloudflare passé.
  const forwardHeaders: Record<string, string> = {
    "x-requested-with": "XMLHttpRequest",
    accept: "application/json",
    referer: `${CARREFOUR_ORIGIN}/`,
    ...options.headers,
  };

  const url = buildScrapflyUrl({
    targetUrl,
    asp: true,
    renderJs: options.renderJs ?? false,
    session,
    method: options.method,
    body: options.body,
    forwardHeaders,
  });

  const res = await fetch(url);

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(
      `ScrapFly HTTP ${res.status} : ${errText.slice(0, 300)}`
    );
  }

  const wrapper = (await res.json()) as ScrapflyResponse;

  if (!wrapper.result?.success) {
    throw new Error(
      `ScrapFly échec : ${wrapper.result?.error?.message ?? "inconnu"}`
    );
  }

  const status = wrapper.result.status_code;
  const content = wrapper.result.content;
  const contentType = wrapper.result.content_type || "";

  // Diagnostic clair si Carrefour retourne du HTML (challenge non résolu,
  // session expirée pendant la requête, ou endpoint servant du HTML).
  if (
    contentType.includes("text/html") ||
    content.trimStart().startsWith("<")
  ) {
    // Invalidate la session pour forcer un re-warmup au prochain call
    warmupCache.delete(session);
    throw new Error(
      `Carrefour a répondu en HTML (status ${status}) malgré ASP. Path : ${path}. Session invalidée.`
    );
  }

  if (status >= 400) {
    throw new Error(
      `Carrefour HTTP ${status} sur ${path} : ${content.slice(0, 200)}`
    );
  }

  try {
    return JSON.parse(content) as T;
  } catch {
    throw new Error(
      `Carrefour : contenu non-JSON (status ${status}, len ${content.length}). Path : ${path}`
    );
  }
}

/**
 * Récupère du HTML brut (pour scraper le basketServiceId d'une fiche produit).
 * Active `render_js=true` — nécessite que la page s'hydrate côté client.
 */
export async function scrapflyFetchHtml(
  path: string,
  options: Omit<ScrapflyOptions, "renderJs"> = {}
): Promise<string> {
  const session = options.session ?? GLOBAL_SESSION;
  await ensureWarmup(session);

  const targetUrl = path.startsWith("http") ? path : `${CARREFOUR_ORIGIN}${path}`;
  const url = buildScrapflyUrl({
    targetUrl,
    asp: true,
    renderJs: true,
    session,
    waitForSelector: "body",
  });

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`ScrapFly HTTP ${res.status}`);
  }
  const wrapper = (await res.json()) as ScrapflyResponse;
  if (!wrapper.result?.success) {
    throw new Error(
      `ScrapFly HTML échec : ${wrapper.result?.error?.message ?? "inconnu"}`
    );
  }
  return wrapper.result.content;
}

/**
 * Nom de session ScrapFly stable pour un magasin donné. Préserve cookies
 * set-store entre search/cart/slots.
 */
export function sessionForStore(storeRef: string): string {
  return `voixcourses-${storeRef}`;
}
