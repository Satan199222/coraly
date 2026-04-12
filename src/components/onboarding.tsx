"use client";

import { useEffect, useState } from "react";

const SEEN_KEY = "voixcourses-onboarding-seen";

/**
 * Carte "Comment ça marche" affichée uniquement à la 1ʳᵉ visite.
 * Skippable. Contenu concis pour ne pas bloquer l'utilisateur pressé ;
 * l'info détaillée reste dans le dialog d'aide (touche ?).
 */
export function Onboarding() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lecture one-shot localStorage au mount (pas accessible en SSR)
    if (!localStorage.getItem(SEEN_KEY)) setShow(true);
  }, []);

  function dismiss() {
    localStorage.setItem(SEEN_KEY, "1");
    setShow(false);
  }

  if (!show) return null;

  return (
    <aside
      role="region"
      aria-label="Découvrir VoixCourses"
      className="p-5 rounded-lg border-2 border-[var(--accent)] bg-[var(--bg-surface)] space-y-3"
    >
      <h2 className="text-xl font-bold">Bienvenue sur VoixCourses 👋</h2>
      <p className="text-sm text-[var(--text-muted)]">
        Faites vos courses par la voix en 3 étapes :
      </p>
      <ol className="space-y-2 text-sm list-decimal list-inside">
        <li>
          <strong>Votre magasin</strong> — entrez votre code postal pour
          trouver un Carrefour proche.
        </li>
        <li>
          <strong>Votre liste</strong> — dictez ou tapez vos courses
          naturellement (l&apos;IA comprend &laquo;&nbsp;2 litres de lait
          demi-écrémé&nbsp;&raquo;).
        </li>
        <li>
          <strong>Votre panier</strong> — validez les produits trouvés ;
          l&apos;extension remplit votre panier Carrefour en 1 clic.
        </li>
      </ol>
      <p className="text-xs text-[var(--text-muted)]">
        Astuce : appuyez sur{" "}
        <kbd className="px-1.5 py-0.5 rounded bg-[var(--bg)] border border-[var(--border)]">
          ?
        </kbd>{" "}
        à tout moment pour voir les raccourcis clavier.
      </p>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Fermer cette présentation et commencer"
        className="w-full px-4 py-2 rounded-lg bg-[var(--accent)] text-[var(--bg)] font-bold hover:bg-[var(--accent-hover)] transition-colors"
      >
        Commencer
      </button>
    </aside>
  );
}
