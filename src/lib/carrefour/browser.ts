import type { Browser, Page } from "playwright-core";

let browser: Browser | null = null;
let page: Page | null = null;
let cloudflareReady = false;

/**
 * URL du pack Brotli de Chromium hébergé sur GitHub Releases.
 *
 * @sparticuz/chromium-min NE bundle PAS le binaire (différence avec
 * `chromium` classique), car il dépasse la limite 50 MB des fonctions Vercel
 * Hobby. À la place, on télécharge le pack.tar au premier cold start,
 * décompressé dans /tmp. Fluid Compute réutilise ensuite l'instance.
 *
 * La MAJOR de cette URL doit matcher la version npm de `@sparticuz/chromium-min`.
 */
const CHROMIUM_PACK_URL =
  "https://github.com/Sparticuz/chromium/releases/download/v147.0.0/chromium-v147.0.0-pack.x64.tar";

async function getLaunchOptions() {
  const isVercel = !!process.env.VERCEL;

  if (isVercel) {
    const chromium = await import("@sparticuz/chromium-min");
    return {
      args: chromium.default.args,
      executablePath: await chromium.default.executablePath(CHROMIUM_PACK_URL),
      headless: true,
    };
  }

  const localChromium =
    process.env.CHROMIUM_PATH ||
    "/home/julien/.cache/ms-playwright/chromium-1217/chrome-linux/chrome";

  return {
    executablePath: localChromium,
    headless: true,
  };
}

/**
 * Vérifie qu'on est bel et bien sur une page Carrefour et pas sur une
 * page de challenge Cloudflare. Cloudflare retourne une page HTML "Just a
 * moment..." avec des scripts qui posent des cookies de clearance. Si on
 * enchaîne nos requêtes API avant que le challenge soit passé, on reçoit
 * du HTML au lieu de JSON → crash dans res.json().
 *
 * Heuristique : Carrefour place un <meta name="apple-itunes-app"> et a
 * `#__NEXT_DATA__` dans la home. Cloudflare challenge n'a aucun des deux.
 */
async function isCarrefourReady(p: Page): Promise<boolean> {
  return p.evaluate(() => {
    const title = document.title || "";
    // Pages de challenge Cloudflare ont des titres spécifiques
    if (/just a moment|un instant|attacker|checking/i.test(title)) return false;
    // Carrefour : présence du __NEXT_DATA__ ou du meta apple
    const hasNext = !!document.getElementById("__NEXT_DATA__");
    const hasApple = !!document.querySelector('meta[name="apple-itunes-app"]');
    return hasNext || hasApple;
  });
}

/**
 * Retourne une page Playwright prête (Cloudflare passé).
 * Réutilise l'instance entre les appels (Fluid Compute).
 */
export async function getPage(): Promise<Page> {
  if (page && cloudflareReady) {
    return page;
  }

  if (!browser) {
    const { chromium: pw } = await import("playwright-core");
    const launchOptions = await getLaunchOptions();
    browser = await pw.launch(launchOptions);
  }

  const context = await browser.newContext({
    // User agent récent Chrome Linux — plus crédible que la valeur par défaut
    // de headless-chromium. Cloudflare note cette valeur dans son fingerprint.
    userAgent:
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    locale: "fr-FR",
    viewport: { width: 1280, height: 720 },
    extraHTTPHeaders: {
      "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
    },
  });
  page = await context.newPage();

  // Passer Cloudflare : goto + attendre une preuve que Carrefour a rendu la
  // page, sinon on se retrouve à faire des appels API sur la page challenge
  // qui retourne du HTML au lieu du JSON attendu.
  await page.goto("https://www.carrefour.fr", {
    waitUntil: "domcontentloaded",
    timeout: 45000,
  });

  // Retry-wait : jusqu'à 20s pour que le challenge passe. On vérifie toutes
  // les 500ms si Carrefour a rendu son contenu (pas la page Cloudflare).
  let ready = false;
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (await isCarrefourReady(page)) {
      ready = true;
      break;
    }
    await page.waitForTimeout(500);
  }

  if (!ready) {
    // On logge mais on continue — certains appels pourraient quand même
    // passer (cookies déjà posés par Cloudflare avant notre check).
    console.warn("[carrefour] Cloudflare challenge non confirmé après 20s");
  }

  cloudflareReady = true;
  return page;
}

/**
 * Exécute un fetch dans le contexte du navigateur (avec session Cloudflare).
 * Protège contre le cas où Carrefour répond en HTML (challenge ou page
 * d'erreur) au lieu du JSON attendu : on detect via le content-type et on
 * throw un message lisible plutôt que la SyntaxError JSON opaque.
 */
export async function browserFetch<T>(
  path: string,
  options?: {
    method?: string;
    body?: string;
    headers?: Record<string, string>;
  }
): Promise<T> {
  const p = await getPage();
  return p.evaluate(
    async ({ path, options }) => {
      const res = await fetch(path, {
        method: options?.method || "GET",
        headers: {
          "x-requested-with": "XMLHttpRequest",
          accept: "application/json",
          ...options?.headers,
        },
        ...(options?.body ? { body: options.body } : {}),
      });
      const contentType = res.headers.get("content-type") || "";
      const text = await res.text();
      // Si on reçoit du HTML, c'est probablement une page Cloudflare challenge
      // ou une page d'erreur Carrefour. On throw un message clair pour le log.
      if (
        contentType.includes("text/html") ||
        text.trimStart().startsWith("<")
      ) {
        throw new Error(
          `Carrefour a répondu en HTML (status ${res.status}) au lieu de JSON. Probable challenge Cloudflare non passé. Path : ${path}`
        );
      }
      try {
        return JSON.parse(text);
      } catch {
        throw new Error(
          `Carrefour a répondu en contenu non-JSON (status ${res.status}, len ${text.length}). Path : ${path}`
        );
      }
    },
    { path, options }
  );
}
