const ITEMS = [
  {
    mark: "Aa",
    title: "Police Luciole, conçue pour les malvoyants",
    body: "Développée par le CTRDV (Centre Technique Régional pour la Déficience Visuelle) avec des utilisateurs basse vision. Caractères ambigus (b/d/p/q, 0/O, I/l/1) dessinés distinctement.",
  },
  {
    mark: "✓",
    title: "Contraste WCAG AAA sur tout le site",
    body: "Ratio minimum 11:1 pour le texte courant. Testé sous simulations glaucome, DMLA, cataracte et daltonisme. Quatre profils visuels sélectionnables en un clic.",
  },
  {
    mark: "♿",
    title: "Tout au clavier, tout au lecteur d'écran",
    body: "NVDA, JAWS, VoiceOver, TalkBack testés. Focus visible doublé, annonces ARIA live, raccourcis documentés. Compatible Windows High-Contrast Mode.",
  },
  {
    mark: "🔇",
    title: "Voix désactivable, animations respectueuses",
    body: "Koraly peut se taire. prefers-reduced-motion respecté. Bip aigu/grave signale début et fin d'écoute — pas d'overlay visuel distrayant.",
  },
];

/**
 * Section manifeste : 4 engagements d'accessibilité + statistique 1,7M.
 * id="a11y" pour la nav interne depuis le SiteHeader.
 */
export function ManifestoSection() {
  return (
    <section id="a11y" className="py-24 lg:py-28" style={{ background: "var(--bg-alt)" }}>
      <div className="max-w-[1200px] mx-auto px-10 grid gap-20 items-start lg:grid-cols-[1fr_1.2fr]">
        <div>
          <span className="vc-eyebrow">Nos engagements</span>
          <h2 className="vc-h2 mt-5 mb-5" style={{ color: "var(--text)" }}>
            L&apos;accessibilité,
            <br />
            c&apos;est le produit.
            <br />
            Pas une case cochée.
          </h2>
          <p className="text-[17px] leading-[1.6] max-w-[420px]" style={{ color: "var(--text-soft)" }}>
            Chaque décision technique, visuelle et sonore a été prise avec des utilisateurs
            déficients visuels — pas pour eux.
          </p>
          <div
            className="mt-9 p-6 rounded-r-lg"
            style={{ background: "var(--bg-card)", borderLeft: "4px solid var(--brass)" }}
          >
            <div
              className="text-5xl font-bold leading-none"
              style={{ color: "var(--accent)", letterSpacing: "-1.5px" }}
            >
              1,7 M
            </div>
            <div className="mt-2 text-[15px] leading-[1.5]" style={{ color: "var(--text-soft)" }}>
              personnes déficientes visuelles en France dont{" "}
              <strong>207 000 aveugles</strong>. VoixCourses leur rend l&apos;autonomie des
              courses en ligne.
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-8">
          {ITEMS.map((it) => (
            <div
              key={it.title}
              className="grid gap-5 items-start"
              style={{ gridTemplateColumns: "56px 1fr" }}
            >
              <div
                className="w-12 h-12 rounded-lg flex items-center justify-center font-bold text-lg"
                style={{ background: "var(--accent)", color: "var(--bg)" }}
                aria-hidden="true"
              >
                {it.mark}
              </div>
              <div>
                <h4
                  className="text-[19px] font-bold mb-2 leading-[1.3]"
                  style={{ color: "var(--text)" }}
                >
                  {it.title}
                </h4>
                <p className="text-base leading-[1.6]" style={{ color: "var(--text-soft)" }}>
                  {it.body}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
