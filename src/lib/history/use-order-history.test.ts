import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useOrderHistory, __resetHistoryCache } from "./use-order-history";

describe("useOrderHistory", () => {
  beforeEach(() => {
    localStorage.clear();
    __resetHistoryCache();
  });

  it("commence vide sans lastEntry", () => {
    const { result } = renderHook(() => useOrderHistory());
    expect(result.current.entries).toEqual([]);
    expect(result.current.lastEntry).toBeNull();
  });

  it("empile les entrées dans l'ordre le plus récent en premier", () => {
    const { result } = renderHook(() => useOrderHistory());
    act(() => {
      result.current.add({
        at: "2026-04-01T10:00:00.000Z",
        listText: "pâtes, lait",
        count: 2,
        total: 4.5,
      });
    });
    act(() => {
      result.current.add({
        at: "2026-04-02T10:00:00.000Z",
        listText: "yaourts, pain",
        count: 2,
        total: 6.0,
      });
    });
    expect(result.current.lastEntry?.listText).toBe("yaourts, pain");
    expect(result.current.entries).toHaveLength(2);
  });

  it("plafonne à 10 entrées", () => {
    const { result } = renderHook(() => useOrderHistory());
    act(() => {
      for (let i = 0; i < 15; i++) {
        result.current.add({
          at: `2026-04-${String(i + 1).padStart(2, "0")}T10:00:00.000Z`,
          listText: `commande ${i}`,
          count: 1,
          total: 1,
        });
      }
    });
    expect(result.current.entries).toHaveLength(10);
  });

  it("clear vide tout", () => {
    const { result } = renderHook(() => useOrderHistory());
    act(() => {
      result.current.add({
        at: "2026-04-01T10:00:00.000Z",
        listText: "x",
        count: 1,
        total: 1,
      });
    });
    act(() => {
      result.current.clear();
    });
    expect(result.current.entries).toHaveLength(0);
  });
});
