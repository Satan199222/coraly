/**
 * Probe — Sondage API Sylius Pharma GDD
 *
 * Objectif (GROA-244) : Valider l'accès public à l'API Sylius de Pharma GDD.
 *
 * Points testés :
 *   1. Endpoints Sylius API v2 (shop) sans auth
 *   2. Format de réponse (JSON / JSON-LD)
 *   3. Rate limiting / blocage
 *   4. Endpoints alternatifs (catalogue HTML scraping, sitemap)
 *
 * Usage :
 *   node probes/pharmagdd-sylius-probe.mjs
 *
 * Résultats : console + probes/results/pharmagdd-*.json
 */

import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RESULTS_DIR = join(__dirname, "results");

mkdirSync(RESULTS_DIR, { recursive: true });

const BASE = "https://www.pharma-gdd.com";
const TIMEOUT_MS = 15_000;

const HEADERS = {
  Accept: "application/json, application/ld+json;q=0.9, */*;q=0.8",
  "Accept-Language": "fr-FR,fr;q=0.9",
  "User-Agent":
    "Mozilla/5.0 (compatible; VoixSante-Probe/1.0; +https://voix.ai/)",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function saveResult(name, data) {
  const path = join(RESULTS_DIR, `pharmagdd-${name}.json`);
  writeFileSync(path, JSON.stringify(data, null, 2), "utf8");
  console.log(`  [saved] probes/results/pharmagdd-${name}.json`);
}

async function probe(label, url, opts = {}) {
  const start = Date.now();
  console.log(`\n  → ${label}`);
  console.log(`    URL: ${url}`);
  try {
    const res = await fetch(url, {
      headers: { ...HEADERS, ...(opts.headers ?? {}) },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      redirect: "follow",
    });
    const elapsed = Date.now() - start;
    const contentType = res.headers.get("content-type") ?? "";
    const isJson =
      contentType.includes("json") || contentType.includes("ld+json");

    let body = null;
    let rawText = null;
    if (isJson) {
      try {
        body = await res.json();
      } catch {
        rawText = await res.text().catch(() => null);
      }
    } else {
      rawText = await res.text().catch(() => null);
    }

    const result = {
      url,
      status: res.status,
      statusText: res.statusText,
      contentType,
      elapsed,
      isJson,
      headers: Object.fromEntries([...res.headers.entries()]),
      body: body ?? (rawText ? rawText.slice(0, 500) : null),
      bodyLength: rawText?.length ?? JSON.stringify(body ?? {}).length,
    };

    const statusIcon = res.ok ? "✓" : res.status === 401 ? "⚠" : "✗";
    console.log(
      `    ${statusIcon} HTTP ${res.status} — ${contentType} — ${elapsed}ms`
    );
    if (isJson && body) {
      // Afficher un aperçu
      const preview = JSON.stringify(body).slice(0, 200);
      console.log(`    Preview: ${preview}`);
    }
    if (rawText && !isJson) {
      console.log(`    Text preview: ${rawText.slice(0, 150)}`);
    }

    return result;
  } catch (err) {
    const elapsed = Date.now() - start;
    const errStr = err instanceof Error ? err.message : String(err);
    console.log(`    ✗ ERREUR: ${errStr} (${elapsed}ms)`);
    return { url, error: errStr, elapsed };
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("══════════════════════════════════════════════════");
  console.log("  VoixSanté — Probe Sylius API Pharma GDD");
  console.log(`  Base URL: ${BASE}`);
  console.log("══════════════════════════════════════════════════\n");

  const results = {};

  // ── 1. Endpoints Sylius API v2 classiques ──────────────────────────────
  console.log("━━━ 1. Endpoints Sylius API v2 ━━━");

  results.channels = await probe(
    "Channels (locale/devise)",
    `${BASE}/api/v2/shop/channels`
  );

  results.taxons = await probe(
    "Taxons (catégories)",
    `${BASE}/api/v2/shop/taxons`
  );

  results.products = await probe(
    "Produits (page 1)",
    `${BASE}/api/v2/shop/products?page=1&itemsPerPage=10&locale=fr_FR`
  );

  results.productsSearch = await probe(
    "Produits — recherche paracetamol",
    `${BASE}/api/v2/shop/products?page=1&itemsPerPage=5&locale=fr_FR&productTranslations.name=paracetamol`
  );

  results.productVariants = await probe(
    "Variantes produits",
    `${BASE}/api/v2/shop/product-variants?page=1&itemsPerPage=5&locale=fr_FR`
  );

  results.currencies = await probe("Devises", `${BASE}/api/v2/shop/currencies`);
  results.locales = await probe("Locales", `${BASE}/api/v2/shop/locales`);

  // ── 2. Endpoint sans version explicite ────────────────────────────────
  console.log("\n━━━ 2. Endpoints alternatifs ━━━");

  results.apiRoot = await probe(
    "Racine API",
    `${BASE}/api/v2`,
    { headers: { Accept: "application/json" } }
  );

  results.apiDocs = await probe(
    "Documentation OpenAPI",
    `${BASE}/api/v2/docs`
  );

  results.apiDocsJson = await probe(
    "Documentation OpenAPI JSON",
    `${BASE}/api/v2/docs.json`
  );

  // ── 3. Détection auth ─────────────────────────────────────────────────
  console.log("\n━━━ 3. Endpoint protégé (auth test) ━━━");

  results.authTest = await probe(
    "Compte client (doit retourner 401)",
    `${BASE}/api/v2/shop/customers/me`
  );

  // ── 4. Vérification headers de sécurité ───────────────────────────────
  console.log("\n━━━ 4. Page d'accueil (headers sécurité) ━━━");

  results.homepage = await probe(
    "Page d'accueil HTML",
    `${BASE}/`,
    { headers: { Accept: "text/html" } }
  );

  // ── 5. Sitemap ─────────────────────────────────────────────────────────
  console.log("\n━━━ 5. Sitemap ━━━");

  results.sitemapIndex = await probe(
    "Sitemap index",
    `${BASE}/sitemap.xml`,
    { headers: { Accept: "application/xml, text/xml, */*" } }
  );

  // ── 6. Test with JSON-LD accept ────────────────────────────────────────
  console.log("\n━━━ 6. JSON-LD (API Platform) ━━━");

  results.productsJsonLd = await probe(
    "Produits — Accept JSON-LD",
    `${BASE}/api/v2/shop/products?page=1&itemsPerPage=5`,
    {
      headers: {
        Accept: "application/ld+json",
      },
    }
  );

  // ── 7. Sauvegarde résultats ────────────────────────────────────────────
  console.log("\n━━━ Sauvegarde résultats ━━━");
  saveResult("probe-full", results);

  // ── Résumé ─────────────────────────────────────────────────────────────
  console.log("\n══════════════════════════════════════════════════");
  console.log("  RÉSUMÉ — Accessibilité API Pharma GDD");
  console.log("══════════════════════════════════════════════════");

  const endpointSummary = [];

  for (const [key, r] of Object.entries(results)) {
    if (r.error) {
      endpointSummary.push({ key, status: "ERROR", detail: r.error });
    } else {
      const accessible = r.status >= 200 && r.status < 300;
      const authRequired = r.status === 401 || r.status === 403;
      const icon = accessible ? "✓" : authRequired ? "⚠" : "✗";
      endpointSummary.push({
        key,
        status: r.status,
        accessible,
        authRequired,
        isJson: r.isJson,
        elapsed: r.elapsed,
      });
      console.log(
        `  ${icon} [${key}] HTTP ${r.status}${r.isJson ? " JSON" : ""}${authRequired ? " (auth requis)" : ""}${accessible ? ` — ${r.elapsed}ms` : ""}`
      );
    }
  }

  saveResult("summary", { probe_date: new Date().toISOString(), base: BASE, endpoints: endpointSummary });

  // Verdict final
  const accessibleEndpoints = endpointSummary.filter((e) => e.accessible);
  const jsonEndpoints = endpointSummary.filter((e) => e.accessible && e.isJson);

  console.log("\n──────────────────────────────────────────────────");
  console.log(
    `  Endpoints accessibles: ${accessibleEndpoints.length}/${endpointSummary.length}`
  );
  console.log(`  Dont JSON/JSON-LD: ${jsonEndpoints.length}`);

  if (jsonEndpoints.length > 0) {
    console.log("\n  ✓ API Sylius ACCESSIBLE sans authentification");
    console.log(
      "  → Implémentation client possible (Phase 4b)"
    );
  } else if (accessibleEndpoints.length > 0) {
    console.log("\n  ⚠ Accès partiel — HTML uniquement, scraping nécessaire");
    console.log(
      "  → Évaluation d'alternatives (scraping, partenariat API)"
    );
  } else {
    console.log("\n  ✗ API inaccessible — alternatives à évaluer");
    console.log(
      "  → Shop Pharmacie / DocMorris / pharmacies OpenMage"
    );
  }

  console.log("══════════════════════════════════════════════════\n");
}

main().catch((e) => {
  console.error("[probe] Erreur fatale:", e);
  process.exit(1);
});
