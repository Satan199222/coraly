import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useWelcomeAudio } from "./use-welcome-audio";

const SESSION_KEY = "voixcourses-welcome-played";

beforeEach(() => {
  vi.useFakeTimers();
  sessionStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useWelcomeAudio", () => {
  it("ne parle pas si voiceEnabled est false", () => {
    const speak = vi.fn(() => Promise.resolve());
    renderHook(() => useWelcomeAudio({ voiceEnabled: false, speak }));
    vi.runAllTimers();
    expect(speak).not.toHaveBeenCalled();
  });

  it("ne rejoue pas si la clé sessionStorage est déjà à 1", () => {
    sessionStorage.setItem(SESSION_KEY, "1");
    const speak = vi.fn(() => Promise.resolve());
    renderHook(() => useWelcomeAudio({ voiceEnabled: true, speak }));
    vi.runAllTimers();
    expect(speak).not.toHaveBeenCalled();
  });

  it("appelle speak avec le message d'accueil après 600 ms et écrit sessionStorage", async () => {
    const speak = vi.fn(() => Promise.resolve());
    renderHook(() => useWelcomeAudio({ voiceEnabled: true, speak }));
    expect(speak).not.toHaveBeenCalled();
    await vi.runAllTimersAsync();
    expect(speak).toHaveBeenCalledWith("Bonjour, je suis Koraly.");
    expect(sessionStorage.getItem(SESSION_KEY)).toBe("1");
  });

  it("avale le rejet de speak et logge un console.warn", async () => {
    const speak = vi.fn(() => Promise.reject(new Error("autoplay blocked")));
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    renderHook(() => useWelcomeAudio({ voiceEnabled: true, speak }));
    await vi.runAllTimersAsync();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("[welcome]"),
      expect.any(Error)
    );
    warnSpy.mockRestore();
  });

  it("annule le timer si le composant est démonté avant 600 ms", () => {
    const speak = vi.fn(() => Promise.resolve());
    const { unmount } = renderHook(() =>
      useWelcomeAudio({ voiceEnabled: true, speak })
    );
    unmount();
    vi.runAllTimers();
    expect(speak).not.toHaveBeenCalled();
  });
});
