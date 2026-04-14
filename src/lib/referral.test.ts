// @vitest-environment node
import { describe, it, expect, beforeEach } from "vitest";
import {
  generateReferralCode,
  normalizeCode,
  getOrCreateReferralCode,
  validateReferralCode,
  recordConversion,
  getReferralReward,
  buildReferralLink,
} from "./referral";

// Les tests utilisent le fallback in-memory (pas de Redis en CI).
// On réinitialise le store global entre chaque test pour l'isolation.
// @ts-expect-error accès au store global de test
const getStore = () => globalThis.__vc_referral as {
  codes: Map<string, unknown>;
  emails: Map<string, string>;
  conversions: Map<string, unknown>;
  rewards: Map<string, unknown>;
};

beforeEach(() => {
  // @ts-expect-error réinitialisation du store global
  globalThis.__vc_referral = {
    codes: new Map(),
    emails: new Map(),
    conversions: new Map(),
    rewards: new Map(),
  };
});

// ---------------------------------------------------------------------------
// generateReferralCode
// ---------------------------------------------------------------------------

describe("generateReferralCode", () => {
  it("génère un code de 8 caractères", () => {
    const code = generateReferralCode();
    expect(code).toHaveLength(8);
  });

  it("génère un code en majuscules uniquement", () => {
    const code = generateReferralCode();
    expect(code).toBe(code.toUpperCase());
  });

  it("génère des codes uniques (pas de collision sur 100 appels)", () => {
    const codes = new Set(Array.from({ length: 100 }, () => generateReferralCode()));
    // 100 codes dans un espace de 32^8 ≈ 10^12 — collisions quasi impossibles
    expect(codes.size).toBe(100);
  });

  it("ne contient pas de caractères ambigus (I, O, 0, 1)", () => {
    const codes = Array.from({ length: 200 }, () => generateReferralCode()).join("");
    expect(codes).not.toMatch(/[IO01]/);
  });
});

// ---------------------------------------------------------------------------
// normalizeCode
// ---------------------------------------------------------------------------

describe("normalizeCode", () => {
  it("convertit en majuscules", () => {
    expect(normalizeCode("abc12345")).toBe("ABC12345");
  });

  it("trimme les espaces", () => {
    expect(normalizeCode("  ABCD1234  ")).toBe("ABCD1234");
  });

  it("accepte un code déjà normalisé", () => {
    expect(normalizeCode("ABCD1234")).toBe("ABCD1234");
  });
});

// ---------------------------------------------------------------------------
// getOrCreateReferralCode
// ---------------------------------------------------------------------------

describe("getOrCreateReferralCode", () => {
  it("crée un code pour un nouvel email", async () => {
    const code = await getOrCreateReferralCode("alice@example.com");
    expect(code).toHaveLength(8);
    expect(code).toBe(code.toUpperCase());
  });

  it("retourne le même code pour le même email (idempotent)", async () => {
    const code1 = await getOrCreateReferralCode("bob@example.com");
    const code2 = await getOrCreateReferralCode("bob@example.com");
    expect(code1).toBe(code2);
  });

  it("normalise l'email (minuscules, trim)", async () => {
    const code1 = await getOrCreateReferralCode("Carol@Example.COM");
    const code2 = await getOrCreateReferralCode("carol@example.com");
    expect(code1).toBe(code2);
  });

  it("génère des codes différents pour des emails différents", async () => {
    const code1 = await getOrCreateReferralCode("dave@example.com");
    const code2 = await getOrCreateReferralCode("eve@example.com");
    expect(code1).not.toBe(code2);
  });
});

// ---------------------------------------------------------------------------
// validateReferralCode
// ---------------------------------------------------------------------------

