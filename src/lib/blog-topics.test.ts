import { describe, it, expect } from "vitest";
import { BLOG_THEMES, BlogCategory, getISOWeek } from "./blog-topics";

const EXPECTED_CATEGORIES: BlogCategory[] = [
  "accessibilite",
  "technologie",
  "formation",
  "pratique",
];

describe("BLOG_THEMES", () => {
  it("contient exactement les 4 catégories attendues", () => {
    const keys = Object.keys(BLOG_THEMES) as BlogCategory[];
    expect(keys.sort()).toEqual([...EXPECTED_CATEGORIES].sort());
  });

  it("chaque thème a les champs obligatoires non vides", () => {
    for (const cat of EXPECTED_CATEGORIES) {
      const theme = BLOG_THEMES[cat];
      expect(theme.description, `${cat}.description`).toBeTruthy();
      expect(theme.mainKeywords.length, `${cat}.mainKeywords`).toBeGreaterThan(0);
      expect(theme.exampleTopics.length, `${cat}.exampleTopics`).toBeGreaterThan(0);
    }
  });

  it("les mainKeywords sont tous des chaînes non vides", () => {
    for (const cat of EXPECTED_CATEGORIES) {
      for (const kw of BLOG_THEMES[cat].mainKeywords) {
        expect(typeof kw).toBe("string");
        expect(kw.trim().length).toBeGreaterThan(0);
      }
    }
  });
});

describe("getISOWeek", () => {
  it("retourne un entier entre 1 et 53", () => {
    const week = getISOWeek();
    expect(week).toBeGreaterThanOrEqual(1);
    expect(week).toBeLessThanOrEqual(53);
    expect(Number.isInteger(week)).toBe(true);
  });

  it("retourne la semaine correcte pour le 4 janvier 2021 (semaine 1)", () => {
    // ISO 8601 : le 4 janvier est toujours dans la semaine 1
    const week = getISOWeek(new Date("2021-01-04"));
    expect(week).toBe(1);
  });

  it("retourne la semaine 53 pour le 31 décembre 2020", () => {
    const week = getISOWeek(new Date("2020-12-31"));
    expect(week).toBe(53);
  });
});
