"use client";

import { useEffect, useState } from "react";

/** Retourne true si l'utilisateur a activé "réduire les animations" dans son OS.
 *  Se met à jour dynamiquement si la préférence change en cours de session.
 *  Usage : conditionner les animations JS / Framer Motion sur cette valeur.
 */
export function useReducedMotion(): boolean {
  const [reducedMotion, setReducedMotion] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return reducedMotion;
}
