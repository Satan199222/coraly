"use client";

import { useState } from "react";
import Link from "next/link";
import { AccessibilityBar } from "@/components/accessibility-bar";
import { SiteHeader } from "@/components/site-header";
import { Footer } from "@/components/footer";
import { HelpDialog } from "@/components/help-dialog";

const OBSTACLES = [
  "Textes trop petits, difficilement lisibles",
  "Navigation complexe, trop de clics",
  "Vidéos sans sous-titres ni transcriptions",
  "Pas de compatibilité avec les aides techniques (grossissement, lecteurs d'écran)",
  "Interface qui change souvent et déstabilise les repères",
];

const STEPS = [
  {
    num: "1",
    title: "Créez votre compte",
    desc: "Gratuit, sans carte bancaire, en moins de deux minutes.",
  },
  {
    num: "2",
    title: "Choisissez votre thème d'affichage",
    desc: "Pour un confort visuel optimal.",
  },
  {
    num: "3",
    title: "Commencez votre premier cours",
    desc: "Par la voix ou au clavier, comme vous préférez.",
  },
];

/**
 * Pillar page SEO — /guide/application-accessibilite-seniors
 *
 * Mot-clé cible : "application accessibilité seniors"
 * Contenu approuvé par le Board (GROA-202 / approval 6a1942bb).
 * JSON-LD WebPage + BreadcrumbList dans layout.tsx.
 * WCAG AAA : landmarks, heading order, contraste, aria-labels.
 */
