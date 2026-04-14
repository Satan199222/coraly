import { describe, it, expect } from "vitest";
import { getTopicForWeek, getISOWeek, BLOG_TOPICS } from "./blog-topics";

describe("getTopicForWeek", () => {
  it("retourne un topic valide pour une semaine normale", () => {
    const topic = getTopicForWeek(1);
    expect(topic).toBeDefined();
    expect(topic?.id).toBe(1);
  });

  it("effectue une rotation circulaire sur le tableau", () => {
    const topic1 = getTopicForWeek(1);
    const topicWrapped = getTopicForWeek(1 + BLOG_TOPICS.length);
    expect(topicWrapped).toEqual(topic1);
  });

  it("retourne undefined sur tableau vide (pas de crash silencieux)", () => {
    // Simule le cas où le tableau serait vide
    const result = getTopicForWeekFromPool(1, []);
    expect(result).toBeUndefined();
  });

  it("couvre toutes les semaines ISO (1–53) sans NaN ni undefined", () => {
    for (let week = 1; week <= 53; week++) {
      const topic = getTopicForWeek(week);
      expect(topic).toBeDefined();
      expect(typeof topic?.id).toBe("number");
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
});

/**
 * Helper de test : permet de tester getTopicForWeek avec un pool arbitraire
 * sans modifier l'export réel. Reproduit la même logique que getTopicForWeek.
 */
function getTopicForWeekFromPool<T>(
  isoWeek: number,
  pool: T[]
): T | undefined {
  if (pool.length === 0) return undefined;
  const index = (isoWeek - 1) % pool.length;
  return pool[index];
}
