"use client";

import { useState } from "react";
import Link from "next/link";
import { AccessibilityBar } from "@/components/accessibility-bar";
import { SiteHeader } from "@/components/site-header";
import { Footer } from "@/components/footer";
import { HelpDialog } from "@/components/help-dialog";

const VOCAL_COMMANDS = [
  "« Commencer le cours »",
  "« Chapitre suivant »",
  "« Répéter »",
  "« Mettre en pause »",
  "« Revenir au menu »",
];

const A11Y_FEATURES = [
  "Police Luciole pour une meilleure lisibilité",
  "Contrastes élevés",
  "Navigation au clavier complète",
  "Compatibilité lecteurs d'écran (NVDA, JAWS, VoiceOver)",
];

const USE_CASES = [
  "les personnes à mobilité réduite ou souffrant de tremblements",
  "les personnes malvoyantes qui utilisent déjà un lecteur d'écran",
  "les seniors peu à l'aise avec les interfaces numériques complexes",
  "toute personne qui préfère simplement écouter et parler",
];

/**
 * Pillar page SEO — /guide/assistant-vocal-cours-en-ligne
 *
 * Mot-clé cible : "assistant vocal cours en ligne"
 * Contenu approuvé par le Board (GROA-202 / approval 6a1942bb).
 * JSON-LD WebPage + BreadcrumbList dans layout.tsx.
 * WCAG AAA : landmarks, heading order, contraste, aria-labels.
 */
