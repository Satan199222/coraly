import Link from "next/link";
import { Tv, CalendarDays, Zap, Hash, Volume2 } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { Footer } from "@/components/footer";

/**
 * VoixTV — Page d'accueil /tv
 * Purement présentationnelle — Server Component, WCAG AAA.
 * GROA-401
 */
export const metadata = {
  title: "VoixTV — Les programmes TV par la voix · Coraly",
  description:
    "Découvrez ce soir à la télé sans effort. Koraly lit les programmes du soir chaîne par chaîne, avec navigation vocale et raccourcis clavier.",
};

const FEATURES = [
  {
    icon: Volume2,
    title: "Programmes du soir lus à voix haute",
    body: "Koraly annonce les émissions chaîne par chaîne dès l'ouverture de la page — aucun clic nécessaire.",
  },
  {
    icon: CalendarDays,
    title: "Navigation jour par jour",
    body: "Consultez les grilles d'hier à J+6 avec les touches ← → ou les boutons. La date change vocalement.",
  },
  {
    icon: Hash,
    title: "Raccourcis numériques 1–9",
    body: "Appuyez sur 1 à 9 pour accéder directement aux neuf premières chaînes TNT et entendre leur soirée.",
  },
  {
    icon: Zap,
    title: "Lecture instantanée par chaîne",
    body: "Un bouton « Écouter » par chaîne : Koraly récite les titres, genres et horaires sans vous faire lire.",
  },
];

const EXAMPLES = [
  "« Quels sont les programmes de ce soir ? »",
  "« Qu'est-ce qu'il y a sur TF1 ce soir ? »",
  "« Lis-moi les programmes de demain sur France 2 »",
  "« Résumé de la soirée »",
];

export default function TvHomePage() {
  return (
    <>
      <SiteHeader />

      <main id="main" tabIndex={-1} style={{ outline: "none" }}>
        {/* ── Hero ───────────────────────────────────────────── */}
        <section
          aria-labelledby="hero-heading"
          className="py-20 lg:py-28 px-6"
          style={{ background: "var(--bg)" }}
        >
          <div className="max-w-4xl mx-auto text-center">
            <div
              className="inline-flex items-center justify-center w-20 h-20 rounded-2xl mb-8"
              style={{ background: "var(--accent)", color: "#fff" }}
              aria-hidden="true"
            >
              <Tv size={40} strokeWidth={1.5} />
            </div>

            <span className="vc-eyebrow block mb-4">
              Accessibilité première · Conforme WCAG AAA
            </span>

            <h1
              id="hero-heading"
              className="vc-h1 mb-6"
              style={{ color: "var(--text)" }}
            >
              VoixTV
            </h1>

            <p
              className="text-xl leading-relaxed max-w-2xl mx-auto mb-10"
              style={{ color: "var(--text-soft)" }}
            >
              Les programmes du soir à la télé, lus par Koraly. Naviguez dans
              la grille TNT à la voix ou au clavier — sans lire un écran.
            </p>

            <div className="flex flex-wrap justify-center gap-4">
              <Link
                href="/tv/mode-texte"
                className="px-8 py-4 rounded-lg font-bold text-base inline-flex items-center gap-2.5 no-underline"
                style={{
                  background: "var(--accent)",
                  color: "#fff",
                  letterSpacing: "0.3px",
                }}
              >
                Mode texte
              </Link>
              <Link
                href="/tv/conversation"
                className="px-8 py-4 rounded-lg font-bold text-base inline-flex items-center gap-2.5 no-underline border-2"
                style={{
                  borderColor: "var(--accent)",
                  color: "var(--accent)",
                  background: "transparent",
                }}
              >
                <Volume2 size={18} aria-hidden="true" />
                Mode conversation vocale
              </Link>
            </div>
          </div>
        </section>

        {/* ── Ce que Koraly peut faire ───────────────────────── */}
        <section
          aria-labelledby="features-heading"
          className="py-20 px-6"
          style={{ background: "var(--bg-alt)" }}
        >
          <div className="max-w-4xl mx-auto">
            <h2
              id="features-heading"
              className="vc-h2 mb-12 text-center"
              style={{ color: "var(--text)" }}
            >
              Ce que Koraly peut faire
            </h2>

            <ul
              className="grid gap-6 sm:grid-cols-2"
              role="list"
              aria-label="Points forts de VoixTV"
            >
              {FEATURES.map(({ icon: Icon, title, body }) => (
                <li
                  key={title}
                  className="rounded-xl p-6"
                  style={{
                    background: "var(--bg-card)",
                    border: "1px solid var(--border)",
                    boxShadow: "var(--shadow-sm)",
                  }}
                >
                  <div
                    className="inline-flex items-center justify-center w-10 h-10 rounded-lg mb-4"
                    style={{ background: "var(--accent)", color: "#fff" }}
                    aria-hidden="true"
                  >
                    <Icon size={20} strokeWidth={1.5} />
                  </div>
                  <h3
                    className="font-bold text-base mb-2"
                    style={{ color: "var(--text)" }}
                  >
                    {title}
                  </h3>
                  <p
                    className="text-sm leading-relaxed"
                    style={{ color: "var(--text-soft)" }}
                  >
                    {body}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ── Exemples de commandes vocales ──────────────────── */}
        <section
          aria-labelledby="examples-heading"
          className="py-20 px-6"
          style={{ background: "var(--bg)" }}
        >
          <div className="max-w-3xl mx-auto">
            <h2
              id="examples-heading"
              className="vc-h2 mb-4 text-center"
              style={{ color: "var(--text)" }}
            >
              Exemples de commandes vocales
            </h2>
            <p
              className="text-center mb-10 text-base"
              style={{ color: "var(--text-muted)" }}
            >
              Dites simplement à Koraly ce que vous cherchez.
            </p>

            <ul className="space-y-4" role="list">
              {EXAMPLES.map((ex) => (
                <li
                  key={ex}
                  className="rounded-xl px-6 py-4 text-lg font-medium italic"
                  style={{
                    background: "var(--accent-ink)",
                    color: "var(--text-on-ink)",
                    borderLeft: "4px solid var(--brass)",
                  }}
                >
                  {ex}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ── CTA final ─────────────────────────────────────── */}
        <section
          aria-labelledby="cta-heading"
          className="py-20 px-6 text-center"
          style={{ background: "var(--bg-alt)" }}
        >
          <div className="max-w-xl mx-auto">
            <h2
              id="cta-heading"
              className="vc-h2 mb-4"
              style={{ color: "var(--text)" }}
            >
              Prêt à écouter la soirée TV ?
            </h2>
            <p
              className="mb-8 text-base"
              style={{ color: "var(--text-soft)" }}
            >
              Choisissez votre mode d&apos;interaction.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link
                href="/tv/mode-texte"
                className="px-8 py-4 rounded-lg font-bold text-base inline-flex items-center gap-2.5 no-underline"
                style={{
                  background: "var(--accent)",
                  color: "#fff",
                }}
              >
                Mode texte
              </Link>
              <Link
                href="/tv/conversation"
                className="px-8 py-4 rounded-lg font-bold text-base inline-flex items-center gap-2.5 no-underline border-2"
                style={{
                  borderColor: "var(--accent)",
                  color: "var(--accent)",
                  background: "transparent",
                }}
              >
                <Volume2 size={18} aria-hidden="true" />
                Mode conversation vocale
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
