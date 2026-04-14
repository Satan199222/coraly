/**
 * Tests unitaires — lib/epg/sfr.ts
 *
 * Teste les fonctions pures (formatDateSfr, buildSfrEpgUrl, fetchSfrEpg)
 * sans dépendance réseau ni DB.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { formatDateSfr, buildSfrEpgUrl, fetchSfrEpg } from "./sfr";

// ─── formatDateSfr ───────────────────────────────────────────────────────────

describe("formatDateSfr", () => {
  it("formate une date UTC en YYYYMMDD", () => {
    expect(formatDateSfr(new Date("2026-01-05T00:00:00Z"))).toBe("20260105");
  });

  it("pad les mois et jours en 2 chiffres", () => {
    expect(formatDateSfr(new Date("2026-04-07T12:00:00Z"))).toBe("20260407");
  });
});

// ─── buildSfrEpgUrl ──────────────────────────────────────────────────────────

describe("buildSfrEpgUrl", () => {
  it("construit l'URL correcte pour une date donnée", () => {
    const url = buildSfrEpgUrl(new Date("2026-04-14T00:00:00Z"));
    expect(url).toBe(
      "https://static-cdn.tv.sfr.net/data/epg/gen8/guide_web_20260414.json"
    );
  });
});

// ─── fetchSfrEpg ─────────────────────────────────────────────────────────────

describe("fetchSfrEpg", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const VALID_IDS = new Set([192, 4]); // TF1 + France 2

  function makeFetchMock(body: unknown, status = 200) {
    return vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    } as Response);
  }

  it("retourne les programmes des chaînes valides uniquement", async () => {
    makeFetchMock({
      channels: [
        {
          channelId: 192,
          name: "TF1",
          programs: [
            {
              title: "JT 20h",
              startTime: 1713139200, // 2024-04-14 20:00 UTC
              duration: 3600,
            },
          ],
        },
        {
          channelId: 999, // chaîne hors mapping TNT
          name: "Inconnue",
          programs: [{ title: "Show", startTime: 1713139200, duration: 1800 }],
        },
      ],
    });

    const result = await fetchSfrEpg(new Date("2026-04-14T00:00:00Z"), VALID_IDS);

    expect(result).toHaveLength(1);
    expect(result[0].sfrEpgId).toBe(192);
    expect(result[0].programs).toHaveLength(1);
    expect(result[0].programs[0].title).toBe("JT 20h");
  });

  it("calcule endAt en ajoutant la durée à startTime", async () => {
    const startTime = 1713139200; // 2024-04-14 20:00:00 UTC
    const duration = 3600;

    makeFetchMock({
      channels: [
        {
          channelId: 192,
          programs: [{ title: "Émission", startTime, duration }],
        },
      ],
    });

    const result = await fetchSfrEpg(new Date("2026-04-14T00:00:00Z"), VALID_IDS);
    const prog = result[0].programs[0];

    expect(prog.startAt).toEqual(new Date(startTime * 1000));
    expect(prog.endAt).toEqual(new Date((startTime + duration) * 1000));
  });

  it("ignore les programmes sans titre", async () => {
    makeFetchMock({
      channels: [
        {
          channelId: 192,
          programs: [
            { title: "", startTime: 1713139200, duration: 3600 },
            { title: "Bon titre", startTime: 1713143000, duration: 1800 },
          ],
        },
      ],
    });

    const result = await fetchSfrEpg(new Date(), VALID_IDS);
    expect(result[0].programs).toHaveLength(1);
    expect(result[0].programs[0].title).toBe("Bon titre");
  });

  it("ignore les programmes sans startTime ou duration invalide", async () => {
    makeFetchMock({
      channels: [
        {
          channelId: 192,
          programs: [
            { title: "Sans startTime", duration: 3600 },
            { title: "Duration zéro", startTime: 1713139200, duration: 0 },
            { title: "Valide", startTime: 1713139200, duration: 1800 },
          ],
        },
      ],
    });

    const result = await fetchSfrEpg(new Date(), VALID_IDS);
    expect(result[0].programs).toHaveLength(1);
    expect(result[0].programs[0].title).toBe("Valide");
  });

  it("extrait le genre depuis un objet { name: '...' }", async () => {
    makeFetchMock({
      channels: [
        {
          channelId: 192,
          programs: [
            {
              title: "Film",
              startTime: 1713139200,
              duration: 7200,
              genre: { name: "Cinéma" },
            },
          ],
        },
      ],
    });

    const result = await fetchSfrEpg(new Date(), VALID_IDS);
    expect(result[0].programs[0].genre).toBe("Cinéma");
  });

  it("extrait le genre depuis une chaîne brute", async () => {
    makeFetchMock({
      channels: [
        {
          channelId: 192,
          programs: [
            {
              title: "Série",
              startTime: 1713139200,
              duration: 3600,
              genre: "Divertissement",
            },
          ],
        },
      ],
    });

    const result = await fetchSfrEpg(new Date(), VALID_IDS);
    expect(result[0].programs[0].genre).toBe("Divertissement");
  });

  it("lève une erreur sur réponse HTTP non-ok", async () => {
    makeFetchMock({}, 404);

    await expect(
      fetchSfrEpg(new Date("2026-04-14T00:00:00Z"), VALID_IDS)
    ).rejects.toThrow("HTTP 404");
  });

  it("lève une erreur si 'channels' est absent de la réponse", async () => {
    makeFetchMock({ data: [] });

    await expect(
      fetchSfrEpg(new Date(), VALID_IDS)
    ).rejects.toThrow("channels");
  });

  it("lève une erreur réseau et logge correctement", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("ECONNREFUSED"));

    await expect(
      fetchSfrEpg(new Date(), VALID_IDS)
    ).rejects.toThrow("Fetch EPG réseau échoué");
  });

  it("retourne un tableau vide si aucune chaîne valide dans la réponse", async () => {
    makeFetchMock({
      channels: [
        { channelId: 999, programs: [{ title: "X", startTime: 1713139200, duration: 3600 }] },
      ],
    });

    const result = await fetchSfrEpg(new Date(), VALID_IDS);
    expect(result).toHaveLength(0);
  });
});