describe("validateReferralCode", () => {
  it("retourne null pour un code inexistant", async () => {
    const entry = await validateReferralCode("AAAAAAAA");
    expect(entry).toBeNull();
  });

  it("retourne l'entrée pour un code valide", async () => {
    await getOrCreateReferralCode("frank@example.com");
    const store = getStore();
    const code = store.emails.get("frank@example.com")!;

    const entry = await validateReferralCode(code);
    expect(entry).not.toBeNull();
    expect(entry!.email).toBe("frank@example.com");
  });

  it("insensible à la casse pour la recherche", async () => {
    await getOrCreateReferralCode("grace@example.com");
    const store = getStore();
    const code = store.emails.get("grace@example.com")!;

    const entry = await validateReferralCode(code.toLowerCase());
    expect(entry).not.toBeNull();
    expect(entry!.email).toBe("grace@example.com");
  });
});

// ---------------------------------------------------------------------------
// recordConversion
// ---------------------------------------------------------------------------

describe("recordConversion", () => {
  it("enregistre une conversion valide", async () => {
    await getOrCreateReferralCode("henry@example.com");
    const store = getStore();
    const code = store.emails.get("henry@example.com")!;

    const result = await recordConversion(code, "ivan@example.com");
    expect(result.ok).toBe(true);
  });

  it("retourne code_invalide pour un code inexistant", async () => {
    const result = await recordConversion("ZZZZZZZZ", "julia@example.com");
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("code_invalide");
  });

  it("interdit l'auto-referral", async () => {
    await getOrCreateReferralCode("kate@example.com");
    const store = getStore();
    const code = store.emails.get("kate@example.com")!;

    const result = await recordConversion(code, "kate@example.com");
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("auto_referral");
  });

  it("refuse une deuxième conversion parrain+filleul identique", async () => {
    await getOrCreateReferralCode("leo@example.com");
    const store = getStore();
    const code = store.emails.get("leo@example.com")!;

    await recordConversion(code, "mia@example.com");
    const second = await recordConversion(code, "mia@example.com");
    expect(second.ok).toBe(false);
    expect(second.reason).toBe("conversion_deja_enregistree");
  });

  it("permet un parrain de convertir plusieurs filleuls différents", async () => {
    await getOrCreateReferralCode("noah@example.com");
    const store = getStore();
    const code = store.emails.get("noah@example.com")!;

    const r1 = await recordConversion(code, "olivia@example.com");
    const r2 = await recordConversion(code, "peter@example.com");
    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(true);
  });

  it("accorde la récompense au parrain après conversion", async () => {
    await getOrCreateReferralCode("quinn@example.com");
    const store = getStore();
    const code = store.emails.get("quinn@example.com")!;

    await recordConversion(code, "rose@example.com");
    const reward = await getReferralReward("quinn@example.com");
    expect(reward).not.toBeNull();
    expect(reward!.months).toBe(2);
  });

  it("accorde la récompense au filleul après conversion", async () => {
    await getOrCreateReferralCode("sam@example.com");
    const store = getStore();
    const code = store.emails.get("sam@example.com")!;

    await recordConversion(code, "tina@example.com");
    const reward = await getReferralReward("tina@example.com");
    expect(reward).not.toBeNull();
    expect(reward!.months).toBe(2);
    expect(reward!.fromCode).toBe(code);
  });
});

// ---------------------------------------------------------------------------
// getReferralReward
// ---------------------------------------------------------------------------

describe("getReferralReward", () => {
  it("retourne null si aucune récompense", async () => {
    const reward = await getReferralReward("ulla@example.com");
    expect(reward).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// buildReferralLink
// ---------------------------------------------------------------------------

describe("buildReferralLink", () => {
  it("construit le lien avec la base par défaut", () => {
    const link = buildReferralLink("ABCD1234");
    expect(link).toBe("https://voixcourses.fr/invitation/ABCD1234");
  });

  it("supporte une base URL personnalisée", () => {
    const link = buildReferralLink("ABCD1234", "https://staging.voixcourses.fr");
    expect(link).toBe("https://staging.voixcourses.fr/invitation/ABCD1234");
  });

  it("encode les caractères spéciaux dans le code", () => {
    const link = buildReferralLink("AB CD 12");
    expect(link).toContain("AB%20CD%2012");
  });
});
