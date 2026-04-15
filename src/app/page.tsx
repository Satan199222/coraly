"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AccessibilityBar } from "@/lib/shared/components/accessibility-bar";
import { LiveRegion } from "@/lib/shared/components/live-region";
import { SiteHeader } from "@/components/site-header";
import { Footer } from "@/components/footer";
import { HelpDialog } from "@/components/help-dialog";
import { useKeyboardShortcuts } from "@/lib/shared/speech/use-keyboard-shortcuts";
import { useDocumentTitle } from "@/lib/useDocumentTitle";

interface ServiceCard {
  title: string;
  slug: string;
  href: string;
  description: string;
  icon: string;
  shortcut: string;
}

const SERVICES: ServiceCard[] = [
  {
    title: "Courses",
    slug: "courses",
    href: "/courses",
    description:
      "Faites vos courses en ligne par la voix. Dictez votre liste, Koraly compose votre panier chez Carrefour.",
    icon: "🛒",
    shortcut: "1",
  },
  {
    title: "TV",
    slug: "tv",
    href: "/tv",
    description:
      "Consultez les programmes télé du soir. Koraly vous lit le programme de chaque chaîne.",
    icon: "📺",
    shortcut: "2",
  },
  {
    title: "Transport",
    slug: "transport",
    href: "/transport",
    description:
      "Horaires, perturbations, itinéraires. Posez vos questions transport en langage naturel.",
    icon: "🚇",
    shortcut: "3",
  },
  {
    title: "Poste",
    slug: "poste",
    href: "/poste",
    description:
      "Suivez vos colis et envoyez du courrier par la voix. Suivi La Poste et lettres recommandées.",
    icon: "📮",
    shortcut: "4",
  },
  {
    title: "Santé",
    slug: "sante",
    href: "/sante",
    description:
      "Recherchez des médicaments et produits de santé. Informations, prix et disponibilité par la voix.",
    icon: "💊",
    shortcut: "5",
  },
  {
    title: "Recettes",
    slug: "recettes",
    href: "/recettes",
    description:
      "Trouvez et suivez des recettes pas à pas. Koraly vous guide étape par étape en cuisine.",
    icon: "🍳",
    shortcut: "6",
  },
];

export default function HubPage() {
  useDocumentTitle("Coraly — Votre assistante vocale du quotidien");

  const router = useRouter();
  const [helpOpen, setHelpOpen] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  useKeyboardShortcuts({
    onHelp: () => setHelpOpen(true),
    onEscape: () => {
      if (helpOpen) setHelpOpen(false);
    },
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    function handler(e: KeyboardEvent) {
      if (helpOpen) return;
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      const t = e.target as HTMLElement | null;
      if (
        t instanceof HTMLInputElement ||
        t instanceof HTMLTextAreaElement ||
        t?.isContentEditable
      )
        return;
      const idx = parseInt(e.key, 10);
      if (idx >= 1 && idx <= SERVICES.length) {
        e.preventDefault();
        const svc = SERVICES[idx - 1];
        setAnnouncement(`${svc.title} sélectionné. Chargement…`);
        router.push(svc.href);
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [helpOpen, router]);

  return (
    <>
      <LiveRegion message={announcement} />
      <AccessibilityBar onHelpRequest={() => setHelpOpen(true)} />
      <SiteHeader compact />
      <main id="main" tabIndex={-1}>
        <section
          className="max-w-[900px] mx-auto px-6 pt-16 pb-8 text-center"
          aria-labelledby="hub-heading"
        >
          <p
            className="vc-eyebrow mb-3"
            style={{ color: "var(--brass)" }}
          >
            Accessibilité vocale
          </p>
          <h1 id="hub-heading" className="vc-h1 mb-4">
            Bienvenue sur Coraly
          </h1>
          <p
            className="text-lg max-w-[600px] mx-auto mb-2"
            style={{ color: "var(--text-soft)" }}
          >
            Votre assistante vocale pour le quotidien.
            Choisissez un service ci-dessous ou appuyez sur son numéro au clavier.
          </p>
          <p
            className="text-sm mb-12"
            style={{ color: "var(--text-muted)" }}
          >
            Appuyez sur H pour l&apos;aide, Échap pour fermer.
          </p>
        </section>

        <section
          className="max-w-[1100px] mx-auto px-6 pb-20"
          aria-label="Services Coraly"
          role="region"
        >
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 list-none p-0 m-0">
            {SERVICES.map((svc) => (
              <li key={svc.slug}>
                <Link
                  href={svc.href}
                  className="block rounded-2xl p-6 no-underline transition-shadow hover:shadow-lg focus:outline-none focus:ring-3"
                  style={{
                    background: "var(--bg-card)",
                    border: "1px solid var(--border-hi)",
                    color: "var(--text)",
                    boxShadow: "var(--shadow-sm)",
                    // @ts-expect-error CSS custom property
                    "--tw-ring-color": "var(--focus-ring)",
                  }}
                  onClick={() =>
                    setAnnouncement(`${svc.title} sélectionné. Chargement…`)
                  }
                >
                  <div className="flex items-start gap-4">
                    <span
                      className="text-3xl flex-shrink-0 mt-1"
                      aria-hidden="true"
                    >
                      {svc.icon}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-baseline gap-2 mb-2">
                        <h2 className="text-xl font-bold m-0">
                          {svc.title}
                        </h2>
                        <kbd
                          className="text-xs font-mono px-1.5 py-0.5 rounded"
                          style={{
                            background: "var(--bg-alt)",
                            border: "1px solid var(--border)",
                            color: "var(--text-muted)",
                          }}
                          aria-label={`Raccourci clavier : ${svc.shortcut}`}
                        >
                          {svc.shortcut}
                        </kbd>
                      </div>
                      <p
                        className="text-sm leading-relaxed m-0"
                        style={{ color: "var(--text-soft)" }}
                      >
                        {svc.description}
                      </p>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </main>
      <Footer />
      <HelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
    </>
  );
}
