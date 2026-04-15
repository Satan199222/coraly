"use client";

import { useState } from "react";
import { AccessibilityBar } from "@/lib/shared/components/accessibility-bar";
import { SiteHeader } from "@/components/site-header";
import { Footer } from "@/components/footer";
import { HelpDialog } from "@/components/help-dialog";
import { useDocumentTitle } from "@/lib/useDocumentTitle";

const PERKS = [
  {
    icon: "🎧",
    title: "Accès prioritaire",
    body: "Vous êtes parmi les premières personnes à tester Coraly avant son lancement public. Votre retour façonnera le produit.",
  },
  {
    icon: "♿",
    title: "Partenaires accessibilité",
    body: "Nous co-construisons avec des utilisateurs malvoyants, non-voyants et seniors. Chaque retour est lu, documenté et traité.",
  },
  {
    icon: "🇫🇷",
    title: "Conçu en France",
    body: "Projet 100 % français, développé en Moselle, conforme RGAA AAA et à la Directive Européenne d'Accessibilité 2025.",
  },
  {
    icon: "📞",
    title: "Contact direct",
    body: "Échangez directement avec l'équipe. Pas de ticketing anonyme : vos retours arrivent aux développeurs qui corrigent.",
  },
];

/**
 * Page /beta — Landing programme bêta Coraly.
 * Présente le programme et remercie les testeurs.
 */
export default function BetaPage() {
  useDocumentTitle("Programme Bêta — Coraly");

  const [helpOpen, setHelpOpen] = useState(false);

  return (
    <>
      <AccessibilityBar onHelpRequest={() => setHelpOpen(true)} />
      <SiteHeader />
      <main id="main" tabIndex={-1}>
        {/* ── Hero ──────────────────────────────────────────────── */}
        <section className="py-20 lg:py-24" aria-labelledby="beta-hero-title">
          <div className="max-w-[900px] mx-auto px-10 text-center">
            <span className="vc-eyebrow">Programme Bêta · Places limitées</span>
            <h1
              id="beta-hero-title"
              className="vc-h1 mt-5 mb-6"
              style={{ color: "var(--text)" }}
            >
              Bienvenue dans la bêta
              <br />
              Coraly.
            </h1>
            <p
              className="text-[20px] leading-[1.6] max-w-[640px] mx-auto"
              style={{ color: "var(--text-soft)" }}
            >
              Vous utilisez un lecteur d&apos;écran, avez une déficience
              visuelle ou accompagnez une personne concernée ? Vous faites partie
              des pionniers qui nous aident à construire l&apos;assistant vocal
              de courses le plus accessible de France.
            </p>
          </div>
        </section>

        {/* ── Avantages ─────────────────────────────────────────── */}
        <section aria-labelledby="perks-title" className="pb-16">
          <div className="max-w-[1100px] mx-auto px-10">
            <h2
              id="perks-title"
              className="vc-h2 text-center mb-12"
              style={{ color: "var(--text)" }}
            >
              Ce que vous apportez, ce que vous gagnez
            </h2>
            <ul className="grid gap-6 sm:grid-cols-2 list-none" role="list">
              {PERKS.map((perk) => (
                <li
                  key={perk.title}
                  className="p-8 rounded-xl border"
                  style={{
                    background: "var(--bg-card)",
                    borderColor: "var(--border)",
                    boxShadow: "var(--shadow-sm)",
                  }}
                >
                  <div className="text-4xl mb-4" aria-hidden="true">
                    {perk.icon}
                  </div>
                  <h3
                    className="text-[18px] font-bold mb-2"
                    style={{ color: "var(--accent)" }}
                  >
                    {perk.title}
                  </h3>
                  <p
                    className="text-[16px] leading-[1.6]"
                    style={{ color: "var(--text-soft)" }}
                  >
                    {perk.body}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ── Merci ─────────────────────────────────────────────── */}
        <section aria-labelledby="thanks-title" className="pb-24">
          <div
            className="max-w-[680px] mx-auto px-10 py-14 rounded-2xl text-center"
            style={{
              background: "var(--accent-ink)",
              color: "var(--text-on-ink)",
            }}
          >
            <div className="text-6xl mb-6" aria-hidden="true">
              🙏
            </div>
            <h2
              id="thanks-title"
              className="vc-h2 mb-4"
              style={{ color: "var(--text-on-ink)" }}
            >
              Merci de tester Coraly !
            </h2>
            <p
              className="text-[18px] leading-[1.6] max-w-[480px] mx-auto mb-8"
              style={{ color: "var(--text-on-ink-muted)" }}
            >
              Votre participation est précieuse. Chaque retour que vous nous
              transmettez nous permet d&apos;améliorer l&apos;accessibilité et
              l&apos;expérience pour tous.
            </p>
            <p
              className="text-[16px] leading-[1.6]"
              style={{ color: "var(--text-on-ink-muted)" }}
            >
              Une question ou un retour ?{" "}
              <a
                href="mailto:hello@coraly.fr"
                className="font-semibold underline underline-offset-2"
                style={{ color: "var(--brass)" }}
              >
                hello@coraly.fr
              </a>
            </p>
          </div>
        </section>
      </main>
      <Footer />
      <HelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
    </>
  );
}
