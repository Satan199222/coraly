interface SkipLinkProps {
  /** ID de l'élément de contenu principal. Défaut : "main-content" */
  targetId?: string;
  /** Libellé du lien. Défaut : "Aller au contenu principal" */
  label?: string;
}

/**
 * Premier élément focusable de la page — visible uniquement au focus clavier.
 * Conforme GROA-429 Pattern 3 (skip-to-content).
 * Doit être le premier enfant du <body> dans le layout racine.
 */
export function SkipLink({
  targetId = "main-content",
  label = "Aller au contenu principal",
}: SkipLinkProps) {
  return (
    <a
      href={`#${targetId}`}
      className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[9999]
                 focus:px-4 focus:py-3 focus:rounded-lg
                 focus:bg-[var(--accent)] focus:text-[var(--bg)]
                 focus:outline-4 focus:outline-[var(--focus-ring)] focus:outline-offset-2
                 font-semibold text-base"
    >
      {label}
    </a>
  );
}
