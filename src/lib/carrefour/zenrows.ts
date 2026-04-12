/**
 * Client ZenRows pour les requêtes carrefour.fr.
 *
 * Avantages vs ScrapFly :
 * - Un seul call suffit (`js_render=true` résout Cloudflare dans le call).
 *   Pas de warmup séparé → latence divisée par 2 en cold start.
 * - Coût ~25 credits/call (Free tier 1000 = ~40 recherches/mois).
 * - Headers custom passés en HTTP headers (pas en query) → pas de bracket
 *   notation bizarre.
 *
 * Docs : https://docs.zenrows.com/scraper-api/guide
 */

const ZENROWS_ENDPOINT = "https://api.zenrows.com/v1/";
const CARREFOUR_ORIGIN = "https://www.carrefour.fr";

interface ZenrowsOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: string;
  headers?: Record<string, string>;
  /** Partage cookies entre calls (ex: set-store puis search dans la même session). */
  session?: string;
  /** Force render_js=true (défaut true — nécessaire pour Cloudflare). Désactivable
   *  uniquement si on sait que la session a déjà un cookie cf_clearance. */
  renderJs?: boolean;
  /** Premium proxy = IP résidentielle. Requis pour Cloudflare Carrefour. */
  premiumProxy?: boolean;
}

function buildUrl(params: {
  targetUrl: string;
  session?: string;
  renderJs: boolean;
  premiumProxy: boolean;
}): string {
  const apiKey = process.env.ZENROWS_API_KEY;
  if (!apiKey) {
    throw new Error("ZENROWS_API_KEY manquant.");
  }

  const q = new URLSearchParams({
    apikey: apiKey,
    url: params.targetUrl,
    proxy_country: "fr",
    custom_headers: "true", // forward nos headers HTTP vers la cible
  });
  if (params.premiumProxy) q.set("premium_proxy", "true");
  if (params.renderJs) q.set("js_render", "true");
  if (params.session) q.set("session_id", params.session);

  return `${ZENROWS_ENDPOINT}?${q}`;
}

/**
 * Execute une requête vers carrefour.fr via ZenRows et parse le JSON.
 * `x-requested-with: XMLHttpRequest` est CRITIQUE : sans lui Carrefour
 * renvoie du HTML même avec Cloudflare passé.
 */
export async function zenrowsFetch<T>(
  path: string,
  options: ZenrowsOptions = {}
): Promise<T> {
  const targetUrl = path.startsWith("http") ? path : `${CARREFOUR_ORIGIN}${path}`;

  const url = buildUrl({
    targetUrl,
    session: options.session,
    renderJs: options.renderJs ?? true,
    premiumProxy: options.premiumProxy ?? true,
  });

  const forwardHeaders: Record<string, string> = {
    "x-requested-with": "XMLHttpRequest",
    accept: "application/json",
    referer: `${CARREFOUR_ORIGIN}/`,
    ...options.headers,
  };

  const res = await fetch(url, {
    method: options.method ?? "GET",
    headers: forwardHeaders,
    ...(options.body ? { body: options.body } : {}),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`ZenRows HTTP ${res.status} : ${errText.slice(0, 300)}`);
  }

  const body = await res.text();
  const contentType = res.headers.get("content-type") || "";

  // Diagnostic clair si Carrefour retourne du HTML (session expirée, header
  // oublié ou challenge non résolu).
  if (contentType.includes("text/html") || body.trimStart().startsWith("<")) {
    throw new Error(
      `Carrefour a répondu en HTML via ZenRows. Path : ${path}`
    );
  }

  try {
    return JSON.parse(body) as T;
  } catch {
    throw new Error(
      `Carrefour : contenu non-JSON via ZenRows (len ${body.length}). Path : ${path}`
    );
  }
}

/**
 * Récupère du HTML brut (pour scraper le basketServiceId).
 * Premium + JS rendering obligatoires pour passer Cloudflare + hydrater la page.
 */
export async function zenrowsFetchHtml(
  path: string,
  options: Omit<ZenrowsOptions, "renderJs" | "premiumProxy"> = {}
): Promise<string> {
  const targetUrl = path.startsWith("http") ? path : `${CARREFOUR_ORIGIN}${path}`;

  const url = buildUrl({
    targetUrl,
    session: options.session,
    renderJs: true,
    premiumProxy: true,
  });

  const res = await fetch(url, {
    method: "GET",
    headers: {
      referer: `${CARREFOUR_ORIGIN}/`,
      ...options.headers,
    },
  });

  if (!res.ok) {
    throw new Error(`ZenRows HTTP ${res.status}`);
  }
  return res.text();
}

/**
 * Nom de session ZenRows stable pour un magasin donné — préserve cookies
 * set-store entre search/cart/slots.
 */
export function sessionForStore(storeRef: string): string {
  return `voixcourses-${storeRef}`;
}
