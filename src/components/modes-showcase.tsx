import Link from "next/link";

interface Mode {
  icon: string;
  title: string;
  shortcut: string;
  description: string;
  features: string[];
  ideal: string;
  href: string;
  featured?: boolean;
}

const MODES: Mode[] = [
  {
    icon: "⌨",
    title: "Mode Clavier",
    shortcut: "Touche 1",
    description:
      "Saisissez, naviguez et validez entièrement au clavier. Sans voix si vous préférez le silence.",
    features: [
      "Compatible NVDA, JAWS, VoiceOver, TalkBack",
      "Focus doublé (ring + outline) — jamais perdu",
      "Raccourcis documentés, aide en ligne",
    ],
    ideal: "Idéal · utilisateurs confirmés screen reader",
    href: "/courses",
  },
  {
    icon: "🎙",
    title: "Vocal guidé",
    shortcut: "Touche 2",
    description:
      "Koraly vous demande, vous dictez un produit, elle confirme. Rythme maîtrisé, pas de confusion.",
    features: [
      "Un produit à la fois, confirmation vocale",
      "Bip aigu au début, grave à la fin d'écoute",
      "Relecture complète du panier avant validation",
    ],
    ideal: "Le plus populaire · premiers utilisateurs",
    href: "/courses?voice=on",
    featured: true,
  },
  {
    icon: "💬",
    title: "Conversation libre",
    shortcut: "Touche 3",
    description:
      "Parlez comme à une vendeuse. Koraly comprend, propose, ajuste les quantités en continu.",
    features: [
      "Dialogue naturel, sans commandes figées",
      "Mémoire des achats précédents",
      "Interruption possible à tout moment",
    ],
    ideal: "Idéal · utilisateurs à l'aise avec la voix",
    href: "/courses/conversation",
  },
];

/**
 * Section "Trois modes" : cartes cliquables présentant clavier, vocal guidé, conversation.
 * La carte centrale (vocal guidé) est mise en avant visuellement.
 */
export function ModesShowcase() {
  return (
    <section id="modes" className="py-24 lg:py-28" style={{ background: "var(--bg)" }}>
      <div className="max-w-[1200px] mx-auto px-10">
        <div className="grid gap-12 items-end mb-14 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <span className="vc-eyebrow">Trois modes</span>
            <h2 className="vc-h2 mt-4" style={{ color: "var(--text)" }}>
              Choisissez votre manière
              <br />
              de faire les courses.
            </h2>
          </div>
          <p className="text-[17px] leading-[1.55]" style={{ color: "var(--text-soft)" }}>
            Chaque profil a ses préférences. Koraly s&apos;adapte — et vous pouvez basculer entre
            les modes à tout moment. Vos réglages sont mémorisés entre deux visites.
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {MODES.map((m) => (
            <ModeCard key={m.title} mode={m} />
          ))}
        </div>
      </div>
    </section>
  );
}

function ModeCard({ mode }: { mode: Mode }) {
  const bg = mode.featured ? "var(--accent-ink)" : "var(--bg-card)";
  const color = mode.featured ? "var(--text-on-ink)" : "var(--text)";
  const descColor = mode.featured ? "var(--text-on-ink-muted)" : "var(--text-soft)";
  const idealColor = mode.featured ? "var(--brass)" : "var(--text-muted)";
  const borderColor = mode.featured ? "var(--accent-ink)" : "var(--border)";
  const idealBorder = mode.featured ? "var(--text-on-ink-faint)" : "var(--border)";
  const markBg = mode.featured ? "rgba(181,136,66,0.18)" : "var(--bg-alt)";

  return (
    <Link
      href={mode.href}
      className="flex flex-col p-9 rounded-xl border relative no-underline transition-transform hover:-translate-y-0.5"
      style={{
        background: bg,
        color,
        borderColor,
        boxShadow: mode.featured ? "var(--shadow-lg)" : undefined,
      }}
    >
      <span
        className="absolute top-5 right-5 px-2.5 py-1 rounded border-[1.5px] text-xs font-bold"
        style={{
          fontFamily: "ui-monospace, monospace",
          borderColor: mode.featured ? "var(--text-on-ink-faint)" : "var(--border-hi)",
          background: mode.featured ? "transparent" : "var(--bg-card)",
          color,
        }}
      >
        {mode.shortcut}
      </span>

      <div
        className="rounded-xl flex items-center justify-center text-2xl mb-6"
        aria-hidden="true"
        style={{ background: markBg, color: mode.featured ? "var(--brass)" : "var(--text)", width: 52, height: 52 }}
      >
        {mode.icon}
      </div>

      <h3 className="vc-h3 mb-2.5" style={{ color }}>
        {mode.title}
      </h3>
      <p className="text-[17px] leading-[1.55] mb-5" style={{ color: descColor }}>
        {mode.description}
      </p>

      <ul className="flex flex-col gap-2.5 mb-5 list-none">
        {mode.features.map((f) => (
          <li key={f} className="text-[15px] flex gap-2.5 items-start" style={{ color }}>
            <span style={{ color: "var(--brass)", fontWeight: 700 }} aria-hidden="true">
              ✓
            </span>
            <span>{f}</span>
          </li>
        ))}
      </ul>

      <div
        className="mt-auto pt-5 border-t text-[13px] font-bold uppercase"
        style={{ letterSpacing: "1.5px", borderColor: idealBorder, color: idealColor }}
      >
        {mode.ideal}
      </div>
    </Link>
  );
}
