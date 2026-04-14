"use client";

import { useState } from "react";
import Link from "next/link";
import { AccessibilityBar } from "@/components/accessibility-bar";
import { SiteHeader } from "@/components/site-header";
import { Footer } from "@/components/footer";
import { HelpDialog } from "@/components/help-dialog";

const PARTICULIERS_FEATURES = [
  "Accès à l'ensemble du catalogue de cours",
  "Navigation et commandes vocales",
  "Extension Chrome",
  "Interface haute accessibilité (WCAG AA+)",
  "Support par e-mail",
];

const PRO_FEATURES = [
  "Tout ce qui est inclus dans l'offre Particuliers",
  "Gestion multi-utilisateurs depuis un tableau de bord unique",
  "Suivi des progrès de chaque bénéficiaire",
  "Rapports d'avancement exportables",
  "Accompagnement à la prise en main pour votre équipe",
  "Contenu personnalisé sur demande",
];

const FAQ_ITEMS = [
  {
    question: "L'offre gratuite est-elle limitée dans le temps\u00a0?",
    answer:
      "Non. L'accès gratuit est permanent pour les particuliers. Pas de période d'essai, pas de carte bancaire requise.",
  },
  {
    question: "Qu'est-ce qu'une «\u00a0association éligible\u00a0»\u00a0?",
    answer:
      "Tout organisme à but non lucratif, établissement médico-social (EHPAD, SSIAD, centre de jour) ou structure publique accompagnant des personnes âgées ou en situation de handicap.",
  },
];

/**
 * Page /tarifs — Landing page tarification VoixCourses.
 *
 * Contenu approuvé par le Board (GROA-202 / approval 6a1942bb).
 * WCAG AAA : landmarks, heading order, contraste, aria-labels.
 */
