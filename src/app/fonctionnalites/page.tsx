"use client";

import { useState } from "react";
import Link from "next/link";
import { AccessibilityBar } from "@/components/accessibility-bar";
import { SiteHeader } from "@/components/site-header";
import { Footer } from "@/components/footer";
import { HelpDialog } from "@/components/help-dialog";

/**
 * Page /fonctionnalites — Landing page VoixCourses.
 *
 * Contenu approuvé par le Board (GROA-202 / approval 6a1942bb).
 * WCAG AAA : landmarks, heading order, contraste, aria-labels.
 */
export default function FonctionnalitesPage() {
  const [helpOpen, setHelpOpen] = useState(false);

  return (
    <>
      <AccessibilityBar onHelpRequest={() => setHelpOpen(true)} />
      <SiteHeader />
      <main id="main" tabIndex={-1}>

        {/* ── Hero ──────────────────────────────────────────────── */}
        <section
          className="py-20 lg:py-28 border-b"
          aria-labelledby="fonctionnalites-title"
          style={{ borderColor: "var(--border)" }}
        >
          <div className="max-w-[860px] mx-auto px-10">
            <span className="vc-eyebrow">Fonctionnalités · VoixCourses</span>
            <h1
              id="fonctionnalites-title"
              className="vc-h1 mt-4 mb-6"
              style={{ color: "var(--text)" }}
            >
              Apprenez à votre rythme, avec votre voix
            </h1>
            <p
              className="text-[19px] leading-[1.75] max-w-[640px] mb-10"
              style={{ color: "var(--text-soft)" }}
            >
              VoixCourses rend la formation en ligne véritablement accessible.
              Commandez tout par la voix, lisez sans effort, avancez à votre
              propre tempo.
            </p>
            <Link
              href="/inscription"
              className="inline-block px-8 py-4 rounded-lg text-[17px] font-bold transition-opacity hover:opacity-90 focus:outline-none focus:ring-4 focus:ring-[var(--focus-ring)] focus:ring-offset-2"
              style={{ background: "var(--accent)", color: "#fff" }}
            >
              Commencer gratuitement
            </Link>
          </div>
        </section>

        {/* ── Fonctionnalités ───────────────────────────────────── */}
        <section
          aria-labelledby="features-title"
          className="py-20 lg:py-24"
        >
          <div className="max-w-[960px] mx-auto px-10">
            <h2 id="features-title" className="sr-only">
              Nos fonctionnalités
            </h2>

            <div className="grid gap-16 lg:gap-20">

              {/* Fonctionnalité 1 — Navigation vocale */}
              <article
                aria-labelledby="feat-voice-title"
                className="flex flex-col lg:flex-row gap-10 items-start"
              >
                <div
                  className="flex-shrink-0 w-16 h-16 rounded-2xl flex items-center justify-center text-3xl"
                  style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}
                  aria-hidden="true"
                >
                  🎙️
                </div>
                <div>
                  <h2
                    id="feat-voice-title"
                    className="vc-h2 mb-4"
                    style={{ color: "var(--text)" }}
                  >
                    Votre voix, votre télécommande
                  </h2>
                  <p
                    className="text-[17px] leading-[1.8] max-w-[600px]"
                    style={{ color: "var(--text-soft)" }}
                  >
                    Dites «&nbsp;cours suivant&nbsp;», «&nbsp;répéter&nbsp;»,
                    «&nbsp;mettre en pause&nbsp;» — VoixCourses vous obéit. Plus
                    besoin de chercher le bon bouton. Vous restez concentré sur
                    ce qui compte&nbsp;: apprendre.
                  </p>
                </div>
              </article>

              <hr style={{ borderColor: "var(--border)" }} />

              {/* Fonctionnalité 2 — Accessibilité WCAG */}
              <article
                aria-labelledby="feat-a11y-title"
                className="flex flex-col lg:flex-row gap-10 items-start"
              >
                <div
                  className="flex-shrink-0 w-16 h-16 rounded-2xl flex items-center justify-center text-3xl"
                  style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}
                  aria-hidden="true"
                >
                  ♿
                </div>
                <div>
                  <h2
                    id="feat-a11y-title"
                    className="vc-h2 mb-4"
                    style={{ color: "var(--text)" }}
                  >
                    Conçu pour être utilisé par tous
                  </h2>
                  <p
                    className="text-[17px] leading-[1.8] max-w-[600px]"
                    style={{ color: "var(--text-soft)" }}
                  >
                    {`Contrastes élevés, police Luciole spécialement développée pour les personnes malvoyantes, compatibilité totale avec les lecteurs d'écran — VoixCourses respecte les standards d'accessibilité les plus exigeants. Parce que l'accès au savoir ne devrait pas avoir de conditions.`}
                  </p>
                </div>
              </article>

              <hr style={{ borderColor: "var(--border)" }} />

              {/* Fonctionnalité 3 — Extension Chrome */}
              <article
                aria-labelledby="feat-chrome-title"
                className="flex flex-col lg:flex-row gap-10 items-start"
              >
                <div
                  className="flex-shrink-0 w-16 h-16 rounded-2xl flex items-center justify-center text-3xl"
                  style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}
                  aria-hidden="true"
                >
                  🧩
                </div>
                <div>
                  <h2
                    id="feat-chrome-title"
                    className="vc-h2 mb-4"
                    style={{ color: "var(--text)" }}
                  >
                    Disponible là où vous êtes
                  </h2>
                  <p
                    className="text-[17px] leading-[1.8] max-w-[600px]"
                    style={{ color: "var(--text-soft)" }}
                  >
                    {`Pas de téléchargement, pas d'installation compliquée. Ajoutez l'extension VoixCourses à votre navigateur et commencez à apprendre en quelques secondes, depuis n'importe quelle page.`}
                  </p>
                </div>
              </article>

            </div>
          </div>
        </section>

        {/* ── CTA final ─────────────────────────────────────────── */}
        <section
          aria-labelledby="cta-title"
          className="py-16 border-t"
          style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}
        >
          <div className="max-w-[640px] mx-auto px-10 text-center">
            <h2
              id="cta-title"
              className="vc-h2 mb-4"
              style={{ color: "var(--text)" }}
            >
              Prêt à apprendre autrement&nbsp;?
            </h2>
            <p
              className="text-[17px] leading-[1.7] mb-8"
              style={{ color: "var(--text-soft)" }}
            >
              {`Créez votre compte gratuitement et commencez dès aujourd'hui.`}
            </p>
            <Link
              href="/inscription"
              className="inline-block px-8 py-4 rounded-lg text-[17px] font-bold transition-opacity hover:opacity-90 focus:outline-none focus:ring-4 focus:ring-[var(--focus-ring)] focus:ring-offset-2"
              style={{ background: "var(--accent)", color: "#fff" }}
            >
              Commencer gratuitement
            </Link>
          </div>
        </section>

      </main>
      <Footer />
      <HelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
    </>
  );
}
