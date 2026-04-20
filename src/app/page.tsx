"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AccessibilityBar } from "@/lib/shared/components/accessibility-bar";
import { LiveRegion } from "@/lib/shared/components/live-region";
import { KoralyOrb } from "@/lib/shared/components/koraly-orb";
import { SiteHeader } from "@/components/site-header";
import { Footer } from "@/components/footer";
import { HelpDialog } from "@/components/help-dialog";
import { TrustStrip } from "@/components/trust-strip";
import { ManifestoSection } from "@/components/manifesto-section";
import { TestimonySection } from "@/components/testimony-section";
import { useKeyboardShortcuts } from "@/lib/shared/speech/use-keyboard-shortcuts";
import { useDocumentTitle } from "@/lib/useDocumentTitle";

/* ─────────────────────────────────────────────
   Data
───────────────────────────────────────────── */

interface ServiceCard {
  title: string;
  slug: string;
  href: string;
  description: string;
  detail: string;
  icon: string;
  shortcut: string;
  tag: string;
}

const SERVICES: ServiceCard[] = [
  {
    title: "Courses",
    slug: "courses",
    href: "/courses",
    description: "Dictez votre liste, Koraly compose votre panier chez Carrefour, Auchan, Monoprix.",
    detail: "Clavier, vocal guidé ou conversation libre. Gratuit, financé par les enseignes.",
    icon: "🛒",
    shortcut: "1",
    tag: "Disponible",
  },
  {
    title: "TV",
    slug: "tv",
    href: "/tv",
    description: "Consultez les programmes télé du soir par la voix.",
    detail: "Koraly vous lit le programme de chaque chaîne, canal par canal.",
    icon: "📺",
    shortcut: "2",
    tag: "Disponible",
  },
  {
    title: "Transport",
    slug: "transport",
    href: "/transport",
    description: "Horaires, perturbations, itinéraires en langage naturel.",
    detail: "SNCF, RATP, réseaux régionaux. Posez votre question comme à un agent.",
    icon: "🚇",
    shortcut: "3",
    tag: "Disponible",
  },
  {
    title: "Poste",
    slug: "poste",
    href: "/poste",
    description: "Suivez vos colis et envoyez du courrier par la voix.",
    detail: "Suivi La Poste et lettres recommandées sans saisir un numéro.",
    icon: "📮",
    shortcut: "4",
    tag: "Disponible",
  },
  {
    title: "Santé",
    slug: "sante",
    href: "/sante",
    description: "Médicaments, prix, disponibilité — demandez à la voix.",
    detail: "Informations issues de la base officielle des médicaments.",
    icon: "💊",
    shortcut: "5",
    tag: "Disponible",
  },
  {
    title: "Recettes",
    slug: "recettes",
    href: "/recettes",
    description: "Trouvez et suivez des recettes pas à pas.",
    detail: "Koraly vous guide étape par étape, les mains libres, à votre rythme.",
    icon: "🍳",
    shortcut: "6",
    tag: "Disponible",
  },
];

const HOW_STEPS = [
  {
    number: "01",
    title: "Vous parlez",
    body: "Appuyez sur Espace — ou commencez à taper. Dites ce dont vous avez besoin en langage naturel. Koraly écoute.",
    icon: "🎙",
  },
  {
    number: "02",
    title: "Koraly comprend",
    body: "L'IA décode l'intention, gère les ambiguïtés, confirme les éléments incertains. Zéro formulaire à remplir.",
    icon: "🧠",
  },
  {
    number: "03",
    title: "Vous obtenez le résultat",
    body: "Panier prêt, programme lu, colis suivi. Résultat parlé et visible. Vous validez ou ajustez — toujours à la voix.",
    icon: "✅",
  },
];

const FAQ_ITEMS = [
  {
    q: "Faut-il installer quelque chose ?",
    a: "Non. Coraly fonctionne dans votre navigateur. Pour le service Courses, une extension Chrome optionnelle améliore la finalisation du panier — accessible au clavier, en un clic.",
  },
  {
    q: "Mon lecteur d'écran est-il compatible ?",
    a: "Nous testons à chaque sortie NVDA, JAWS, VoiceOver (macOS/iOS) et TalkBack (Android). Si vous utilisez autre chose, dites-le-nous.",
  },
  {
    q: "Combien ça coûte ?",
    a: "Gratuit pour les particuliers. Les enseignes partenaires financent le service. Vous payez vos courses au prix catalogue, rien de plus.",
  },
  {
    q: "Qu'en est-il de mes données personnelles ?",
    a: "Votre voix n'est jamais stockée. Vos listes restent sur votre appareil. Seul le résultat final est transmis au service concerné. RGPD conforme, serveurs français.",
  },
  {
    q: "Koraly comprend-elle mon accent ?",
    a: "Oui. Koraly est entraînée sur toutes les variations du français : métropolitain, régional, ultramarin et les accents d'origine non-francophone. Correction possible à la voix ou au clavier.",
  },
];

