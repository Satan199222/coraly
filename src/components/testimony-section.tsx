export function TestimonySection() {
  return (
    <section
      className="py-24 lg:py-28"
      style={{ background: "var(--accent-ink)", color: "var(--bg)" }}
    >
      <div className="max-w-[1200px] mx-auto px-10 grid gap-16 items-center lg:grid-cols-2">
        <div>
          <span className="vc-eyebrow" style={{ color: "var(--brass)" }}>
            Ils utilisent VoixCourses
          </span>
          <blockquote
            className="text-[28px] leading-[1.35] font-normal mt-6"
            style={{ letterSpacing: "-0.4px" }}
          >
            <Quote />
            Avant, je devais attendre ma fille pour faire les courses le samedi. Maintenant je les
            fais seule, en trois minutes, quand je veux. J&apos;ai retrouvé un pan entier de mon
            autonomie.
            <Quote close />
          </blockquote>
          <cite className="block mt-7 not-italic text-base" style={{ color: "rgba(244,238,227,0.75)" }}>
            <strong
              className="block text-[17px] mb-0.5"
              style={{ color: "var(--bg)", fontWeight: 700 }}
            >
              Marie-Thérèse, 67 ans
            </strong>
            Non-voyante depuis 12 ans · Strasbourg
          </cite>
        </div>
        <div
          aria-hidden="true"
          className="aspect-[4/5] rounded-xl flex items-end p-6 text-sm"
          style={{
            background: "linear-gradient(135deg, #2A4F7E 0%, var(--brass) 120%)",
            color: "var(--bg)",
          }}
        >
          📸 Photo authentique — femme 60+ en cuisine
        </div>
      </div>
    </section>
  );
}

function Quote({ close = false }: { close?: boolean }) {
  return (
    <span
      aria-hidden="true"
      style={{
        color: "var(--brass)",
        fontSize: 60,
        lineHeight: 0,
        verticalAlign: close ? "-28px" : "-20px",
        marginLeft: close ? 2 : 0,
        marginRight: close ? 0 : 4,
      }}
    >
      {close ? "»" : "«"}
    </span>
  );
}
