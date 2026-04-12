"use client";

import { useCallback, useSyncExternalStore } from "react";

const KEY = "voixcourses-history";
const CHANGE_EVENT = "voixcourses-history-changed";
const MAX_ENTRIES = 10;

export interface OrderEntry {
  at: string;
  listText: string;
  count: number;
  total: number;
  storeName?: string;
}

const EMPTY: OrderEntry[] = [];
let cache: OrderEntry[] | null = null;

function read(): OrderEntry[] {
  if (cache) return cache;
  if (typeof window === "undefined") {
    cache = EMPTY;
    return cache;
  }
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    cache = Array.isArray(parsed) ? parsed : EMPTY;
  } catch {
    cache = EMPTY;
  }
  return cache;
}

function write(next: OrderEntry[]) {
  cache = next.slice(0, MAX_ENTRIES);
  if (typeof window !== "undefined") {
    localStorage.setItem(KEY, JSON.stringify(cache));
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }
}

/** Reset du cache mémoire pour les tests — pas pour l'usage runtime. */
export function __resetHistoryCache() {
  cache = null;
}

function subscribe(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  const handler = () => {
    cache = null;
    callback();
  };
  window.addEventListener("storage", handler);
  window.addEventListener(CHANGE_EVENT, handler);
  return () => {
    window.removeEventListener("storage", handler);
    window.removeEventListener(CHANGE_EVENT, handler);
  };
}

export function useOrderHistory() {
  const entries = useSyncExternalStore(subscribe, read, () => EMPTY);

  const add = useCallback((entry: OrderEntry) => {
    write([entry, ...read()]);
  }, []);

  const clear = useCallback(() => {
    write([]);
  }, []);

  return {
    entries,
    hydrated: true,
    lastEntry: entries[0] ?? null,
    add,
    clear,
  };
}