/* ─────────────────────────────────────────────
   Page
───────────────────────────────────────────── */

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

        {/* ── Hero ── */}
        <HeroHub />

        {/* ── Trust strip ── */}
        <TrustStrip />

        {/* ── Services grid ── */}
        <ServicesGrid
          services={SERVICES}
          onNavigate={(svc) => {
            setAnnouncement(`${svc.title} sélectionné. Chargement…`);
            router.push(svc.href);
          }}
        />

        {/* ── Comment ça marche ── */}
        <HowSection />

        {/* ── Manifesto / Accessibilité ── */}
        <ManifestoSection />

        {/* ── Testimonials ── */}
        <TestimonySection />

        {/* ── FAQ ── */}
        <FaqSection />

        {/* ── Footer CTA ── */}
        <CtaSection />

      </main>
      <Footer />
      <HelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
    </>
  );
}

/* ─────────────────────────────────────────────
   Hero
───────────────────────────────────────────── */

function HeroHub() {
  return (
    <section className="py-20 lg:py-24" aria-labelledby="hub-heading">
      <div className="max-w-[1200px] mx-auto px-10 grid gap-16 items-center lg:grid-cols-[1.15fr_1fr]">
        {/* Left col */}
        <div>
          <span className="vc-eyebrow">Accessibilité première · Conforme WCAG AAA</span>
          <h1
            id="hub-heading"
            className="vc-h1 mt-5 mb-6"
            style={{ color: "var(--text)" }}
          >
            Votre quotidien,
            <br />
            par la voix.
          </h1>
          <p
            className="text-[21px] leading-[1.55] max-w-[540px] mb-8"
            style={{ color: "var(--text-soft)" }}
          >
            Koraly est une assistante vocale accessible aux personnes déficientes visuelles.
            Courses, TV, transport, santé, courrier, recettes — par la voix ou au clavier.
          </p>

          <div className="flex gap-3.5 flex-wrap items-center">
            <Link
              href="/courses"
              className="px-7 py-4 rounded-md font-bold text-base inline-flex items-center gap-2.5 no-underline"
              style={{ background: "var(--accent)", color: "var(--bg)", letterSpacing: "0.3px" }}
            >
              Commencer maintenant
            </Link>
            <Link
              href="#comment-ca-marche"
              className="px-6 py-3.5 rounded-md font-bold text-base bg-transparent border-[1.5px] inline-flex items-center gap-2 no-underline"
              style={{ borderColor: "var(--text)", color: "var(--text)" }}
            >
              Comment ça marche
            </Link>
          </div>

          <div
            className="mt-6 text-[15px] flex flex-wrap gap-5"
            style={{ color: "var(--text-muted)" }}
            aria-label="Raccourcis clavier disponibles"
          >
            <span className="inline-flex items-center gap-1.5">
              <Kbd>Espace</Kbd> parler à Koraly
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Kbd>1–6</Kbd> accès direct au service
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Kbd>H</Kbd> aide
            </span>
          </div>
        </div>

        {/* Right col — Orb demo */}
        <div
          role="region"
          className="relative p-12 rounded-2xl overflow-hidden"
          style={{ background: "var(--accent-ink)", color: "var(--text-on-ink)" }}
          aria-label="Démonstration de Koraly"
        >
          <div
            aria-hidden="true"
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "radial-gradient(circle at 30% 20%, rgba(181,136,66,0.25), transparent 55%)",
            }}
          />
          <div className="relative flex flex-col items-center text-center gap-5">
            <span
              className="text-[13px] font-bold uppercase inline-flex items-center gap-2"
              style={{ letterSpacing: "2px", color: "var(--brass)" }}
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{
                  background: "var(--brass)",
                  animation: "vc-pulse 2s ease-in-out infinite",
                }}
              />
              Koraly écoute
            </span>
            <KoralyOrb status="listening" />
            <p className="text-[17px] leading-[1.5] italic max-w-[380px]">
              « Bonjour, je suis Koraly. Dites-moi ce dont vous avez besoin. »
            </p>
            <p className="text-[15px]" style={{ color: "var(--text-on-ink-muted)" }}>
              <strong
                style={{ color: "var(--bg)", fontWeight: 700, fontStyle: "normal" }}
              >
                Vous :
              </strong>{" "}
              « Montre-moi les programmes ce soir. »
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   Services grid
───────────────────────────────────────────── */

