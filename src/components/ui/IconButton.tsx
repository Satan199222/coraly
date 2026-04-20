import { type ButtonHTMLAttributes, forwardRef } from "react";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** aria-label obligatoire — décrit l'action, pas l'icône */
  label: string;
}

const BASE =
  "inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-lg cursor-pointer text-[var(--text-muted)] hover:text-[var(--text)] transition-colors focus-visible:outline-3 focus-visible:outline-[var(--focus-ring)] focus-visible:outline-offset-2";

/**
 * Bouton icône avec zone de tap ≥ 44×44px (WCAG 2.5.5 / GROA-429 Pattern 5).
 * Utiliser pour tout bouton dont le contenu visible est une icône sans texte.
 */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ label, children, className, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      className={className ? `${BASE} ${className}` : BASE}
      {...props}
    >
      {children}
    </button>
  )
);
IconButton.displayName = "IconButton";
