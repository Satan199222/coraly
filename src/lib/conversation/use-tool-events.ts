"use client";

import { useState } from "react";
import type { ToolEvent } from "./types";

export function useToolEvents(maxVisible = 5, displayDuration = 4000) {
  const [events, setEvents] = useState<ToolEvent[]>([]);

  function push(name: string, label: string) {
    const ev: ToolEvent = { name, label, at: Date.now() };
    setEvents((prev) => [...prev.slice(-(maxVisible - 1)), ev]);
    setTimeout(() => {
      setEvents((prev) => prev.filter((e) => e.at !== ev.at));
    }, displayDuration);
  }

  return { events, push };
}
