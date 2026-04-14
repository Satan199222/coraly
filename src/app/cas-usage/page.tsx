"use client";

import { useState } from "react";
import Link from "next/link";
import { AccessibilityBar } from "@/components/accessibility-bar";
import { SiteHeader } from "@/components/site-header";
import { Footer } from "@/components/footer";
import { HelpDialog } from "@/components/help-dialog";

/**
 * Page /cas-usage — Landing page audiences cibles VoixCourses.
 *
 * Contenu approuvé par le Board (GROA-202 / approval 6a1942bb).
 * WCAG AAA : landmarks, heading order, contraste, aria-labels.
 */
export default function CasUsagePage() {
  const [helpOpen, setHelpOpen] = useState(false);

  return (
    <>
      <AccessibilityBar onHelpRequest={() => setHelpOpen(true)} />
      <SiteHeader />
      <main id="main" tabIndex={-1}>

        {/* ── Hero ──────────────────────────────────────────────── */}
        <section
          className="py-20 lg:py-28 border-b"
          aria-labelledby="cas-usage-title"
          style={{ borderColor: "var(--border)" }}
        >
          <div className="max-w-[860px] mx-auto px-10">
            <span className="vc-eyebrow">{"Cas d'usage · VoixCourses"}</span>
            <h1
              id="cas-usage-title"
              className="vc-h1 mt-4 mb-6"
              style={{ color: "var(--text)" }}
            >
              Pour les seniors, les personnes malvoyantes et les aidants
            </h1>
            <p
              className="text-[19px] leading-[1.75] max-w-[640px]"
              style={{ color: "var(--text-soft)" }}
            >
              {`VoixCourses a été pensé pour celles et ceux qui méritent une vraie aide — pas une interface qui décourage. Chaque fonctionnalité est conçue pour l'autonomie et l'indépendance.`}
            </p>
          </div>
        </section>

        {/* ── Seniors ───────────────────────────────────────────── */}
        <section
          aria-labelledby="seniors-title"
          className="py-20 lg:py-24 border-b"
          style={{ borderColor: "var(--border)" }}
        >
          <div className="max-w-[860px] mx-auto px-10">
            <span
              className="vc-eyebrow mb-4 block"
            >
              Seniors
            </span>
            <h2
              id="seniors-title"
              className="vc-h2 mb-6"
              style={{ color: "var(--text)" }}
            >
              Continuez à apprendre, en toute autonomie
            </h2>
            <p
              className="text-[17px] leading-[1.8] max-w-[660px] mb-4"
              style={{ color: "var(--text-soft)" }}
            >
              Vous souhaitez maîtriser votre smartphone, découvrir de nouveaux
              loisirs ou rester connecté à ce qui vous intéresse&nbsp;?
              VoixCourses vous propose des cours clairs, progressifs, que vous
              avancez à votre rythme — et que vous pouvez commander entièrement
              par la voix.
            </p>
            <p
              className="text-[17px] leading-[1.8] max-w-[660px] mb-8"
              style={{ color: "var(--text-soft)" }}
            >
              {`Pas besoin d'être à l'aise avec la technologie pour commencer. VoixCourses a été pensé pour celles et ceux qui méritent une vraie aide, pas une interface qui les décourage.`}
            </p>
            <Link
              href="/courses"
              className="inline-flex items-center gap-2 text-[16px] font-semibold underline underline-offset-2 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2 rounded"
              style={{ color: "var(--accent)" }}
            >
              Découvrir les cours pour seniors →
            </Link>
          </div>
        </section>

        {/* ── Personnes malvoyantes ─────────────────────────────── */}
        <section
          aria-labelledby="malvoyants-title"
          className="py-20 lg:py-24 border-b"
          style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}
        >
          <div className="max-w-[860px] mx-auto px-10">
            <span className="vc-eyebrow mb-4 block">
              Personnes malvoyantes
            </span>
            <h2
              id="malvoyants-title"
              className="vc-h2 mb-6"
              style={{ color: "var(--text)" }}
            >
              Des cours faits pour être entendus autant que vus
            </h2>
            <p
              className="text-[17px] leading-[1.8] max-w-[660px] mb-4"
              style={{ color: "var(--text-soft)" }}
            >
              {`Chez VoixCourses, l'accessibilité n'est pas une case à cocher\u00a0: c'est le point de départ. Chaque écran est conçu pour fonctionner avec un lecteur d'écran. La police Luciole, spécialement développée pour les personnes malvoyantes, est utilisée partout. Les contrastes dépassent les seuils WCAG AAA sur l'ensemble de l'interface.`}
            </p>
            <p
              className="text-[17px] leading-[1.8] max-w-[660px] mb-8"
              style={{ color: "var(--text-soft)" }}
            >
              {`Et si vous préférez écouter plutôt que lire, l'assistant vocal est là, disponible à tout moment.`}
            </p>
            <Link
              href="/courses"
              className="inline-flex items-center gap-2 text-[16px] font-semibold underline underline-offset-2 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2 rounded"
              style={{ color: "var(--accent)" }}
            >
              Explorer les cours accessibles →
            </Link>
          </div>
        </section>

        {/* ── Aidants ───────────────────────────────────────────── */}
        <section
          aria-labelledby="aidants-title"
          className="py-20 lg:py-24"
        >
          <div className="max-w-[860px] mx-auto px-10">
            <span className="vc-eyebrow mb-4 block">
              Aidants
            </span>
            <h2
              id="aidants-title"
              className="vc-h2 mb-6"
              style={{ color: "var(--text)" }}
            >
              {`Offrez l'indépendance à ceux que vous accompagnez`}
            </h2>
            <p
              className="text-[17px] leading-[1.8] max-w-[660px] mb-4"
              style={{ color: "var(--text-soft)" }}
            >
              Vous aidez un parent, un conjoint ou un ami au quotidien&nbsp;?
              {`Vous savez combien l'autonomie compte — pour eux comme pour vous.`}
            </p>
            <p
              className="text-[17px] leading-[1.8] max-w-[660px] mb-8"
              style={{ color: "var(--text-soft)" }}
            >
              {`VoixCourses permet à votre proche d'avancer seul, à son rythme, sans avoir besoin de vous appeler à chaque étape. Simple à prendre en main, rassurant dans son utilisation, il est conçu pour que l'apprentissage reste une expérience positive et motivante.`}
            </p>
            <Link
              href="/tarifs"
              className="inline-flex items-center gap-2 text-[16px] font-semibold underline underline-offset-2 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2 rounded"
              style={{ color: "var(--accent)" }}
            >
              {`En savoir plus sur l'offre aidants →`}
            </Link>
          </div>
        </section>

      </main>
      <Footer />
      <HelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
    </>
  );
}