export default function AssistantVocalPage() {
  const [helpOpen, setHelpOpen] = useState(false);

  return (
    <>
      <AccessibilityBar onHelpRequest={() => setHelpOpen(true)} />
      <SiteHeader />
      <main id="main" tabIndex={-1}>

        {/* ── Breadcrumb ────────────────────────────────────────── */}
        <nav
          aria-label="Fil d'Ariane"
          className="py-4 border-b"
          style={{ borderColor: "var(--border)" }}
        >
          <div className="max-w-[800px] mx-auto px-10">
            <ol className="flex items-center gap-2 text-[13px] list-none flex-wrap">
              <li>
                <Link
                  href="/"
                  className="hover:underline focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2 rounded"
                  style={{ color: "var(--accent)" }}
                >
                  Accueil
                </Link>
              </li>
              <li aria-hidden="true" style={{ color: "var(--text-muted)" }}>/</li>
              <li>
                <span style={{ color: "var(--text-soft)" }}>Guides</span>
              </li>
              <li aria-hidden="true" style={{ color: "var(--text-muted)" }}>/</li>
              <li
                aria-current="page"
                style={{ color: "var(--text-soft)" }}
              >
                Assistant vocal pour cours en ligne
              </li>
            </ol>
          </div>
        </nav>

        {/* ── Hero ──────────────────────────────────────────────── */}
        <section
          className="py-14 lg:py-20 border-b"
          aria-labelledby="guide-title"
          style={{ borderColor: "var(--border)" }}
        >
          <div className="max-w-[800px] mx-auto px-10">
            <span className="vc-eyebrow">Guide · Assistant vocal</span>
            <h1
              id="guide-title"
              className="vc-h1 mt-4 mb-6"
              style={{ color: "var(--text)" }}
            >
              {`L'assistant vocal qui transforme votre façon d'apprendre en ligne`}
            </h1>
            <p
              className="text-[19px] leading-[1.75] max-w-[660px]"
              style={{ color: "var(--text-soft)" }}
            >
              {`Apprendre en ligne, c'est formidable — à condition de pouvoir naviguer facilement entre les modules, mettre en pause, reprendre, revenir en arrière. Pour beaucoup de personnes, les interfaces traditionnelles posent des obstacles : petits boutons, menus complexes, souris difficile à manier.`}
            </p>
            <p
              className="text-[19px] leading-[1.75] max-w-[660px] mt-4"
              style={{ color: "var(--text-soft)" }}
            >
              Un assistant vocal change tout. Avec VoixCourses, votre voix
              devient la seule télécommande dont vous avez besoin.
            </p>
          </div>
        </section>

        {/* ── Contenu article ───────────────────────────────────── */}
        <article
          aria-labelledby="guide-title"
          className="py-14 lg:py-20"
        >
          <div className="max-w-[800px] mx-auto px-10 flex flex-col gap-14">

            {/* Section 1 */}
            <section aria-labelledby="section-definition">
              <h2
                id="section-definition"
                className="vc-h2 mb-5"
                style={{ color: "var(--text)" }}
              >
                {`Qu'est-ce qu'un assistant vocal pour cours en ligne\u00a0?`}
              </h2>
              <p
                className="text-[17px] leading-[1.8]"
                style={{ color: "var(--text-soft)" }}
              >
                {`Un assistant vocal est un système qui reconnaît vos instructions orales et agit en conséquence dans l'application. Dans le contexte de la formation en ligne, cela signifie que vous pouvez démarrer un cours, passer au chapitre suivant, demander une répétition ou mettre en pause — simplement en parlant.`}
              </p>
              <p
                className="text-[17px] leading-[1.8] mt-4"
                style={{ color: "var(--text-soft)" }}
              >
                Pas de clics. Pas de défilement. Juste votre voix.
              </p>
            </section>

            {/* Section 2 */}
            <section aria-labelledby="section-why-voice">
              <h2
                id="section-why-voice"
                className="vc-h2 mb-5"
                style={{ color: "var(--text)" }}
              >
                Pourquoi utiliser la voix pour apprendre&nbsp;?
              </h2>

              <h3
                className="text-[18px] font-bold mb-3"
                style={{ color: "var(--text)" }}
              >
                Moins de friction, plus de concentration
              </h3>
              <p
                className="text-[17px] leading-[1.8] mb-6"
                style={{ color: "var(--text-soft)" }}
              >
                {`Quand vous n'avez pas à chercher où cliquer, vous restez dans le flux d'apprentissage. Votre attention reste sur le contenu, pas sur l'interface.`}
              </p>

              <h3
                className="text-[18px] font-bold mb-3"
                style={{ color: "var(--text)" }}
              >
                Une solution naturelle pour de nombreuses situations
              </h3>
              <p
                className="text-[16px] leading-[1.7] mb-3"
                style={{ color: "var(--text-soft)" }}
              >
                La commande vocale est particulièrement utile pour&nbsp;:
              </p>
              <ul className="flex flex-col gap-2 mb-6" role="list">
                {USE_CASES.map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-3 text-[16px] leading-[1.7]"
                    style={{ color: "var(--text-soft)" }}
                  >
                    <span
                      className="mt-1 flex-shrink-0"
                      style={{ color: "var(--accent)" }}
                      aria-hidden="true"
                    >
                      –
                    </span>
                    {item}
                  </li>
                ))}
              </ul>

              <h3
                className="text-[18px] font-bold mb-3"
                style={{ color: "var(--text)" }}
              >
                {`L'autonomie, sans aide extérieure`}
              </h3>
              <p
                className="text-[17px] leading-[1.8]"
                style={{ color: "var(--text-soft)" }}
              >
                {`Avec un assistant vocal bien conçu, vous n'avez plus besoin de demander de l'aide pour naviguer dans vos cours. C'est vous qui décidez, à votre rythme.`}
              </p>
            </section>

            {/* Section 3 */}
            <section aria-labelledby="section-how-it-works">
              <h2
                id="section-how-it-works"
                className="vc-h2 mb-5"
                style={{ color: "var(--text)" }}
              >
                {`Comment fonctionne l'assistant vocal VoixCourses\u00a0?`}
              </h2>
              <p
                className="text-[17px] leading-[1.8] mb-6"
                style={{ color: "var(--text-soft)" }}
              >
                {`VoixCourses intègre un assistant vocal natif, disponible dès l'ouverture de l'application. Il reconnaît les commandes en français, même avec des accents régionaux ou une diction lente.`}
              </p>

              <h3
                className="text-[16px] font-bold mb-3"
                style={{ color: "var(--text)" }}
              >
                Commandes disponibles (exemples)&nbsp;:
              </h3>
              <ul
                className="flex flex-col gap-2 mb-6 rounded-xl p-5"
                role="list"
                style={{
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border)",
                }}
              >
                {VOCAL_COMMANDS.map((cmd) => (
                  <li
                    key={cmd}
                    className="text-[16px] font-medium"
                    style={{ color: "var(--accent)" }}
                  >
                    {cmd}
                  </li>
                ))}
              </ul>

              <p
                className="text-[17px] leading-[1.8]"
                style={{ color: "var(--text-soft)" }}
              >
                {`L'assistant vous confirme chaque action par une courte réponse vocale, pour que vous sachiez toujours ce qui se passe.`}
              </p>
            </section>

            {/* Section 4 */}
            <section aria-labelledby="section-beyond-voice">
              <h2
                id="section-beyond-voice"
                className="vc-h2 mb-5"
                style={{ color: "var(--text)" }}
              >
                VoixCourses, accessible bien au-delà de la voix
              </h2>
              <p
                className="text-[17px] leading-[1.8] mb-5"
                style={{ color: "var(--text-soft)" }}
              >
                {`L'assistant vocal est l'une des fonctionnalités de VoixCourses, mais pas la seule. L'interface complète a été conçue selon les standards WCAG AA+\u00a0:`}
              </p>
              <ul className="flex flex-col gap-2" role="list">
                {A11Y_FEATURES.map((feat) => (
                  <li
                    key={feat}
                    className="flex items-start gap-3 text-[16px] leading-[1.7]"
                    style={{ color: "var(--text-soft)" }}
                  >
                    <span
                      className="mt-1 flex-shrink-0"
                      style={{ color: "var(--accent)" }}
                      aria-hidden="true"
                    >
                      ✓
                    </span>
                    {feat}
                  </li>
                ))}
              </ul>
            </section>

            {/* Section 5 — CTA */}
            <section
              aria-labelledby="section-cta"
              className="rounded-2xl p-8 lg:p-10 text-center"
              style={{
                background: "var(--bg-surface)",
                border: "1px solid var(--border)",
              }}
            >
              <h2
                id="section-cta"
                className="vc-h2 mb-4"
                style={{ color: "var(--text)" }}
              >
                Commencer gratuitement
              </h2>
              <p
                className="text-[17px] leading-[1.7] mb-8 max-w-[480px] mx-auto"
                style={{ color: "var(--text-soft)" }}
              >
                VoixCourses est gratuit pour tous les particuliers. Créez votre
                compte en moins de deux minutes et commencez à apprendre à votre
                rythme, avec votre voix.
              </p>
              <Link
                href="/inscription"
                className="inline-block px-8 py-4 rounded-lg text-[17px] font-bold transition-opacity hover:opacity-90 focus:outline-none focus:ring-4 focus:ring-[var(--focus-ring)] focus:ring-offset-2"
                style={{ background: "var(--accent)", color: "#fff" }}
              >
                Créer mon compte gratuitement →
              </Link>
            </section>

          </div>
        </article>

      </main>
      <Footer />
      <HelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
    </>
  );
}
