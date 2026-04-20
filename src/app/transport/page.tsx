import Link from "next/link";
import { Train, Clock, AlertTriangle, Map, Volume2 } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { Footer } from "@/components/footer";

/**
 * VoixTransport — Page d'accueil /transport
 * Purement présentationnelle — Server Component, WCAG AAA.
 * GROA-401
 */
export const metadata = {
  title: "VoixTransport — Les transports en commun par la voix · Coraly",
  description:
    "Horaires, prochains départs et perturbations RATP lus par Koraly. Navigation vocale accessible pour le métro, le bus et le RER.",
};

const FEATURES = [
  {
    icon: Clock,
    title: "Prochains départs en temps réel",
    body: "Koraly annonce les horaires exacts de votre ligne dès votre demande — bus, métro ou RER.",
  },
  {
    icon: AlertTriangle,
    title: "Alertes perturbations et travaux",
    body: "Soyez averti vocalement dès qu'une perturbation affecte votre ligne ou votre itinéraire.",
  },
  {
    icon: Train,
    title: "Toutes les lignes RATP",
    body: "Bus, métro, RER et tramway Île-de-France accessibles par la voix — aucune liste à parcourir.",
  },
  {
    icon: Map,
    title: "Itinéraires vocaux guidés",
    body: "Décrivez votre destination. Koraly calcule le trajet et le lit étape par étape.",
  },
];

const EXAMPLES = [
  "« Prochain bus 72 direction Opéra ? »",
  "« Y a-t-il des perturbations sur la ligne 4 ? »",
  "« Comment aller à Châtelet depuis Bastille ? »",
  "« Prochains RER A en direction de Versailles ? »",
];

export default function TransportHomePage() {
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
              <Train size={40} strokeWidth={1.5} />
            </div>

            <span className="vc-eyebrow block mb-4">
              Accessibilité première · Conforme WCAG AAA
            </span>

            <h1
              id="hero-heading"
              className="vc-h1 mb-6"
              style={{ color: "var(--text)" }}
            >
              VoixTransport
            </h1>

            <p
              className="text-xl leading-relaxed max-w-2xl mx-auto mb-10"
              style={{ color: "var(--text-soft)" }}
            >
              Les horaires de transports en commun et alertes perturbations,
              lus par Koraly. Voyagez en Île-de-France sans regarder votre
              téléphone.
            </p>

            <div className="flex flex-wrap justify-center gap-4">
              <Link
                href="/transport/mode-texte"
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
                href="/transport/conversation"
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
              aria-label="Points forts de VoixTransport"
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
              Prêt à voyager sans regarder votre écran ?
            </h2>
            <p
              className="mb-8 text-base"
              style={{ color: "var(--text-soft)" }}
            >
              Choisissez votre mode d&apos;interaction.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link
                href="/transport/mode-texte"
                className="px-8 py-4 rounded-lg font-bold text-base inline-flex items-center gap-2.5 no-underline"
                style={{
                  background: "var(--accent)",
                  color: "#fff",
                }}
              >
                Mode texte
              </Link>
              <Link
                href="/transport/conversation"
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
