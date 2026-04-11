import type { Browser, Page } from "playwright-core";

let browser: Browser | null = null;
let page: Page | null = null;
let cloudflareReady = false;

/**
 * Retourne une page Playwright prête (Cloudflare passé).
 * Réutilise l'instance entre les appels (Fluid Compute).
 */
export async function getPage(): Promise<Page> {
  if (page && cloudflareReady) {
    return page;
  }

  if (!browser) {
    const chromium = await import("@sparticuz/chromium");
    const { chromium: pw } = await import("playwright-core");

    browser = await pw.launch({
      args: chromium.default.args,
      executablePath:
        process.env.CHROMIUM_PATH ||
        (await chromium.default.executablePath()),
      headless: true,
    });
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