function ServicesGrid({
  services,
  onNavigate,
}: {
  services: ServiceCard[];
  onNavigate: (svc: ServiceCard) => void;
}) {
  return (
    <section
      id="services"
      className="py-24 lg:py-28"
      style={{ background: "var(--bg)" }}
      aria-labelledby="services-heading"
    >
      <div className="max-w-[1200px] mx-auto px-10">
        <div className="mb-12">
          <span className="vc-eyebrow">6 services</span>
          <h2
            id="services-heading"
            className="vc-h2 mt-4"
            style={{ color: "var(--text)" }}
          >
            Tout votre quotidien,
            <br />
            accessible par la voix.
          </h2>
          <p
            className="mt-3 text-[17px] max-w-[580px]"
            style={{ color: "var(--text-soft)" }}
          >
            Chaque service est conçu avec des utilisateurs déficients visuels et respecte les normes
            WCAG AAA. Appuyez sur le numéro correspondant pour y accéder directement.
          </p>
        </div>

        <ul
          className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 list-none p-0 m-0"
          aria-label="Services Coraly"
        >
          {services.map((svc) => (
            <li key={svc.slug}>
              <Link
                href={svc.href}
                className="flex flex-col h-full rounded-2xl p-7 no-underline transition-all hover:shadow-lg hover:-translate-y-0.5 focus:outline-none focus:ring-3"
                style={{
                  background: "var(--bg-card)",
                  border: "1px solid var(--border-hi)",
                  color: "var(--text)",
                  boxShadow: "var(--shadow-sm)",
                  // @ts-expect-error CSS custom property
                  "--tw-ring-color": "var(--focus-ring)",
                }}
                onClick={() => onNavigate(svc)}
              >
                {/* Header row */}
                <div className="flex items-start justify-between mb-4">
                  <span className="text-3xl" aria-hidden="true">
                    {svc.icon}
                  </span>
                  <kbd
                    className="text-xs font-mono px-2 py-1 rounded-md"
                    style={{
                      background: "var(--bg-alt)",
                      border: "1px solid var(--border-hi)",
                      color: "var(--text-muted)",
                    }}
                    aria-label={`Raccourci clavier : ${svc.shortcut}`}
                  >
                    {svc.shortcut}
                  </kbd>
                </div>

                {/* Title + tag */}
                <div className="flex items-baseline gap-2 mb-2">
                  <h3 className="vc-h3 m-0">{svc.title}</h3>
                  <span
                    className="text-[11px] font-bold uppercase px-2 py-0.5 rounded"
                    style={{
                      background: "var(--accent)",
                      color: "var(--bg)",
                      letterSpacing: "0.8px",
                    }}
                  >
                    {svc.tag}
                  </span>
                </div>

                {/* Description */}
                <p
                  className="text-[15px] leading-relaxed mb-3 flex-1"
                  style={{ color: "var(--text-soft)" }}
                >
                  {svc.description}
                </p>

                {/* Detail */}
                <p
                  className="text-[13px] leading-relaxed"
                  style={{ color: "var(--text-muted)" }}
                >
                  {svc.detail}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   Comment ça marche
───────────────────────────────────────────── */

function HowSection() {
  return (
    <section
      id="comment-ca-marche"
      className="py-24 lg:py-28"
      style={{ background: "var(--bg-alt)" }}
      aria-labelledby="how-heading"
    >
      <div className="max-w-[1200px] mx-auto px-10">
        <div className="mb-16 text-center">
          <span className="vc-eyebrow">Simple par conception</span>
          <h2
            id="how-heading"
            className="vc-h2 mt-4"
            style={{ color: "var(--text)" }}
          >
            Comment ça marche ?
          </h2>
          <p
            className="mt-3 text-[17px] max-w-[520px] mx-auto"
            style={{ color: "var(--text-soft)" }}
          >
            Trois étapes. Aucun formulaire. Aucune interface à apprendre.
          </p>
        </div>

        <ol
          className="grid gap-8 md:grid-cols-3 list-none p-0 m-0"
          aria-label="Étapes d'utilisation de Koraly"
        >
          {HOW_STEPS.map((step, i) => (
            <li
              key={step.number}
              className="relative flex flex-col rounded-2xl p-8"
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border)",
              }}
            >
              {/* Connector line (not last) */}
              {i < HOW_STEPS.length - 1 && (
                <div
                  aria-hidden="true"
                  className="hidden md:block absolute top-12 left-full w-8 border-t-2 border-dashed"
                  style={{ borderColor: "var(--border-hi)" }}
                />
              )}

              <div
                className="text-4xl mb-5"
                aria-hidden="true"
              >
                {step.icon}
              </div>

              <div
                className="text-[13px] font-bold mb-2"
                style={{ color: "var(--brass)", letterSpacing: "2px" }}
                aria-hidden="true"
              >
                {step.number}
              </div>

              <h3
                className="vc-h3 mb-3"
                style={{ color: "var(--text)" }}
              >
                {step.title}
              </h3>
              <p
                className="text-[15px] leading-[1.65]"
                style={{ color: "var(--text-soft)" }}
              >
                {step.body}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   FAQ
───────────────────────────────────────────── */

function FaqSection() {
  return (
    <section
      id="faq"
      className="py-24 lg:py-28"
      style={{ background: "var(--bg)" }}
      aria-labelledby="faq-heading"
    >
      <div className="max-w-[1200px] mx-auto px-10">
        <span className="vc-eyebrow">Questions fréquentes</span>
        <h2
          id="faq-heading"
          className="vc-h2 mt-4"
          style={{ color: "var(--text)" }}
        >
          Ce qu&apos;on nous demande souvent.
        </h2>
        <p
          className="mt-2 text-[17px] max-w-[640px] mb-12"
          style={{ color: "var(--text-soft)" }}
        >
          Si votre question n&apos;y est pas,{" "}
          <a
            href="mailto:hello@coraly.fr"
            className="underline"
            style={{ color: "var(--accent)" }}
          >
            écrivez-nous
          </a>
          .
        </p>

        <div role="list">
          {FAQ_ITEMS.map((f, i) => (
            <details
              key={f.q}
              role="listitem"
              className="px-7 py-6 border-b"
              style={{
                borderColor: "var(--border)",
                borderTop: i === 0 ? "1px solid var(--border)" : undefined,
              }}
            >
              <summary
                className="text-[19px] font-bold flex justify-between items-center cursor-pointer"
                style={{ color: "var(--text)" }}
              >
                {f.q}
                <span
                  aria-hidden="true"
                  className="text-2xl ml-4 flex-shrink-0"
                  style={{ color: "var(--brass)" }}
                >
                  +
                </span>
              </summary>
              <p
                className="mt-3 text-base leading-[1.65]"
                style={{ color: "var(--text-soft)" }}
              >
                {f.a}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   Footer CTA
───────────────────────────────────────────── */

function CtaSection() {
  return (
    <section
      className="py-32 text-center"
      style={{ background: "var(--accent-ink)", color: "var(--text-on-ink)" }}
      aria-labelledby="cta-heading"
    >
      <div className="max-w-[1200px] mx-auto px-10">
        <span className="vc-eyebrow" style={{ color: "var(--brass)" }}>
          Prêt ?
        </span>
        <h2
          id="cta-heading"
          className="vc-h2 mt-4 mx-auto max-w-[720px]"
          style={{ color: "var(--text-on-ink)" }}
        >
          Commencez maintenant.
          <br />
          Sans inscription. Gratuit.
        </h2>
        <p
          className="mt-5 mx-auto max-w-[560px] text-[19px]"
          style={{ color: "var(--text-on-ink-muted)" }}
        >
          Choisissez un service ci-dessous ou appuyez sur son numéro au clavier. Koraly vous
          attend.
        </p>
        <div className="mt-10 flex flex-wrap gap-4 justify-center">
          {SERVICES.map((svc) => (
            <Link
              key={svc.slug}
              href={svc.href}
              className="px-5 py-3 rounded-md font-bold text-base no-underline inline-flex items-center gap-2 border-[1.5px] transition-opacity hover:opacity-80"
              style={{
                borderColor: "var(--text-on-ink-faint)",
                color: "var(--text-on-ink)",
                background: "transparent",
              }}
            >
              <span aria-hidden="true">{svc.icon}</span>
              {svc.title}
            </Link>
          ))}
        </div>
        <p
          className="mt-8 text-[15px]"
          style={{ color: "var(--text-on-ink-muted)" }}
        >
          Appuyez sur{" "}
          <Kbd dark>1</Kbd> à <Kbd dark>6</Kbd> pour accéder directement à un service.
        </p>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   Utilities
───────────────────────────────────────────── */

function Kbd({ children, dark = false }: { children: React.ReactNode; dark?: boolean }) {
  return (
    <kbd
      className="inline-block px-2 py-0.5 border-[1.5px] rounded text-sm font-bold"
      style={{
        borderColor: dark ? "var(--text-on-ink-faint)" : "var(--border-hi)",
        background: dark ? "rgba(255,255,255,0.08)" : "var(--bg-card)",
        color: dark ? "var(--text-on-ink)" : "var(--text)",
        fontFamily: "ui-monospace, monospace",
      }}
    >
      {children}
    </kbd>
  );
}
