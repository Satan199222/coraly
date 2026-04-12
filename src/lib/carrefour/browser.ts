import type { Browser, Page } from "playwright-core";

let browser: Browser | null = null;
let page: Page | null = null;
let cloudflareReady = false;

/**
 * Détermine le chemin du Chromium à utiliser.
 * - En production Vercel : @sparticuz/chromium (binaire optimisé Lambda)
 * - En local : Chromium installé par `npx playwright install chromium`
 */
/**
 * URL du pack Brotli de Chromium hébergé sur GitHub Releases.
 *
 * @sparticuz/chromium-min NE bundle PAS le binaire (différence avec `chromium`
 * classique), car il dépasse la limite 50 MB des fonctions Vercel Hobby.
 * À la place, on télécharge le pack.tar au premier cold start, décompressé
 * dans /tmp. Fluid Compute réutilise ensuite l'instance → pas de redownload.
 *
 * Il faut que la MAJOR de cette URL corresponde à la version npm de
 * @sparticuz/chromium-min (sinon incompatibilités).
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

  // Local dev — chemin du Chromium installé par `npx playwright install`
  // CHROMIUM_PATH peut override ce chemin (ex: pour un Chromium système)
  const localChromium =
    process.env.CHROMIUM_PATH ||
    "/home/julien/.cache/ms-playwright/chromium-1217/chrome-linux/chrome";

  return {
    executablePath: localChromium,
    headless: true,
  };
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
    userAgent:
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    locale: "fr-FR",
  });
  page = await context.newPage();

  // Passer Cloudflare
  await page.goto("https://www.carrefour.fr", {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });
  cloudflareReady = true;

  return page;
}

/**
 * Exécute un fetch dans le contexte du navigateur (avec session Cloudflare).
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
      return res.json();
    },
    { path, options }
  );
}
