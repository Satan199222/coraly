"use client";

import { useCallback, useSyncExternalStore } from "react";

const KEY = "voixcourses-preferences";
/** Événement custom : permet à plusieurs instances du hook de rester en phase
 *  au sein du MÊME onglet (l'event `storage` natif ne couvre que le cross-tab). */
const CHANGE_EVENT = "voixcourses-prefs-changed";

export type SpeechRate = "slow" | "normal" | "fast";
export type SpeechLocale = "fr-FR" | "fr-BE" | "fr-CH" | "fr-CA";
export type DietaryRestriction =
  | "sans-gluten"
  | "sans-lactose"
  | "vegan"
  | "vegetarien"
  | "halal"
  | "casher";

export interface Preferences {
  speechRate: SpeechRate;
  speechLocale: SpeechLocale;
  diet: DietaryRestriction[];
  defaults: Record<string, string>;
  allergens: string[];
}

const DEFAULT_PREFERENCES: Preferences = {
  speechRate: "normal",
  speechLocale: "fr-FR",
  diet: [],
  defaults: {},
  allergens: [],
};

export const SPEECH_RATE_VALUE: Record<SpeechRate, number> = {
  slow: 0.75,
  normal: 0.95,
  fast: 1.2,
};

// Cache mémoire : useSyncExternalStore exige que getSnapshot renvoie la MÊME
// référence tant que rien n'a changé, sinon React boucle en re-rendus.
let cache: Preferences | null = null;

function read(): Preferences {
  if (cache) return cache;
  if (typeof window === "undefined") {
    cache = DEFAULT_PREFERENCES;
    return cache;
  }
  try {
    const raw = localStorage.getItem(KEY);
    cache = raw
      ? { ...DEFAULT_PREFERENCES, ...(JSON.parse(raw) as Partial<Preferences>) }
      : DEFAULT_PREFERENCES;
  } catch {
    cache = DEFAULT_PREFERENCES;
  }
  return cache;
}

function write(next: Preferences) {
  cache = next;
  if (typeof window !== "undefined") {
    localStorage.setItem(KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }
}

/**
 * Réinitialise le cache mémoire du hook. Utilisé par les tests entre deux
 * rendus pour éviter la pollution inter-tests — pas destiné à l'app runtime.
 */
export function __resetPreferencesCache() {
  cache = null;
}

function subscribe(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  const handler = () => {
    cache = null; // invalider pour forcer relecture
    callback();
  };
  window.addEventListener("storage", handler);
  window.addEventListener(CHANGE_EVENT, handler);
  return () => {
    window.removeEventListener("storage", handler);
    window.removeEventListener(CHANGE_EVENT, handler);
  };
}

export function usePreferences() {
  const prefs = useSyncExternalStore(
    subscribe,
    read,
    () => DEFAULT_PREFERENCES
  );

  const update = useCallback((patch: Partial<Preferences>) => {
    write({ ...read(), ...patch });
  }, []);

  const rememberChoice = useCallback((query: string, resolved: string) => {
    const key = query.trim().toLowerCase();
    if (!key || !resolved.trim()) return;
    const current = read();
    write({
      ...current,
      defaults: { ...current.defaults, [key]: resolved.trim() },
    });
  }, []);

  return { prefs, hydrated: true, update, rememberChoice };
}
