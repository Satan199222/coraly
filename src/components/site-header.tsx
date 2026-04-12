import Link from "next/link";

interface SiteHeaderProps {
  /** Masque la nav principale — pour les pages produit ou les étapes de checkout. */
  compact?: boolean;
}

/**
 * Header commun à toutes les pages : logo "VoixCourses. par Koraly" + nav.
 * S'adapte automatiquement aux 4 thèmes via var(--text), var(--brass), etc.
 */
export function SiteHeader({ compact = false }: SiteHeaderProps = {}) {
  return (
    <header
      className="flex justify-between items-center px-10 py-6 border-b flex-wrap gap-4"
      style={{ borderColor: "var(--border)", color: "var(--text)" }}
    >
      <Link href="/" className="flex items-baseline gap-3.5 no-underline" style={{ color: "var(--text)" }}>
        <span className="text-2xl font-bold" style={{ letterSpacing: "-0.6px" }}>
          VoixCourses
        </span>
        <span style={{ color: "var(--brass)", fontSize: 28, lineHeight: 1, marginLeft: -2 }}>.</span>
        <span
          className="pl-3.5 border-l text-[12px] font-semibold uppercase"
          style={{ letterSpacing: "2.5px", borderColor: "var(--border)", color: "var(--text-muted)" }}
        >
          par Koraly
        </span>
      </Link>
      {!compact && (
        <nav aria-label="Navigation principale" className="flex gap-8 text-base font-semibold">
          <Link href="/#modes" className="pb-1 border-b-2 border-transparent hover:border-[var(--accent)]">
            Comment ça marche
          </Link>
          <Link href="/#enseignes" className="pb-1 border-b-2 border-transparent hover:border-[var(--accent)]">
            Enseignes
          </Link>
          <Link href="/#a11y" className="pb-1 border-b-2 border-transparent hover:border-[var(--accent)]">
            Accessibilité
          </Link>
          <Link href="/installer" className="pb-1 border-b-2 border-transparent hover:border-[var(--accent)]">
            Extension
          </Link>
        </nav>
      )}
    </header>
  );
}
