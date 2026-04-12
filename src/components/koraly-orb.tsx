"use client";

export type KoralyOrbStatus = "idle" | "listening" | "speaking";

interface KoralyOrbProps {
  status?: KoralyOrbStatus;
  size?: number;
}

const STATUS_LABEL: Record<KoralyOrbStatus, string> = {
  idle: "Koraly est prête à vous écouter",
  listening: "Koraly vous écoute",
  speaking: "Koraly parle",
};

/**
 * Orbe visuelle animée représentant Koraly. Respiration + 2 ripples concentriques.
 * Respecte prefers-reduced-motion via la règle globale de globals.css.
 */
export function KoralyOrb({ status = "idle", size = 180 }: KoralyOrbProps) {
  const breathing = status === "listening" || status === "speaking";
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <div
        aria-hidden="true"
        className="absolute inset-0 rounded-full"
        style={{
          background: "radial-gradient(circle at 35% 35%, #2A4F7E 0%, var(--accent-ink) 70%)",
          animation: breathing ? "vc-breathe 2.4s ease-in-out infinite" : undefined,
        }}
      />
      <span
        aria-hidden="true"
        className="absolute rounded-full pointer-events-none"
        style={{
          inset: "-16px",
          border: "1px solid rgba(181,136,66,0.4)",
          animation: "vc-ripple 2.6s ease-out infinite",
        }}
      />
      <span
        aria-hidden="true"
        className="absolute rounded-full pointer-events-none"
        style={{
          inset: "-28px",
          border: "1px solid rgba(181,136,66,0.2)",
          animation: "vc-ripple 2.6s ease-out 0.8s infinite",
        }}
      />
      <div
        role="status"
        aria-live="polite"
        className="absolute inset-0 flex items-center justify-center text-center"
        style={{ color: "var(--bg)" }}
      >
        <div>
          <div className="text-xl font-bold" style={{ letterSpacing: "-0.3px" }}>
            Koraly
          </div>
          <div className="sr-only">{STATUS_LABEL[status]}</div>
        </div>
      </div>
    </div>
  );
}
