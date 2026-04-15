/**
 * Types VoixRecettes
 *
 * Couche d'abstraction unifiée sur deux sources de données :
 *   1. Spoonacular (https://api.spoonacular.com) — clé API requise (SPOONACULAR_API_KEY)
 *   2. TheMealDB  (https://www.themealdb.com/api/json/v1/1/) — free tier, sans clé
 *
 * Résultats Phase 5a (GROA-253) :
 *   - Spoonacular : accès public refusé (HTTP 401 sans clé) — intégré via env var
 *   - TheMealDB   : 28 recettes cuisine française, accessible sans clé
 *
 * GROA-254 — Phase 5b VoixRecettes client API + page /recettes
 */

// ---------------------------------------------------------------------------
// Types d'affichage unifiés
// ---------------------------------------------------------------------------

/** Résumé d'une recette dans la liste de recherche. */
export interface RecipeSummary {
  /** Identifiant unique (string pour compatibilité Spoonacular, Edamam & TheMealDB). */
  id: string;
  /** Titre de la recette. */
  title: string;
  /** URL de la vignette (thumb). */
  imageUrl?: string;
  /** Catégorie (ex. "Dessert", "Pasta"). */
  category?: string;
  /** Aire géographique / cuisine (ex. "French", "Italian"). */
  area?: string;
  /** Durée de préparation en minutes (Spoonacular / Edamam). */
  readyInMinutes?: number;
  /** Nombre de portions. */
  servings?: number;
  /** Source des données. */
  source: "spoonacular" | "edamam" | "themealdb";
}

/** Étape individuelle d'une recette (pour lecture vocale). */
export interface RecipeStep {
  /** Numéro d'étape (1-based). */
  number: number;
  /** Texte de l'étape. */
  text: string;
}

/** Ingrédient d'une recette. */
export interface RecipeIngredient {
  name: string;
  amount: string;
}

/** Recette complète avec ingrédients + étapes. */
export interface Recipe extends RecipeSummary {
  /** Instructions en prose (non découpées). */
  instructionsRaw?: string;
  /** Étapes découpées pour lecture vocale. */
  steps: RecipeStep[];
  /** Liste d'ingrédients avec mesures. */
  ingredients: RecipeIngredient[];
  /** URL vers la source (site externe). */
  sourceUrl?: string;
  /** Tags / régimes (végétarien, sans gluten…). */
  tags?: string[];
}

// ---------------------------------------------------------------------------
// Types Spoonacular (bruts)
// ---------------------------------------------------------------------------

export interface SpoonacularSearchResult {
  results: SpoonacularRecipeSummary[];
  totalResults: number;
  offset: number;
  number: number;
}

export interface SpoonacularRecipeSummary {
  id: number;
  title: string;
  image?: string;
  readyInMinutes?: number;
  servings?: number;
  cuisines?: string[];
  dishTypes?: string[];
  diets?: string[];
}

export interface SpoonacularRecipeDetail extends SpoonacularRecipeSummary {
  extendedIngredients?: SpoonacularIngredient[];
  instructions?: string;
  analyzedInstructions?: SpoonacularInstruction[];
  sourceUrl?: string;
  summary?: string;
}

export interface SpoonacularIngredient {
  original?: string;
  name?: string;
  amount?: number;
  unit?: string;
}

export interface SpoonacularInstruction {
  name?: string;
  steps?: Array<{
    number: number;
    step: string;
  }>;
}

// ---------------------------------------------------------------------------
// Types Edamam Recipe API v2 (bruts)
// ---------------------------------------------------------------------------

export interface EdamamSearchResponse {
  hits: EdamamHit[];
  count: number;
  _links?: {
    next?: { href: string };
  };
}

export interface EdamamHit {
  recipe: EdamamRecipe;
  _links?: {
    self?: { href: string; title?: string };
  };
}

export interface EdamamRecipe {
  /** URI au format "recipe_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX" */
  uri: string;
  label: string;
  image?: string;
  source?: string;
  url?: string;
  yield?: number;
  totalTime?: number;
  cuisineType?: string[];
  mealType?: string[];
  dishType?: string[];
  dietLabels?: string[];
  healthLabels?: string[];
  ingredientLines?: string[];
  ingredients?: Array<{
    text?: string;
    food?: string;
    quantity?: number;
    measure?: string;
  }>;
}

export interface EdamamDetailResponse {
  recipe: EdamamRecipe;
}

// ---------------------------------------------------------------------------
// Types TheMealDB (bruts)
// ---------------------------------------------------------------------------

export interface MealDbSearchResponse {
  meals: MealDbMeal[] | null;
}

export interface MealDbMeal {
  idMeal: string;
  strMeal: string;
  strCategory?: string;
  strArea?: string;
  strInstructions?: string;
  strMealThumb?: string;
  strTags?: string;
  strSource?: string;
  // Ingrédients dynamiques : strIngredient1..strIngredient20
  [key: string]: string | undefined;
}
