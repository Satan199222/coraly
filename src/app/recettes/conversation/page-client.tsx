"use client";

/**
 * Page conversation Recettes — Agent ElevenLabs Coraly Recettes
 *
 * Tools client exposés à l'agent :
 *   - search_recipe       : recherche de recettes par nom ou ingrédient
 *   - get_recipe_details  : détail complet (ingrédients + étapes)
 *   - list_ingredients    : liste des ingrédients formatée
 *   - read_step           : texte d'une étape précise
 *
 * Variables dynamiques :
 *   - allergies            : allergènes utilisateur (localStorage prefs)
 *   - regimes              : régimes (végétarien, sans gluten, etc.)
 *
 * GROA-286 — Agent ElevenLabs Coraly Recettes
 */

import { useCallback, useRef, useState } from "react";
import { useConversationClientTool } from "@elevenlabs/react";
import { ConversationShell, useShellContext } from "@/lib/conversation";
import { usePreferences } from "@/lib/preferences/use-preferences";
import type { Recipe } from "@/lib/recettes/types";

interface CurrentRecipeState {
  recipe: Recipe;
  stepNumber: number | null;
}

function RecettesClientTools({
  onRecipeLoaded,
  onStepChanged,
}: {
  onRecipeLoaded: (recipe: Recipe) => void;
  onStepChanged: (stepNumber: number) => void;
}) {
  const { pushToolEvent } = useShellContext();

  // -------------------------------------------------------------------
  // Tool : search_recipe
  // -------------------------------------------------------------------
  useConversationClientTool(
    "search_recipe",
    async (params: Record<string, unknown>): Promise<string> => {
      const query =
        typeof params.query === "string" ? params.query.trim() : "";
      if (!query) {
        return JSON.stringify({ error: "Paramètre query manquant." });
      }

      pushToolEvent("search_recipe", `🔍 ${query}`);

      try {
        const res = await fetch(
          `/api/recettes/search?q=${encodeURIComponent(query)}`
        );
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          const msg =
            (body as { error?: string }).error ??
            `HTTP ${res.status} — Recherche indisponible.`;
          console.error("[recettes/conversation] search_recipe failed:", msg);
          return JSON.stringify({ error: msg });
        }
        const { results } = (await res.json()) as {
          results: Array<{
            id: string;
            title: string;
            area?: string;
            category?: string;
            readyInMinutes?: number;
          }>;
        };
        if (!results || results.length === 0) {
          return JSON.stringify({
            error: `Aucune recette trouvée pour « ${query} ». Essayez un autre terme comme ratatouille ou tarte tatin.`,
          });
        }
        return JSON.stringify({
          count: results.length,
          recipes: results.slice(0, 5).map((r) => ({
            id: r.id,
            title: r.title,
            area: r.area,
            category: r.category,
            ready_in_minutes: r.readyInMinutes,
          })),
        });
      } catch (err) {
        console.error("[recettes/conversation] search_recipe error:", err);
        return JSON.stringify({ error: "Erreur de connexion lors de la recherche." });
      }
    }
  );

  // -------------------------------------------------------------------
  // Tool : get_recipe_details
  // -------------------------------------------------------------------
  useConversationClientTool(
    "get_recipe_details",
    async (params: Record<string, unknown>): Promise<string> => {
      const recipeId =
        typeof params.recipe_id === "string" ? params.recipe_id.trim() : "";
      if (!recipeId) {
        return JSON.stringify({ error: "Paramètre recipe_id manquant." });
      }

      pushToolEvent("get_recipe_details", `📖 Détails`);

      try {
        const res = await fetch(
          `/api/recettes/${encodeURIComponent(recipeId)}`
        );
        if (!res.ok) {
          if (res.status === 404) {
            return JSON.stringify({ error: "Recette introuvable." });
          }
          const body = await res.json().catch(() => ({}));
          return JSON.stringify({
            error: (body as { error?: string }).error ?? `HTTP ${res.status}`,
          });
        }
        const { recipe } = (await res.json()) as { recipe: Recipe };
        onRecipeLoaded(recipe);
        return JSON.stringify({
          id: recipe.id,
          title: recipe.title,
          area: recipe.area,
          category: recipe.category,
          ready_in_minutes: recipe.readyInMinutes,
          servings: recipe.servings,
          ingredient_count: recipe.ingredients.length,
          step_count: recipe.steps.length,
          tags: recipe.tags,
        });
      } catch (err) {
        console.error("[recettes/conversation] get_recipe_details error:", err);
        return JSON.stringify({ error: "Erreur lors du chargement de la recette." });
      }
    }
  );

  // -------------------------------------------------------------------
  // Tool : list_ingredients
  // -------------------------------------------------------------------
  useConversationClientTool(
    "list_ingredients",
    async (params: Record<string, unknown>): Promise<string> => {
      const recipeId =
        typeof params.recipe_id === "string" ? params.recipe_id.trim() : "";
      if (!recipeId) {
        return JSON.stringify({ error: "Paramètre recipe_id manquant." });
      }

      pushToolEvent("list_ingredients", `🥕 Ingrédients`);

      try {
        const res = await fetch(
          `/api/recettes/${encodeURIComponent(recipeId)}`
        );
        if (!res.ok) {
          return JSON.stringify({ error: "Recette introuvable." });
        }
        const { recipe } = (await res.json()) as { recipe: Recipe };
        onRecipeLoaded(recipe);
        return JSON.stringify({
          title: recipe.title,
          count: recipe.ingredients.length,
          ingredients: recipe.ingredients.map((ing) =>
            ing.amount ? `${ing.amount} ${ing.name}` : ing.name
          ),
        });
      } catch (err) {
        console.error("[recettes/conversation] list_ingredients error:", err);
        return JSON.stringify({ error: "Erreur lors du chargement des ingrédients." });
      }
    }
  );

  // -------------------------------------------------------------------
  // Tool : read_step
  // -------------------------------------------------------------------
  useConversationClientTool(
    "read_step",
    async (params: Record<string, unknown>): Promise<string> => {
      const recipeId =
        typeof params.recipe_id === "string" ? params.recipe_id.trim() : "";
      const stepNumber =
        typeof params.step_number === "number"
          ? Math.round(params.step_number)
          : 0;
      if (!recipeId || stepNumber < 1) {
        return JSON.stringify({
          error: "Paramètres recipe_id et step_number (≥1) requis.",
        });
      }

      pushToolEvent("read_step", `▶ Étape ${stepNumber}`);

      try {
        const res = await fetch(
          `/api/recettes/${encodeURIComponent(recipeId)}`
        );
        if (!res.ok) {
          return JSON.stringify({ error: "Recette introuvable." });
        }
        const { recipe } = (await res.json()) as { recipe: Recipe };
        onRecipeLoaded(recipe);

        const step = recipe.steps.find((s) => s.number === stepNumber);
        if (!step) {
          return JSON.stringify({
            error: `Étape ${stepNumber} inexistante — la recette a ${recipe.steps.length} étapes.`,
            total_steps: recipe.steps.length,
          });
        }

        onStepChanged(stepNumber);
        return JSON.stringify({
          title: recipe.title,
          step_number: step.number,
          total_steps: recipe.steps.length,
          text: step.text,
          is_last: step.number === recipe.steps.length,
        });
      } catch (err) {
        console.error("[recettes/conversation] read_step error:", err);
        return JSON.stringify({ error: "Erreur lors de la lecture de l'étape." });
      }
    }
  );

  return null;
}

