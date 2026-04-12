import Link from "next/link";

interface FinalCtaSectionProps {
  onListenDemo?: () => void;
}

export function FinalCtaSection({ onListenDemo }: FinalCtaSectionProps = {}) {
  return (
    <section className="py-32 text-center" style={{ background: "var(--bg-alt)" }}>
      <div className="max-w-[1200px] mx-auto px-10">
        <span className="vc-eyebrow">Prêt ?</span>
        <h2
          className="vc-h2 mt-4 mx-auto max-w-[720px]"
          style={{ color: "var(--text)" }}
        >
          Faites vos courses en trois minutes,
          <br />
          sans regarder un écran.
        </h2>
        <p
          className="mt-5 mx-auto max-w-[560px] text-[19px]"
          style={{ color: "var(--text-soft)" }}
        >
          Gratuit, sans inscription, accessible immédiatement. Koraly vous attend.
        </p>
        <div className="mt-8 inline-flex gap-3.5">
          <Link
            href="/courses"
            className="px-7 py-4 rounded-md font-bold text-base no-underline"
            style={{ background: "var(--accent)", color: "var(--bg)" }}
          >
            Commencer mes courses
          </Link>
          <button
            type="button"
            onClick={onListenDemo}
            className="px-6 py-3.5 rounded-md font-bold text-base bg-transparent border-[1.5px]"
            style={{ borderColor: "var(--text)", color: "var(--text)" }}
          >
            🔊 Écouter la démonstration
          </button>
        </div>
      </div>
    </section>
  );
}