export default function AppAccessibiliteSeniorsPage() {
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
                Application accessibilité seniors
              </li>
            </ol>
          </div>
        </nav>

        {/* ── Hero ──────────────────────────────────────────────── */}
        <section
          className="py-14 lg:py-20 border-b"
          aria-labelledby="guide-seniors-title"
          style={{ borderColor: "var(--border)" }}
        >
          <div className="max-w-[800px] mx-auto px-10">
            <span className="vc-eyebrow">Guide · Accessibilité seniors</span>
            <h1
              id="guide-seniors-title"
              className="vc-h1 mt-4 mb-6"
              style={{ color: "var(--text)" }}
            >
              {`L'application qui met la formation en ligne à portée de tous les seniors`}
            </h1>
            <p
              className="text-[19px] leading-[1.75] max-w-[660px]"
              style={{ color: "var(--text-soft)" }}
            >
              {`Apprendre n'a pas d'âge. Pourtant, de nombreuses applications de formation en ligne semblent avoir été conçues pour des personnes nées avec un écran dans les mains : interfaces complexes, textes minuscules, menus à dix niveaux.`}
            </p>
            <p
              className="text-[19px] leading-[1.75] max-w-[660px] mt-4"
              style={{ color: "var(--text-soft)" }}
            >
              {`VoixCourses prend le contre-pied. Parce que chaque personne mérite d'accéder au savoir, sans que son âge ou ses capacités visuelles ne deviennent un obstacle.`}
            </p>
          </div>
        </section>

        {/* ── Contenu article ───────────────────────────────────── */}
        <article
          aria-labelledby="guide-seniors-title"
          className="py-14 lg:py-20"
        >
          <div className="max-w-[800px] mx-auto px-10 flex flex-col gap-14">

            {/* Section 1 — Obstacles */}
            <section aria-labelledby="section-obstacles">
              <h2
                id="section-obstacles"
                className="vc-h2 mb-5"
                style={{ color: "var(--text)" }}
              >
                {`Pourquoi les seniors ont-ils besoin d'une application adaptée\u00a0?`}
              </h2>

              <h3
                className="text-[18px] font-bold mb-4"
                style={{ color: "var(--text)" }}
              >
                Les obstacles courants sur les plateformes classiques
              </h3>
              <ul className="flex flex-col gap-3 mb-8" role="list">
                {OBSTACLES.map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-3 text-[16px] leading-[1.7]"
                    style={{ color: "var(--text-soft)" }}
                  >
                    <span
                      className="mt-1 flex-shrink-0"
                      style={{ color: "var(--danger, #C0392B)" }}
                      aria-hidden="true"
                    >
                      ✗
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
              <p
                className="text-[17px] leading-[1.8] mb-8"
                style={{ color: "var(--text-soft)" }}
              >
                {`Ces obstacles ne sont pas une fatalité. Ils sont le résultat de choix de conception qui n'ont pas pris en compte la diversité des utilisateurs.`}
              </p>

              <h3
                className="text-[18px] font-bold mb-4"
                style={{ color: "var(--text)" }}
              >
                Ce que disent les chiffres
              </h3>
              <ul className="flex flex-col gap-3" role="list">
                <li
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
                  {`1 senior sur 3 renonce à utiliser un service numérique à cause de son manque d'accessibilité`}{" "}
                  <cite style={{ color: "var(--text-muted)" }}>
                    (source&nbsp;: Baromètre du numérique)
                  </cite>
                </li>
                <li
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
                  La fracture numérique touche encore 40&nbsp;% des plus de
                  70&nbsp;ans en France
                </li>
              </ul>
            </section>

            {/* Section 2 — Ce que VoixCourses change */}
            <section aria-labelledby="section-changes">
              <h2
                id="section-changes"
                className="vc-h2 mb-6"
                style={{ color: "var(--text)" }}
              >
                Ce que VoixCourses change pour les seniors
              </h2>

              <div className="grid sm:grid-cols-2 gap-6">
                {[
                  {
                    title: "Une interface qui ne surprend pas",
                    desc:
                      "Mise en page claire, hiérarchie visuelle simple, boutons larges et bien espacés. Chaque écran a été testé avec des utilisateurs seniors pour garantir une prise en main immédiate.",
                  },
                  {
                    title: "Des cours au format adapté",
                    desc:
                      "Courtes séquences vidéo, textes en grande police Luciole, quiz vocaux optionnels. Vous avancez module par module, sans jamais vous sentir perdu.",
                  },
                  {
                    title: "La voix comme boussole",
                    desc:
                      "Vous ne savez pas où vous en êtes\u00a0? Demandez. VoixCourses vous guide, confirme vos actions, et répond à vos questions simples par la voix.",
                  },
                  {
                    title: "Quatre thèmes d'affichage",
                    desc:
                      "Thème clair (défaut), thème sombre, thème jaune-noir (recommandé DMLA), thème blanc-bleu (recommandé glaucome). Choisissez celui qui vous convient le mieux, changez à tout moment.",
                  },
                ].map((item) => (
                  <article
                    key={item.title}
                    className="rounded-xl p-6"
                    style={{
                      background: "var(--bg-surface)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    <h3
                      className="text-[17px] font-bold mb-3"
                      style={{ color: "var(--text)" }}
                    >
                      {item.title}
                    </h3>
                    <p
                      className="text-[15px] leading-[1.7]"
                      style={{ color: "var(--text-soft)" }}
                    >
                      {item.desc}
                    </p>
                  </article>
                ))}
              </div>
            </section>

            {/* Section 3 — Qui utilise */}
            <section aria-labelledby="section-users">
              <h2
                id="section-users"
                className="vc-h2 mb-6"
                style={{ color: "var(--text)" }}
              >
                Qui utilise VoixCourses&nbsp;?
              </h2>

              <div className="flex flex-col gap-5">
                {[
                  {
                    title: "Les seniors autonomes",
                    desc:
                      "Vous avez envie d'apprendre, vous voulez avancer seul. VoixCourses est votre espace d'apprentissage, à vos conditions.",
                  },
                  {
                    title: "Les personnes accompagnées",
                    desc:
                      "Votre aidant, votre famille ou votre structure d'accompagnement peut configurer VoixCourses pour vous, puis vous laisser progresser en toute indépendance.",
                  },
                  {
                    title: "Les associations et EHPAD",
                    desc:
                      "VoixCourses propose une offre Pro pour les structures qui souhaitent proposer la formation en ligne à leurs bénéficiaires, avec suivi des progrès et accompagnement à la prise en main.",
                  },
                ].map((item) => (
                  <div
                    key={item.title}
                    className="flex gap-4 items-start"
                  >
                    <span
                      className="flex-shrink-0 mt-1 text-[18px]"
                      style={{ color: "var(--accent)" }}
                      aria-hidden="true"
                    >
                      →
                    </span>
                    <div>
                      <h3
                        className="text-[17px] font-bold mb-1"
                        style={{ color: "var(--text)" }}
                      >
                        {item.title}
                      </h3>
                      <p
                        className="text-[15px] leading-[1.7]"
                        style={{ color: "var(--text-soft)" }}
                      >
                        {item.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Section 4 — CTA */}
            <section
              aria-labelledby="section-steps"
              className="rounded-2xl p-8 lg:p-10"
              style={{
                background: "var(--bg-surface)",
                border: "1px solid var(--border)",
              }}
            >
              <h2
                id="section-steps"
                className="vc-h2 mb-8"
                style={{ color: "var(--text)" }}
              >
                Commencer en trois étapes
              </h2>

              <ol className="flex flex-col gap-6 mb-8 list-none">
                {STEPS.map((step) => (
                  <li
                    key={step.num}
                    className="flex items-start gap-5"
                  >
                    <span
                      className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-[16px] font-black"
                      style={{
                        background: "var(--accent)",
                        color: "#fff",
                      }}
                      aria-label={`Étape ${step.num}`}
                    >
                      {step.num}
                    </span>
                    <div>
                      <span
                        className="text-[17px] font-bold"
                        style={{ color: "var(--text)" }}
                      >
                        {step.title}
                      </span>
                      <span
                        className="text-[15px] leading-[1.6] ml-2"
                        style={{ color: "var(--text-soft)" }}
                      >
                        — {step.desc}
                      </span>
                    </div>
                  </li>
                ))}
              </ol>

              <Link
                href="/inscription"
                className="inline-block px-8 py-4 rounded-lg text-[17px] font-bold transition-opacity hover:opacity-90 focus:outline-none focus:ring-4 focus:ring-[var(--focus-ring)] focus:ring-offset-2"
                style={{ background: "var(--accent)", color: "#fff" }}
              >
                Commencer gratuitement →
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
