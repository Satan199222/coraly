/**
 * Client ScrapFly pour les requêtes carrefour.fr.
 *
 * Pourquoi ScrapFly : Cloudflare Managed Challenge bloque les IPs datacenter
 * (Vercel, Browserless free, etc.). ScrapFly intègre un "Anti-Scraping
 * Protection" (`asp=true`) qui résout Cloudflare automatiquement — c'est
 * leur cœur métier.
 *
 * API ScrapFly : un simple GET vers `https://api.scrapfly.io/scrape` avec la
 * URL cible en paramètre. On récupère un JSON wrapper contenant la réponse
 * Carrefour sous `result.content`.
 *
 * Sessions : pour que le cookie de magasin sélectionné (`set-store`) persiste
 * entre les appels, ScrapFly propose un paramètre `session` qui partage les
 * cookies jusqu'à 30 min. Sans session persistante, chaque call repartirait
 * de zéro.
 */

/** Budget ScrapFly : chaque scrape ASP coûte ~5 credits. Free tier = 1000/mois. */
const SCRAPFLY_ENDPOINT = "https://api.scrapfly.io/scrape";
const CARREFOUR_ORIGIN = "https://www.carrefour.fr";

interface ScrapflyOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: string;
  headers?: Record<string, string>;
  /** Session partagée (même user, même magasin) pour préserver cookies. */
  session?: string;
  /** Activer le rendu JS (plus coûteux, nécessaire pour scraper du HTML
   *  dynamique). Défaut : false — les endpoints /api/* retournent du JSON
   *  directement, pas besoin. */
  renderJs?: boolean;
}

interface ScrapflyResponse {
  result: {
    content: string;
    content_format: string;
    status_code: number;
    success: boolean;
    error?: { code: string; message: string } | null;
    url: string;
  };
  context?: unknown;
}

/**
 * Execute une requête vers carrefour.fr via ScrapFly.
 *
 * Le path commence par `/` (ex: `/s?q=lait` ou `/api/cart`) — on l'ajoute
 * sur CARREFOUR_ORIGIN automatiquement.
 */
export async function scrapflyFetch<T>(
  path: string,
  options: ScrapflyOptions = {}
): Promise<T> {
  const apiKey = process.env.SCRAPFLY_API_KEY;
  if (!apiKey) {
    throw new Error(
      "SCRAPFLY_API_KEY manquant. Configurez la variable d'environnement."
    );
  }

  const targetUrl = path.startsWith("http") ? path : `${CARREFOUR_ORIGIN}${path}`;

  // Headers à forwarder à Carrefour. `x-requested-with: XMLHttpRequest` est
  // critique : sans lui, Carrefour retourne du HTML au lieu du JSON (voir
  // docs/CARREFOUR-API.md). On ajoute `referer` pour le profil crédible.
  const forwardHeaders: Record<string, string> = {
    "x-requested-with": "XMLHttpRequest",
    accept: "application/json",
    referer: `${CARREFOUR_ORIGIN}/`,
    ...options.headers,
  };

  const params = new URLSearchParams({
    key: apiKey,
    url: targetUrl,
    asp: "true", // Anti-Scraping Protection : bypass Cloudflare
    country: "fr", // IP résidentielle française (Cloudflare plus permissif)
    render_js: options.renderJs ? "true" : "false",
    // Headers forwarded : ScrapFly prend un objet JSON URL-encodé
    headers: JSON.stringify(forwardHeaders),
  });

  if (options.session) {
    params.set("session", options.session);
    // Conserver les cookies entre les appels de la même session
    params.set("session_sticky_proxy", "true");
  }

  if (options.method && options.method !== "GET") {
    params.set("method", options.method);
  }

  if (options.body) {
    params.set("body", options.body);
  }

  const res = await fetch(`${SCRAPFLY_ENDPOINT}?${params}`);

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(
      `ScrapFly HTTP ${res.status} : ${errText.slice(0, 200)}`
    );
  }

  const wrapper = (await res.json()) as ScrapflyResponse;

  if (!wrapper.result.success) {
    throw new Error(
      `ScrapFly échec : ${wrapper.result.error?.message ?? "inconnu"}`
    );
  }

  const status = wrapper.result.status_code;
  const content = wrapper.result.content;

  // Diagnostic : si Carrefour nous a renvoyé du HTML malgré l'ASP, c'est
  // probablement que notre requête est mal formée (URL, headers). On throw
  // un message clair plutôt qu'un JSON.parse qui échoue.
  if (
    wrapper.result.content_format === "html" ||
    content.trimStart().startsWith("<")
  ) {
    throw new Error(
      `Carrefour a répondu en HTML (status ${status}) malgré ASP. Path : ${path}`
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
 * Active `renderJs=true` — Carrefour fait du SSR Next.js, mais certains
 * éléments (scripts tracking, ids dynamiques) nécessitent l'exécution JS.
 */
export async function scrapflyFetchHtml(
  path: string,
  options: Omit<ScrapflyOptions, "renderJs"> = {}
): Promise<string> {
  const apiKey = process.env.SCRAPFLY_API_KEY;
  if (!apiKey) {
    throw new Error("SCRAPFLY_API_KEY manquant.");
  }

  const targetUrl = path.startsWith("http") ? path : `${CARREFOUR_ORIGIN}${path}`;
  const params = new URLSearchParams({
    key: apiKey,
    url: targetUrl,
    asp: "true",
    country: "fr",
    render_js: "true",
    wait_for_selector: "body", // attend que la page soit chargée
  });

  if (options.session) {
    params.set("session", options.session);
  }

  const res = await fetch(`${SCRAPFLY_ENDPOINT}?${params}`);
  if (!res.ok) {
    throw new Error(`ScrapFly HTTP ${res.status}`);
  }
  const wrapper = (await res.json()) as ScrapflyResponse;
  if (!wrapper.result.success) {
    throw new Error(
      `ScrapFly HTML échec : ${wrapper.result.error?.message ?? "inconnu"}`
    );
  }
  return wrapper.result.content;
}

/**
 * Nom de session ScrapFly stable pour un magasin donné.
 * Permet que set-store + search + cart partagent les cookies Cloudflare +
 * magasin sélectionné. Durée : 30 min (ScrapFly default).
 */
export function sessionForStore(storeRef: string): string {
  return `voixcourses-${storeRef}`;
}
