import Link from "next/link";

const COL_PRODUIT = [
  { label: "Comment ça marche", href: "/#modes" },
  { label: "Enseignes partenaires", href: "/#enseignes" },
  { label: "Extension Chrome", href: "/installer" },
  { label: "Tarifs", href: "/#tarifs" },
];
const COL_A11Y = [
  { label: "Déclaration de conformité", href: "/accessibilite" },
  { label: "Raccourcis clavier", href: "/accessibilite#raccourcis" },
  { label: "Police Luciole", href: "https://www.luciole-vision.com/", external: true },
  { label: "Signaler un problème", href: "mailto:hello@coraly.fr" },
];
const COL_COMPANY = [
  { label: "À propos", href: "/a-propos" },
  { label: "Presse", href: "/presse" },
  { label: "Contact", href: "mailto:hello@coraly.fr" },
  { label: "Partenaires enseignes", href: "/b2b" },
];

/**
 * Footer 4 colonnes : logo + description, puis Produit, Accessibilité, Entreprise.
 * Fond accent-ink (marine nuit) avec badges RGAA AAA / EAA 2025 en pied.
 */
export function Footer() {
  return (
    <footer
      role="contentinfo"
      className="mt-24"
      style={{ background: "var(--accent-ink)", color: "var(--bg)" }}
    >
      <div className="max-w-[1200px] mx-auto px-10 pt-14 pb-8">
        <div className="grid gap-12 mb-10 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div>
            <div
              className="text-2xl font-bold flex items-baseline gap-3.5"
              style={{ letterSpacing: "-0.6px" }}
            >
              <span>Coraly</span>
              <span style={{ color: "var(--brass)", fontSize: "26px", lineHeight: 1 }}>.</span>
              <span
                className="pl-3.5 border-l text-[12px] font-semibold uppercase"
                style={{
                  letterSpacing: "2.5px",
                  borderColor: "rgba(244,238,227,0.2)",
                  color: "rgba(244,238,227,0.6)",
                }}
              >
                par Koraly
              </span>
            </div>
            <p
              className="mt-5 text-[15px] leading-[1.6] max-w-[320px]"
              style={{ color: "rgba(244,238,227,0.7)" }}
            >
              L&apos;assistante vocale d&apos;accessibilité pour les courses en ligne. Conçue en
              France avec des utilisateurs déficients visuels.
            </p>
          </div>
          <FooterCol title="Produit" items={COL_PRODUIT} />
          <FooterCol title="Accessibilité" items={COL_A11Y} />
          <FooterCol title="Entreprise" items={COL_COMPANY} />
        </div>

        <div
          className="pt-7 border-t flex justify-between items-center flex-wrap gap-4 text-[14px]"
          style={{ borderColor: "rgba(244,238,227,0.1)", color: "rgba(244,238,227,0.65)" }}
        >
          <div>Coraly · 2026 · Moselle, France</div>
          <div className="inline-flex items-center gap-2.5 flex-wrap">
            <span
              className="px-2.5 py-1 border rounded text-[12px] font-bold tracking-[1px]"
              style={{ borderColor: "rgba(181,136,66,0.5)", color: "var(--brass)" }}
            >
              RGAA AAA
            </span>
            <span
              className="px-2.5 py-1 border rounded text-[12px] font-bold tracking-[1px]"
              style={{ borderColor: "rgba(181,136,66,0.5)", color: "var(--brass)" }}
            >
              EAA 2025
            </span>
            <span>Police Luciole CTRDV · Pantone Cloud Dancer 2026</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({
  title,
  items,
}: {
  title: string;
  items: Array<{ label: string; href: string; external?: boolean }>;
}) {
  return (
    <div>
      <h5
        className="text-[13px] uppercase font-bold mb-4"
        style={{ letterSpacing: "2px", color: "var(--brass)" }}
      >
        {title}
      </h5>
      <ul className="flex flex-col gap-2.5 list-none">
        {items.map((it) => (
          <li key={it.label}>
            {it.external ? (
              <a
                href={it.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[15px] hover:text-[var(--bg)]"
                style={{ color: "rgba(244,238,227,0.85)" }}
              >
                {it.label}
              </a>
            ) : (
              <Link
                href={it.href}
                className="text-[15px] hover:text-[var(--bg)]"
                style={{ color: "rgba(244,238,227,0.85)" }}
              >
                {it.label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