export default function TarifsPage() {
  const [helpOpen, setHelpOpen] = useState(false);

  return (
    <>
      <AccessibilityBar onHelpRequest={() => setHelpOpen(true)} />
      <SiteHeader />
      <main id="main" tabIndex={-1}>

        {/* ── Hero ──────────────────────────────────────────────── */}
        <section
          className="py-20 lg:py-28 border-b"
          aria-labelledby="tarifs-title"
          style={{ borderColor: "var(--border)" }}
        >
          <div className="max-w-[720px] mx-auto px-10 text-center">
            <span className="vc-eyebrow">Tarifs · VoixCourses</span>
            <h1
              id="tarifs-title"
              className="vc-h1 mt-4 mb-6"
              style={{ color: "var(--text)" }}
            >
              Simple, transparent, accessible
            </h1>
            <p
              className="text-[19px] leading-[1.75] max-w-[560px] mx-auto"
              style={{ color: "var(--text-soft)" }}
            >
              {`L'apprentissage en ligne ne devrait pas être une question de budget. C'est pourquoi VoixCourses est gratuit pour toute personne qui apprend seule.`}
            </p>
          </div>
        </section>

        {/* ── Offres ────────────────────────────────────────────── */}
        <section
          aria-labelledby="offres-title"
          className="py-20 lg:py-24"
        >
          <div className="max-w-[1000px] mx-auto px-10">
            <h2 id="offres-title" className="sr-only">
              Nos offres
            </h2>

            <div className="grid lg:grid-cols-2 gap-10">

              {/* Offre Particuliers */}
              <article
                aria-labelledby="offre-particuliers-title"
                className="flex flex-col rounded-2xl border p-8 lg:p-10"
                style={{
                  background: "var(--bg-surface)",
                  borderColor: "var(--border)",
                }}
              >
                <span
                  className="vc-eyebrow mb-4"
                >
                  Pour apprendre à votre rythme
                </span>
                <h2
                  id="offre-particuliers-title"
                  className="text-[26px] font-bold mb-2"
                  style={{ color: "var(--text)" }}
                >
                  Particuliers
                </h2>
                <p
                  className="text-[32px] font-black mb-6"
                  style={{ color: "var(--accent)" }}
                  aria-label="Prix : gratuit, sans conditions"
                >
                  Gratuit
                  <span
                    className="text-[15px] font-normal ml-2"
                    style={{ color: "var(--text-muted)" }}
                  >
                    sans conditions
                  </span>
                </p>

                <ul className="flex flex-col gap-3 mb-8 flex-1" role="list">
                  {PARTICULIERS_FEATURES.map((feat) => (
                    <li
                      key={feat}
                      className="flex items-start gap-3 text-[16px] leading-[1.6]"
                      style={{ color: "var(--text-soft)" }}
                    >
                      <span
                        className="mt-1 flex-shrink-0 text-[14px]"
                        style={{ color: "var(--accent)" }}
                        aria-hidden="true"
                      >
                        ✓
                      </span>
                      {feat}
                    </li>
                  ))}
                </ul>

                <Link
                  href="/inscription"
                  className="block w-full text-center py-4 rounded-lg text-[16px] font-bold transition-opacity hover:opacity-90 focus:outline-none focus:ring-4 focus:ring-[var(--focus-ring)] focus:ring-offset-2"
                  style={{ background: "var(--accent)", color: "#fff" }}
                >
                  Créer mon compte gratuitement
                </Link>
              </article>

              {/* Offre Pro */}
              <article
                aria-labelledby="offre-pro-title"
                className="flex flex-col rounded-2xl border-2 p-8 lg:p-10"
                style={{
                  background: "var(--accent-ink, var(--bg-surface))",
                  borderColor: "var(--brass)",
                }}
              >
                <span
                  className="vc-eyebrow mb-4"
                  style={{ color: "var(--brass)" }}
                >
                  Pour accompagner vos bénéficiaires
                </span>
                <h2
                  id="offre-pro-title"
                  className="text-[26px] font-bold mb-2"
                  style={{ color: "var(--text)" }}
                >
                  Pro — Associations&nbsp;&amp; structures médico-sociales
                </h2>
                <p
                  className="text-[17px] font-semibold mb-6"
                  style={{ color: "var(--brass)" }}
                  aria-label="Prix : sur devis, contactez-nous"
                >
                  Sur devis
                </p>

                <ul className="flex flex-col gap-3 mb-8 flex-1" role="list">
                  {PRO_FEATURES.map((feat) => (
                    <li
                      key={feat}
                      className="flex items-start gap-3 text-[16px] leading-[1.6]"
                      style={{ color: "var(--text-soft)" }}
                    >
                      <span
                        className="mt-1 flex-shrink-0 text-[14px]"
                        style={{ color: "var(--brass)" }}
                        aria-hidden="true"
                      >
                        ✓
                      </span>
                      {feat}
                    </li>
                  ))}
                </ul>

                <p
                  className="text-[15px] leading-[1.6] mb-6"
                  style={{ color: "var(--text-soft)" }}
                >
                  Contactez-nous pour un accompagnement adapté à votre structure.
                </p>

                <a
                  href="mailto:pro@voixcourses.fr"
                  className="block w-full text-center py-4 rounded-lg text-[16px] font-bold border-2 transition-opacity hover:opacity-90 focus:outline-none focus:ring-4 focus:ring-[var(--focus-ring)] focus:ring-offset-2"
                  style={{ borderColor: "var(--brass)", color: "var(--brass)", background: "transparent" }}
                >
                  Demander un devis
                </a>
              </article>

            </div>
          </div>
        </section>

        {/* ── FAQ ───────────────────────────────────────────────── */}
        <section
          aria-labelledby="faq-title"
          className="py-16 border-t"
          style={{ borderColor: "var(--border)" }}
        >
          <div className="max-w-[720px] mx-auto px-10">
            <h2
              id="faq-title"
              className="vc-h2 mb-10"
              style={{ color: "var(--text)" }}
            >
              Questions fréquentes
            </h2>

            <dl className="flex flex-col gap-8">
              {FAQ_ITEMS.map((item) => (
                <div key={item.question}>
                  <dt
                    className="text-[18px] font-bold mb-3"
                    style={{ color: "var(--text)" }}
                  >
                    {item.question}
                  </dt>
                  <dd
                    className="text-[16px] leading-[1.8]"
                    style={{ color: "var(--text-soft)" }}
                  >
                    {item.answer}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

      </main>
      <Footer />
      <HelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
    </>
  );
}
