import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
  usePreferences,
  SPEECH_RATE_VALUE,
  __resetPreferencesCache,
} from "./use-preferences";

describe("usePreferences", () => {
  beforeEach(() => {
    localStorage.clear();
    __resetPreferencesCache();
  });

  it("retourne des valeurs par défaut sensées", () => {
    const { result } = renderHook(() => usePreferences());
    expect(result.current.prefs.speechRate).toBe("normal");
    expect(result.current.prefs.speechLocale).toBe("fr-FR");
    expect(result.current.prefs.diet).toEqual([]);
    expect(result.current.prefs.allergens).toEqual([]);
  });

  it("persiste un patch dans localStorage", () => {
    const { result } = renderHook(() => usePreferences());
    act(() => {
      result.current.update({ diet: ["sans-gluten"] });
    });
    expect(result.current.prefs.diet).toEqual(["sans-gluten"]);
    const raw = localStorage.getItem("voixcourses-preferences");
    expect(raw).toContain("sans-gluten");
  });

  it("rememberChoice stocke en lowercase et trim", () => {
    const { result } = renderHook(() => usePreferences());
    act(() => {
      result.current.rememberChoice("  YAOURTS  ", "yaourts nature");
    });
    expect(result.current.prefs.defaults["yaourts"]).toBe("yaourts nature");
  });

  it("ignore rememberChoice avec clé ou valeur vide", () => {
    const { result } = renderHook(() => usePreferences());
    act(() => {
      result.current.rememberChoice("", "foo");
      result.current.rememberChoice("bar", "   ");
    });
    expect(Object.keys(result.current.prefs.defaults)).toHaveLength(0);
  });

  it("synchronise plusieurs instances du hook dans le même onglet", () => {
    const { result: a } = renderHook(() => usePreferences());
    const { result: b } = renderHook(() => usePreferences());
    act(() => {
      a.current.update({ speechRate: "fast" });
    });
    expect(b.current.prefs.speechRate).toBe("fast");
  });

  it("SPEECH_RATE_VALUE couvre les 3 vitesses", () => {
    expect(SPEECH_RATE_VALUE.slow).toBeLessThan(SPEECH_RATE_VALUE.normal);
    expect(SPEECH_RATE_VALUE.normal).toBeLessThan(SPEECH_RATE_VALUE.fast);
  });
});
