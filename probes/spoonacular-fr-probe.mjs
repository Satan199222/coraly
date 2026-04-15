/**
 * Probe — Validation couverture FR Spoonacular
 *
 * Objectif (GROA-253) : Valider la couverture des recettes françaises sur l'API Spoonacular.
 *
 * Points testés :
 *   1. Authentification (apiKey requis ?)
 *   2. complexSearch avec language=fr + termes classiques FR
 *   3. Qualité des résultats : totalResults, analyzedInstructions, titre
 *   4. Information : cuisine=french sans langue
 *   5. Alternatives si couverture insuffisante
 *
 * Usage :
 *   SPOONACULAR_API_KEY=xxx node probes/spoonacular-fr-probe.mjs
 *   # Sans clé → teste l'accès public + documente les erreurs
 *
 * Résultats : console + probes/results/spoonacular-*.json
 */

import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RESULTS_DIR = join(__dirname, "results");

mkdirSync(RESULTS_DIR, { recursive: true });

const API_KEY = process.env.SPOONACULAR_API_KEY ?? "";
const BASE = "https://api.spoonacular.com";
const TIMEOUT_MS = 15_000;

const HEADERS = {
  Accept: "application/json",
  "Accept-Language": "fr-FR,fr;q=0.9",
  "User-Agent": "VoixRecettes-Probe/1.0 (GROA-253; +https://voix.ai/)",
};

