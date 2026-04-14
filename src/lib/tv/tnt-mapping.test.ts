import { describe, it, expect } from "vitest";
import { TNT_CHANNELS, TNT_BY_SFR_ID } from "./tnt-mapping";

describe("TNT_CHANNELS", () => {
  it("contient exactement 18 chaînes", () => {
    expect(TNT_CHANNELS).toHaveLength(18);
  });

  it("les sfrEpgId sont tous uniques", () => {
    const ids = TNT_CHANNELS.map((ch) => ch.sfrEpgId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("les tntNumber sont tous uniques", () => {
    const nums = TNT_CHANNELS.map((ch) => ch.tntNumber);
    expect(new Set(nums).size).toBe(nums.length);
  });

  it("contient TF1 avec sfrEpgId=192 et tntNumber=1", () => {
    const tf1 = TNT_CHANNELS.find((ch) => ch.name === "TF1");
    expect(tf1).toBeDefined();
    expect(tf1?.sfrEpgId).toBe(192);
    expect(tf1?.tntNumber).toBe(1);
  });

  it("contient franceinfo: avec sfrEpgId=2111", () => {
    const fi = TNT_CHANNELS.find((ch) => ch.sfrEpgId === 2111);
    expect(fi).toBeDefined();
    expect(fi?.name).toBe("franceinfo:");
  });
});

describe("TNT_BY_SFR_ID", () => {
  it("permet de retrouver TF1 Séries-Films via sfrEpgId=1404", () => {
    const ch = TNT_BY_SFR_ID.get(1404);
    expect(ch?.name).toBe("TF1 Séries-Films");
  });

  it("retourne undefined pour un ID inconnu", () => {
    expect(TNT_BY_SFR_ID.get(9999)).toBeUndefined();
  });
});
