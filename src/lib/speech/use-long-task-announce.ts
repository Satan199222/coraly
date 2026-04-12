"use client";

import { useEffect } from "react";

interface Options {
  /** Fonction d'annonce — typiquement la méthode `announce` de la page. */
  announce: (msg: string) => void;
  /** Message après 5 secondes sans retour. */
  stillRunningMessage?: string;
  /** Message après 15 secondes — cadre l'attente comme anormale. */
  takingLongerMessage?: string;
}

/**
 * Pendant une opération asynchrone longue (analyse AI, recherche multi-produits),
 * un utilisateur non-voyant n'a AUCUN feedback. Il peut croire que l'app est
 * plantée et recharger la page, perdant son travail.
 *
 * Ce hook annonce "toujours en cours..." à 5s, puis "cela prend plus de temps
 * que prévu" à 15s, tant que `active === true`. Dès que `active` passe à false,
 * les timers sont annulés.
 */
export function useLongTaskAnnounce(
  active: boolean,
  {
    announce,
    stillRunningMessage = "Opération toujours en cours, merci de patienter.",
    takingLongerMessage = "Cela prend plus de temps que prévu. Vérifiez votre connexion ou patientez encore un peu.",
  }: Options
) {
  useEffect(() => {
    if (!active) return;

    const t1 = setTimeout(() => announce(stillRunningMessage), 5000);
    const t2 = setTimeout(() => announce(takingLongerMessage), 15000);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [active, announce, stillRunningMessage, takingLongerMessage]);
}