// ---------------------------------------------------------------------------
// Side panel : recette courante (ingrédients + étape en cours)
// ---------------------------------------------------------------------------

function RecettesSidePanel({
  current,
}: {
  current: CurrentRecipeState | null;
}) {
  if (!current) {
    return (
      <section
        aria-label="Recette courante"
        className="p-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] min-h-[280px]"
      >
        <h2 className="text-lg font-bold mb-3 pb-2 border-b border-[var(--border)]">
          📖 Recette en cours
        </h2>
        <p className="text-sm text-[var(--text-muted)] italic">
          La recette choisie apparaîtra ici avec ses ingrédients et ses étapes.
        </p>
        <div className="mt-6">
          <h3
            className="text-sm font-semibold mb-2"
            style={{ color: "var(--text-soft)" }}
          >
            Exemples
          </h3>
          <ul className="space-y-1 text-xs text-[var(--text-muted)]">
            <li>« Je veux faire une ratatouille »</li>
            <li>« Lis-moi les ingrédients de la tarte tatin »</li>
            <li>« Étape suivante »</li>
            <li>« Répète l&apos;étape 3 »</li>
          </ul>
        </div>
      </section>
    );
  }

  const { recipe, stepNumber } = current;
  return (
    <section
      aria-label="Recette courante"
      aria-live="polite"
      className="p-4 rounded-xl bg-[var(--bg-surface)] border-2 border-[var(--accent)] min-h-[280px] max-h-[500px] overflow-y-auto"
    >
      <h2 className="text-lg font-bold mb-2 sticky top-0 bg-[var(--bg-surface)] pb-2 border-b border-[var(--border)]">
        📖 {recipe.title}
      </h2>
      <div className="flex flex-wrap gap-1 mb-3 text-xs">
        {recipe.area && (
          <span
            className="px-2 py-0.5 rounded-full"
            style={{
              background: "color-mix(in srgb, var(--accent) 12%, transparent)",
              color: "var(--accent)",
              border: "1px solid color-mix(in srgb, var(--accent) 30%, transparent)",
            }}
          >
            {recipe.area}
          </span>
        )}
        {recipe.readyInMinutes && (
          <span
            className="px-2 py-0.5 rounded-full bg-[var(--bg-card)] text-[var(--text-soft)] border border-[var(--border)]"
          >
            {recipe.readyInMinutes} min
          </span>
        )}
        <span className="px-2 py-0.5 rounded-full bg-[var(--bg-card)] text-[var(--text-soft)] border border-[var(--border)]">
          {recipe.steps.length} étapes
        </span>
      </div>

      {recipe.ingredients.length > 0 && (
        <div className="mb-4">
          <h3
            className="text-sm font-semibold mb-1"
            style={{ color: "var(--text-soft)" }}
          >
            Ingrédients ({recipe.ingredients.length})
          </h3>
          <ul className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-xs text-[var(--text)]">
            {recipe.ingredients.map((ing, i) => (
              <li key={i} className="flex gap-1">
                <span style={{ color: "var(--brass)" }}>•</span>
                <span>
                  {ing.amount && (
                    <span className="font-medium text-[var(--accent)]">
                      {ing.amount}{" "}
                    </span>
                  )}
                  {ing.name}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {recipe.steps.length > 0 && (
        <div>
          <h3
            className="text-sm font-semibold mb-1"
            style={{ color: "var(--text-soft)" }}
          >
            Étapes
          </h3>
          <ol className="space-y-1 text-xs">
            {recipe.steps.map((step) => {
              const isActive = stepNumber === step.number;
              return (
                <li
                  key={step.number}
                  aria-current={isActive ? "step" : undefined}
                  className="p-2 rounded-md"
                  style={{
                    background: isActive
                      ? "color-mix(in srgb, var(--accent) 10%, var(--bg-card))"
                      : "transparent",
                    border: isActive
                      ? "1px solid var(--accent)"
                      : "1px solid transparent",
                    color: isActive ? "var(--text)" : "var(--text-soft)",
                    fontWeight: isActive ? 500 : 400,
                  }}
                >
                  <span
                    aria-hidden
                    className="inline-block font-bold mr-1"
                    style={{ color: "var(--brass)" }}
                  >
                    {step.number}.
                  </span>
                  {step.text}
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Page principale
// ---------------------------------------------------------------------------

export default function RecettesConversationPageClient() {
  const { prefs } = usePreferences();
  const [current, setCurrent] = useState<CurrentRecipeState | null>(null);
  const currentIdRef = useRef<string | null>(null);

  const handleRecipeLoaded = useCallback((recipe: Recipe) => {
    if (currentIdRef.current === recipe.id) return;
    currentIdRef.current = recipe.id;
    setCurrent({ recipe, stepNumber: null });
  }, []);

  const handleStepChanged = useCallback((stepNumber: number) => {
    setCurrent((prev) => (prev ? { ...prev, stepNumber } : prev));
  }, []);

  const dynamicVariables: Record<string, string> = {
    allergies:
      prefs.allergens.length > 0 ? prefs.allergens.join(", ") : "aucune",
    regimes: prefs.diet.length > 0 ? prefs.diet.join(", ") : "aucun",
  };

  return (
    <ConversationShell
      config={{
        title: "Koraly Recettes — Cuisiner par la voix",
        description:
          "Demandez à Koraly une recette, les ingrédients, ou guidez-vous étape par étape sans avoir les mains sur l'écran.",
        agentName: "Koraly",
        badge: "Recettes",
        hintText:
          "Dites par exemple : « Je veux faire une ratatouille », « Lis-moi les ingrédients », ou « Étape suivante ».",
        backHref: "/recettes",
        backLabel: "Retour Recettes",
      }}
      dynamicVariables={dynamicVariables}
      signedUrlEndpoint="/api/agent/recettes/signed-url"
      renderSidePanel={() => <RecettesSidePanel current={current} />}
    >
      <RecettesClientTools
        onRecipeLoaded={handleRecipeLoaded}
        onStepChanged={handleStepChanged}
      />
    </ConversationShell>
  );
}
