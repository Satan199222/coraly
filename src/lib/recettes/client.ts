/**
 * Client API VoixRecettes
 *
 * Chaîne de priorité (GROA-254 rev.2 — retour Board) :
 *   1. Spoonacular  — si SPOONACULAR_API_KEY défini (150 req/j free, meilleure couverture FR)
 *   2. Edamam       — si EDAMAM_APP_ID + EDAMAM_APP_KEY définis (10 000 req/mois free, lang=fr)
 *   3. TheMealDB    — free tier sans clé (fallback dernière chance, ~28 recettes FR)
 *
 * Obtenir une clé Edamam : https://developer.edamam.com/edamam-recipe-api (plan Developer free)
 *
 * Toutes les fonctions retournent des types unifiés (RecipeSummary, Recipe).
 * GROA-254 — Phase 5b VoixRecettes
 */

import type {
  EdamamDetailResponse,
  EdamamRecipe,
  EdamamSearchResponse,
  MealDbMeal,
  MealDbSearchResponse,
  Recipe,
  RecipeIngredient,
  RecipeSummary,
  RecipeStep,
  SpoonacularRecipeDetail,
  SpoonacularSearchResult,
} from "./types";

const TIMEOUT_MS = 12_000;
const SPOON_BASE = "https://api.spoonacular.com";
const EDAMAM_BASE = "https://api.edamam.com/api/recipes/v2";
const MEALDB_BASE = "https://www.themealdb.com/api/json/v1/1";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: {
      Accept: "application/json",
      "User-Agent": "VoixRecettes/1.0 (GROA-254; +https://voix.ai/)",
    },
    next: { revalidate: 3600 }, // cache 1 h côté Next.js
  });
  if (!res.ok) {
    throw new Error(`[recettes] HTTP ${res.status} — ${url}`);
  }
  return res.json() as Promise<T>;
}

function spoonKey(): string {
  return process.env.SPOONACULAR_API_KEY ?? "";
}

function edamamKeys(): { appId: string; appKey: string } | null {
  const appId = process.env.EDAMAM_APP_ID ?? "";
  const appKey = process.env.EDAMAM_APP_KEY ?? "";
  return appId && appKey ? { appId, appKey } : null;
}

/** Extrait l'ID court depuis l'URI Edamam "recipe_XXXX" → "edm-XXXX". */
function edamamUriToId(uri: string): string {
  const shortId = uri.split("recipe_").pop() ?? uri;
  return `edm-${shortId}`;
}

// ---------------------------------------------------------------------------
// Spoonacular helpers
// ---------------------------------------------------------------------------

function spoonSummaryToUnified(r: SpoonacularRecipeDetail): RecipeSummary {
  return {
    id: String(r.id),
    title: r.title,
    imageUrl: r.image,
    category: r.dishTypes?.[0],
    area: r.cuisines?.[0],
    readyInMinutes: r.readyInMinutes,
    servings: r.servings,
    source: "spoonacular",
  };
}

function spoonDetailToUnified(r: SpoonacularRecipeDetail): Recipe {
  const ingredients: RecipeIngredient[] = (r.extendedIngredients ?? []).map(
    (ing) => ({
      name: ing.name ?? ing.original ?? "?",
      amount: ing.original ?? `${ing.amount ?? ""} ${ing.unit ?? ""}`.trim(),
    })
  );

  const steps: RecipeStep[] = [];
  for (const block of r.analyzedInstructions ?? []) {
    for (const s of block.steps ?? []) {
      steps.push({ number: s.number, text: s.step });
    }
  }

  if (steps.length === 0 && r.instructions) {
    const raw = r.instructions.replace(/<[^>]+>/g, "");
    const parts = raw
      .split(/(?:\.\s+|\n+)/)
      .map((s) => s.trim())
      .filter(Boolean);
    parts.forEach((text, i) => steps.push({ number: i + 1, text }));
  }

  return {
    ...spoonSummaryToUnified(r),
    instructionsRaw: r.instructions?.replace(/<[^>]+>/g, ""),
    steps,
    ingredients,
    sourceUrl: r.sourceUrl,
    tags: r.diets,
  };
}

// ---------------------------------------------------------------------------
// Edamam helpers
// ---------------------------------------------------------------------------

function edamamToSummary(r: EdamamRecipe): RecipeSummary {
  return {
    id: edamamUriToId(r.uri),
    title: r.label,
    imageUrl: r.image,
    category: r.dishType?.[0] ?? r.mealType?.[0],
    area: r.cuisineType?.[0],
    readyInMinutes: r.totalTime && r.totalTime > 0 ? r.totalTime : undefined,
    servings: r.yield,
    source: "edamam",
  };
}

function edamamToRecipe(r: EdamamRecipe): Recipe {
  // Ingrédients depuis ingredientLines (texte brut, plus lisible)
  const ingredients: RecipeIngredient[] = (r.ingredientLines ?? []).map(
    (line) => ({ name: line, amount: "" })
  );

  // Edamam ne fournit pas les étapes de préparation — on renvoie vers la source
  const sourceLabel = r.source ?? "la source originale";
  const steps: RecipeStep[] = r.url
    ? [
        {
          number: 1,
          text: `Les étapes détaillées de cette recette sont disponibles sur ${sourceLabel}. Accédez au lien ci-dessous pour suivre la préparation complète.`,
        },
      ]
    : [];

  return {
    ...edamamToSummary(r),
    instructionsRaw: undefined,
    steps,
    ingredients,
    sourceUrl: r.url,
    tags: r.dietLabels,
  };
}

