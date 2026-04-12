"use client";

import { useEffect, useRef, useState } from "react";

interface LiveRegionProps {
  message: string;
  /**
   * Niveau d'urgence :
   * - "polite" (défaut) : attend une pause du screen reader. Pour les changements normaux.
   * - "assertive" : interrompt le screen reader. Réservé aux erreurs / alertes critiques.
   */
  urgency?: "polite" | "assertive";
}

/**
 * Zone d'annonces vocales pour les screen readers.
 *
 * Pré-rendue dans le DOM (jamais insérée dynamiquement — NVDA peut rater).
 * Utilise le pattern "empty then set" pour forcer la ré-annonce d'un message
 * identique : on vide d'abord, puis on remet le texte (50ms plus tard).
 *
 * Réf : Sara Soueidan, "Accessible notifications with ARIA Live Regions"
 */
export function LiveRegion({ message, urgency = "polite" }: LiveRegionProps) {
  const [displayed, setDisplayed] = useState("");
  const lastMessage = useRef("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!message) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset synchro quand la prop change de non-vide → vide
      setDisplayed("");
      return;
    }

    // Empty-then-set : forcer la ré-annonce même pour un message identique
    setDisplayed("");
    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(() => {
      // Si le message est identique au précédent, ajouter un zero-width space
      // pour que les screen readers (qui dédupliquent) le ré-annoncent
      const content =
        message === lastMessage.current ? `${message}\u200B` : message;
      setDisplayed(content);
      lastMessage.current = message;
    }, 50);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [message]);

  return (
    <div
      aria-live={urgency}
      aria-atomic="true"
      role={urgency === "assertive" ? "alert" : "status"}
      className="sr-only"
    >
      {displayed}
    </div>
  );
}
