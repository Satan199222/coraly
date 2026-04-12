"use client";

import Link from "next/link";
import { KoralyOrb } from "./koraly-orb";

interface HeroSectionProps {
  onListenDemo?: () => void;
}

/**
 * Hero de la home : eyebrow + h1 + lede + CTAs + raccourcis clavier d'un côté,
 * orb Koraly animée avec transcript d'exemple de l'autre.
 */
export function HeroSection({ onListenDemo }: HeroSectionProps = {}) {
  return (
    <section className="py-20 lg:py-24">
      <div className="max-w-[1200px] mx-auto px-10 grid gap-16 items-center lg:grid-cols-[1.15fr_1fr]">
        <div>
          <span className="vc-eyebrow">Accessibilité première · Conforme AAA</span>
          <h1 className="vc-h1 mt-5 mb-6" style={{ color: "var(--text)" }}>
            Vos courses,
            <br />
            par la voix.
          </h1>
          <p className="text-[21px] leading-[1.55] max-w-[540px] mb-8" style={{ color: "var(--text-soft)" }}>
            Dites ce que vous voulez. Koraly compose votre panier chez Carrefour, Auchan, Monoprix et
            d&apos;autres. Clavier, vocal guidé ou conversation libre — vous choisissez votre confort,
            à tout moment.
          </p>

          <div className="flex gap-3.5 flex-wrap items-center">
            <Link
              href="/courses"
              className="px-7 py-4 rounded-md font-bold text-base inline-flex items-center gap-2.5 no-underline"
              style={{ background: "var(--accent)", color: "var(--bg)", letterSpacing: "0.3px" }}
            >
              Commencer mes courses
            </Link>
            <button
              type="button"
              onClick={onListenDemo}
              className="px-6 py-3.5 rounded-md font-bold text-base bg-transparent border-[1.5px] inline-flex items-center gap-2.5"
              style={{ borderColor: "var(--text)", color: "var(--text)" }}
            >
              🔊 Écouter la démonstration
            </button>
          </div>

          <div
            className="mt-6 text-[15px] flex flex-wrap gap-5"
            style={{ color: "var(--text-muted)" }}
            aria-label="Raccourcis clavier"
          >
            <span className="inline-flex items-center gap-1.5">
              <Kbd>Espace</Kbd> parler à Koraly
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Kbd>Tab</Kbd> naviguer
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Kbd>Échap</Kbd> arrêter
            </span>
          </div>
        </div>

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
              background: "radial-gradient(circle at 30% 20%, rgba(181,136,66,0.25), transparent 55%)",
            }}
          />
          <div className="relative flex flex-col items-center text-center gap-5">
            <span
              className="text-[13px] font-bold uppercase inline-flex items-center gap-2"
              style={{ letterSpacing: "2px", color: "var(--brass)" }}
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ background: "var(--brass)", animation: "vc-pulse 2s ease-in-out infinite" }}
              />
              Koraly écoute
            </span>
            <KoralyOrb status="listening" />
            <p className="text-[17px] leading-[1.5] italic max-w-[380px]">
              « Bonjour, je suis Koraly. Dites-moi ce dont vous avez besoin. »
            </p>
            <p className="text-[15px]" style={{ color: "var(--text-on-ink-muted)" }}>
              <strong style={{ color: "var(--bg)", fontWeight: 700, fontStyle: "normal" }}>
                Vous :
              </strong>{" "}
              « Pommes Golden, lait demi-écrémé, pain complet. »
            </p>
            <button
              type="button"
              onClick={onListenDemo}
              className="mt-2 px-4 py-2 rounded-md border-[1.5px] font-bold text-sm inline-flex items-center gap-2"
              style={{ borderColor: "var(--brass)", color: "var(--text-on-ink)" }}
            >
              ▶ Écouter la voix de Koraly
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd
      className="inline-block px-2 py-0.5 border-[1.5px] rounded text-sm font-bold"
      style={{
        borderColor: "var(--border-hi)",
        background: "var(--bg-card)",
        color: "var(--text)",
        fontFamily: "ui-monospace, monospace",
      }}
    >
      {children}
    </kbd>
  );
}