// ---------------------------------------------------------------------------
// TheMealDB helpers
// ---------------------------------------------------------------------------

function mealToSummary(m: MealDbMeal): RecipeSummary {
  return {
    id: `mdb-${m.idMeal}`,
    title: m.strMeal,
    imageUrl: m.strMealThumb,
    category: m.strCategory,
    area: m.strArea,
    source: "themealdb",
  };
}

function mealToRecipe(m: MealDbMeal): Recipe {
  const ingredients: RecipeIngredient[] = [];
  for (let i = 1; i <= 20; i++) {
    const name = (m[`strIngredient${i}`] ?? "").trim();
    const measure = (m[`strMeasure${i}`] ?? "").trim();
    if (name) {
      ingredients.push({ name, amount: measure || "q.s." });
    }
  }

  const rawInstructions = m.strInstructions ?? "";
  const paragraphs = rawInstructions
    .split(/\r?\n+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const steps: RecipeStep[] = paragraphs.map((text, i) => ({
    number: i + 1,
    text,
  }));

  const tags = m.strTags
    ? m.strTags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
    : undefined;

  return {
    ...mealToSummary(m),
    instructionsRaw: rawInstructions,
    steps,
    ingredients,
    sourceUrl: m.strSource,
    tags,
  };
}

// ---------------------------------------------------------------------------
// Public API — search
// ---------------------------------------------------------------------------

/**
 * Recherche de recettes par terme.
 * Priorité : Spoonacular → Edamam → TheMealDB.
 */
export async function searchRecipes(query: string): Promise<RecipeSummary[]> {
  // 1. Spoonacular
  const spoonApiKey = spoonKey();
  if (spoonApiKey) {
    const url =
      `${SPOON_BASE}/recipes/complexSearch` +
      `?query=${encodeURIComponent(query)}` +
      `&language=fr&number=8&addRecipeInformation=true` +
      `&instructionsRequired=false&apiKey=${spoonApiKey}`;

    const data = await fetchJson<SpoonacularSearchResult>(url);
    return (data.results ?? []).map((r) =>
      spoonSummaryToUnified(r as SpoonacularRecipeDetail)
    );
  }

  // 2. Edamam
  const edamam = edamamKeys();
  if (edamam) {
    const url =
      `${EDAMAM_BASE}?type=public` +
      `&q=${encodeURIComponent(query)}` +
      `&app_id=${edamam.appId}` +
      `&app_key=${edamam.appKey}` +
      `&lang=fr&from=0&to=8`;

    const data = await fetchJson<EdamamSearchResponse>(url);
    return (data.hits ?? []).map((h) => edamamToSummary(h.recipe));
  }

  // 3. TheMealDB (fallback dernier recours)
  const url = `${MEALDB_BASE}/search.php?s=${encodeURIComponent(query)}`;
  const data = await fetchJson<MealDbSearchResponse>(url);
  return (data.meals ?? []).map(mealToSummary);
}

// ---------------------------------------------------------------------------
// Public API — detail
// ---------------------------------------------------------------------------

/**
 * Détail complet d'une recette par son identifiant.
 * Préfixes : "edm-" = Edamam, "mdb-" = TheMealDB, sinon = Spoonacular.
 */
export async function getRecipe(id: string): Promise<Recipe> {
  // TheMealDB
  if (id.startsWith("mdb-")) {
    const mealId = id.slice(4);
    const url = `${MEALDB_BASE}/lookup.php?i=${encodeURIComponent(mealId)}`;
    const data = await fetchJson<MealDbSearchResponse>(url);
    const meal = data.meals?.[0];
    if (!meal) throw new Error(`[recettes] Recette introuvable : ${id}`);
    return mealToRecipe(meal);
  }

  // Edamam
  if (id.startsWith("edm-")) {
    const edamam = edamamKeys();
    if (!edamam) {
      throw new Error(
        "[recettes] EDAMAM_APP_ID + EDAMAM_APP_KEY requis pour les IDs Edamam."
      );
    }
    const recipeId = id.slice(4);
    const url =
      `${EDAMAM_BASE}/${encodeURIComponent(recipeId)}?type=public` +
      `&app_id=${edamam.appId}&app_key=${edamam.appKey}`;
    const data = await fetchJson<EdamamDetailResponse>(url);
    return edamamToRecipe(data.recipe);
  }

  // Spoonacular
  const spoonApiKey = spoonKey();
  if (!spoonApiKey) {
    throw new Error(
      "[recettes] SPOONACULAR_API_KEY requis pour les IDs Spoonacular."
    );
  }
  const url =
    `${SPOON_BASE}/recipes/${encodeURIComponent(id)}/information` +
    `?includeNutrition=false&apiKey=${spoonApiKey}`;
  const data = await fetchJson<SpoonacularRecipeDetail>(url);
  return spoonDetailToUnified(data);
}