// Termes classiques de cuisine française
const FR_TERMS = [
  "blanquette de veau",
  "ratatouille",
  "crêpes",
  "coq au vin",
  "boeuf bourguignon",
  "tarte tatin",
  "soupe à l'oignon",
  "quiche lorraine",
  "cassoulet",
  "bouillabaisse",
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function saveResult(name, data) {
  const path = join(RESULTS_DIR, `spoonacular-${name}.json`);
  writeFileSync(path, JSON.stringify(data, null, 2), "utf8");
  console.log(`  [saved] probes/results/spoonacular-${name}.json`);
}

async function probe(label, url, opts = {}) {
  const start = Date.now();
  const displayUrl = url.replace(/apiKey=[^&]+/, "apiKey=***");
  console.log(`\n  → ${label}`);
  console.log(`    URL: ${displayUrl}`);
  try {
    const res = await fetch(url, {
      headers: { ...HEADERS, ...(opts.headers ?? {}) },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      redirect: "follow",
    });
    const elapsed = Date.now() - start;
    const contentType = res.headers.get("content-type") ?? "";
    const isJson = contentType.includes("json");

    let body = null;
    let parseError = null;
    if (isJson) {
      try {
        body = await res.json();
      } catch (e) {
        parseError = String(e);
      }
    } else {
      const text = await res.text();
      body = { _raw: text.slice(0, 500) };
    }

    const quotaRemaining = res.headers.get("X-RateLimit-Requests-Remaining");
    const quotaLimit = res.headers.get("X-RateLimit-Requests-Limit");

    const result = {
      label,
      status: res.status,
      accessible: res.status < 400,
      authRequired: res.status === 401 || res.status === 403,
      isJson,
      elapsed,
      quotaRemaining: quotaRemaining ? Number(quotaRemaining) : null,
      quotaLimit: quotaLimit ? Number(quotaLimit) : null,
      body,
      parseError,
    };

    const icon = result.accessible ? "✓" : "✗";
    console.log(`    ${icon} ${res.status} (${elapsed}ms)`);
    if (quotaRemaining !== null)
      console.log(`    Quota: ${quotaRemaining}/${quotaLimit} remaining`);
    if (!result.accessible) {
      const msg = body?.message ?? body?.code ?? JSON.stringify(body ?? "").slice(0, 100);
      console.log(`    Error: ${msg}`);
    }

    return result;
  } catch (err) {
    const elapsed = Date.now() - start;
    console.log(`    ✗ NETWORK ERROR: ${err.message} (${elapsed}ms)`);
    return { label, status: null, accessible: false, error: err.message, elapsed };
  }
}

function buildUrl(path, params = {}) {
  const url = new URL(`${BASE}${path}`);
  if (API_KEY) url.searchParams.set("apiKey", API_KEY);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return url.toString();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

async function testAuthentication() {
  console.log("\n═══ 1. Test authentification ═══");

  // Without key — public access?
  const noKeyUrl = `${BASE}/recipes/complexSearch?query=ratatouille&number=1`;
  const noKeyResult = await probe("complexSearch sans apiKey", noKeyUrl);

  let withKeyResult = null;
  if (API_KEY) {
    withKeyResult = await probe(
      "complexSearch avec apiKey",
      buildUrl("/recipes/complexSearch", { query: "ratatouille", number: "1" })
    );
  } else {
    console.log("  ⚠️  SPOONACULAR_API_KEY non définie — tests authentifiés ignorés");
  }

  return { noKeyResult, withKeyResult };
}

async function testFrenchCoverage() {
  if (!API_KEY) {
    console.log("\n═══ 2. Couverture FR — IGNORÉ (pas de clé) ═══");
    return null;
  }
  console.log("\n═══ 2. Couverture FR : complexSearch?language=fr ═══");

  const termResults = [];
  let totalResultsSum = 0;
  let withInstructions = 0;

  for (const term of FR_TERMS) {
    const r = await probe(
      `FR: "${term}"`,
      buildUrl("/recipes/complexSearch", {
        query: term,
        language: "fr",
        number: "5",
        addRecipeInformation: "true",
        instructionsRequired: "false",
      })
    );

    if (r.accessible && r.body?.totalResults !== undefined) {
      const total = r.body.totalResults;
      const results = r.body.results ?? [];
      const withInstr = results.filter(
        (rec) => rec.analyzedInstructions?.length > 0
      ).length;

      totalResultsSum += total;
      withInstructions += withInstr;

      termResults.push({
        term,
        totalResults: total,
        returned: results.length,
        withAnalyzedInstructions: withInstr,
        sampleTitles: results.slice(0, 3).map((r) => r.title),
        hasFrenchTitles: results.some(
          (r) => /[éèàùçôîêâûü]/i.test(r.title ?? "")
        ),
      });

      console.log(`    totalResults: ${total}, withInstructions: ${withInstr}/${results.length}`);
    } else {
      termResults.push({ term, error: r.error ?? `HTTP ${r.status}` });
    }

    // Rate limiting courtesy pause
    await new Promise((r) => setTimeout(r, 200));
  }

  return { termResults, totalResultsSum, withInstructions };
}

async function testCuisineFrench() {
  if (!API_KEY) return null;
  console.log("\n═══ 3. cuisine=french (sans language=fr) ═══");

  const r = await probe(
    "complexSearch cuisine=french",
    buildUrl("/recipes/complexSearch", {
      cuisine: "french",
      number: "10",
      addRecipeInformation: "true",
    })
  );

  if (r.accessible && r.body?.results) {
    const results = r.body.results ?? [];
    const hasFrTitles = results.filter(
      (rec) => /[éèàùçôîêâûü]/i.test(rec.title ?? "")
    );
    console.log(`    Total: ${r.body.totalResults}, French-accented titles: ${hasFrTitles.length}/${results.length}`);
    return {
      totalResults: r.body.totalResults,
      returned: results.length,
      frenchAccentedTitles: hasFrTitles.length,
      sampleTitles: results.slice(0, 5).map((r) => r.title),
    };
  }
  return null;
}

async function testRecipeDetail() {
  if (!API_KEY) return null;
  console.log("\n═══ 4. Détail recette + analyzedInstructions ═══");

  // Find a recipe with ratatouille
  const searchR = await probe(
    "Recherche ratatouille (FR)",
    buildUrl("/recipes/complexSearch", {
      query: "ratatouille",
      language: "fr",
      number: "1",
    })
  );

  if (!searchR.accessible || !searchR.body?.results?.length) {
    console.log("  ⚠️  Aucun résultat pour ratatouille — skip détail");
    return null;
  }

  const recipeId = searchR.body.results[0].id;
  const detailR = await probe(
    `Détail recette #${recipeId}`,
    buildUrl(`/recipes/${recipeId}/information`, { includeNutrition: "false" })
  );

  if (!detailR.accessible) return null;

  const rec = detailR.body;
  return {
    id: rec.id,
    title: rec.title,
    sourceName: rec.sourceName,
    sourceUrl: rec.sourceUrl,
    language: rec.language,
    analyzedInstructionsCount: rec.analyzedInstructions?.length ?? 0,
    instructionSteps: rec.analyzedInstructions?.[0]?.steps?.length ?? 0,
    summaryPreview: (rec.summary ?? "").replace(/<[^>]+>/g, "").slice(0, 200),
  };
}

async function testAlternatives() {
  console.log("\n═══ 5. Alternatives open-source ═══");

  const alternatives = [
    {
      name: "OpenRecipes (GitHub)",
      url: "https://raw.githubusercontent.com/fictivekin/openrecipes/master/data/openrecipes.json.gz",
      description: "Base open-source 173k recettes (EN surtout), licence CC0",
      frenchCoverage: "faible (<1%)",
    },
    {
      name: "TheMealDB (free tier)",
      url: "https://www.themealdb.com/api/json/v1/1/filter.php?a=French",
      description: "API gratuite, filtres cuisine=French, résultats EN",
      frenchCoverage: "modérée (50-100 recettes FR cuisine)",
    },
    {
      name: "Marmiton (scraping HTML)",
      url: "https://www.marmiton.org/recettes/recherche.aspx?aqt=ratatouille",
      description: "Base FR native, scraping nécessaire (pas d'API publique)",
      frenchCoverage: "excellente (site FR natif)",
    },
    {
      name: "750g (scraping HTML)",
      url: "https://www.750g.com/recherche/?recherche=ratatouille",
      description: "Base FR native, scraping nécessaire",
      frenchCoverage: "excellente (site FR natif)",
    },
    {
      name: "Edamam Recipe API",
      url: "https://developer.edamam.com/edamam-recipe-api",
      description: "API payante, meilleure couverture multi-langue",
      frenchCoverage: "bonne (paramètre lang=fr)",
    },
  ];

  // Test TheMealDB free (pas de clé requise)
  const mealdbResult = await probe(
    "TheMealDB cuisine French",
    alternatives[1].url
  );

  return { alternatives, mealdbProbe: mealdbResult };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║  VoixRecettes — Probe Spoonacular FR (GROA-253)         ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log(`\n  API Key: ${API_KEY ? `***${API_KEY.slice(-4)}` : "non définie"}`);
  console.log(`  Termes testés: ${FR_TERMS.length}`);
  console.log(`  Base URL: ${BASE}`);

  const authResult = await testAuthentication();
  const frCoverage = await testFrenchCoverage();
  const cuisineResult = await testCuisineFrench();
  const detailResult = await testRecipeDetail();
  const altResult = await testAlternatives();

  // ---------------------------------------------------------------------------
  // Synthèse
  // ---------------------------------------------------------------------------

  const summary = {
    probe_date: new Date().toISOString(),
    api_key_provided: Boolean(API_KEY),
    authentication: {
      publicAccessAllowed: authResult.noKeyResult?.accessible ?? false,
      authErrorCode: authResult.noKeyResult?.status,
    },
    frenchCoverage: frCoverage
      ? {
          termsTestedCount: FR_TERMS.length,
          totalResultsSum: frCoverage.totalResultsSum,
          avgResultsPerTerm: Math.round(frCoverage.totalResultsSum / FR_TERMS.length),
          withAnalyzedInstructions: frCoverage.withInstructions,
          terms: frCoverage.termResults,
          verdict:
            frCoverage.totalResultsSum / FR_TERMS.length > 10
              ? "SUFFISANTE"
              : frCoverage.totalResultsSum / FR_TERMS.length > 3
              ? "PARTIELLE — enrichissement nécessaire"
              : "INSUFFISANTE — alternative recommandée",
        }
      : { verdict: "NON_TESTÉ — clé API requise" },
    cuisineFrench: cuisineResult,
    recipeDetail: detailResult,
    alternatives: altResult?.alternatives,
    mealdbProbe: altResult?.mealdbProbe,
    recommendation: deriveRecommendation(frCoverage),
  };

  saveResult("summary", summary);
  saveResult("full-probe", {
    summary,
    authResult,
    frCoverage,
    cuisineResult,
    detailResult,
    altResult,
  });

  // ---------------------------------------------------------------------------
  // Rapport console
  // ---------------------------------------------------------------------------

  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║  SYNTHÈSE                                                ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log(`\n  Accès public (sans clé) : ${summary.authentication.publicAccessAllowed ? "OUI" : "NON (HTTP " + summary.authentication.authErrorCode + ")"}`);

  if (frCoverage) {
    console.log(`  Total résultats (${FR_TERMS.length} termes) : ${frCoverage.totalResultsSum}`);
    console.log(`  Moy. par terme : ${summary.frenchCoverage.avgResultsPerTerm}`);
    console.log(`  Verdict : ${summary.frenchCoverage.verdict}`);
  } else {
    console.log("  Couverture FR : NON TESTÉE (SPOONACULAR_API_KEY requis)");
    console.log("  → Créer un compte sur https://spoonacular.com/food-api puis relancer :");
    console.log("    SPOONACULAR_API_KEY=xxx node probes/spoonacular-fr-probe.mjs");
  }

  console.log("\n  Alternatives évaluées :");
  for (const alt of altResult?.alternatives ?? []) {
    console.log(`  • ${alt.name} : ${alt.frenchCoverage}`);
  }

  console.log(`\n  Recommandation : ${summary.recommendation}`);
  console.log("\n  Résultats → probes/results/spoonacular-summary.json\n");
}

function deriveRecommendation(frCoverage) {
  if (!frCoverage) {
    return "Obtenir clé API Spoonacular free tier (spoonacular.com/food-api) et relancer le probe pour évaluation complète.";
  }
  const avg = frCoverage.totalResultsSum / FR_TERMS.length;
  if (avg >= 10) {
    return "Spoonacular couvre suffisamment les recettes FR. Intégration directe recommandée.";
  }
  if (avg >= 3) {
    return "Couverture partielle. Combiner Spoonacular + scraping Marmiton/750g pour enrichir le corpus FR.";
  }
  return "Couverture insuffisante. Privilégier Marmiton scraping ou TheMealDB pour les recettes françaises.";
}

main().catch((err) => {
  console.error("[probe] Erreur fatale:", err);
  process.exit(1);
});
