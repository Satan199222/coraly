"use client";

/**
 * KoralyMsgBubble — bulle de message partagée entre les pages conversationnelles.
 *
 * Rendu de la bulle texte (user ou koraly). Du contenu riche optionnel (product
 * card, recipe cards, etc.) est passé en `children` et affiché sous la bulle.
 *
 * GROA-496
 */

interface KoralyMsgBubbleProps {
  role: "user" | "koraly";
  text: string;
  loading?: boolean;
  /** Label aria pour l'état chargement — ex: "Koraly réfléchit…" */
  loadingLabel?: string;
  /** Contenu riche affiché sous la bulle (cartes produits, recettes…). */
  children?: React.ReactNode;
}

export function KoralyMsgBubble({
  role,
  text,
  loading,
  loadingLabel = "Koraly réfléchit…",
  children,
}: KoralyMsgBubbleProps) {
  const isKoraly = role === "koraly";
  return (
    <div className={`flex flex-col ${isKoraly ? "items-start" : "items-end"}`}>
      <div
        className="max-w-prose rounded-2xl px-4 py-3 text-base leading-relaxed"
        style={{
          background: isKoraly ? "var(--bg-card)" : "var(--accent)",
          color: isKoraly ? "var(--text)" : "#fff",
          border: isKoraly ? "1px solid var(--border)" : "none",
          borderRadius: isKoraly ? "4px 18px 18px 18px" : "18px 4px 18px 18px",
        }}
      >
        {loading ? (
          <span aria-label={loadingLabel} style={{ opacity: 0.6 }}>
            …
          </span>
        ) : (
          text
        )}
      </div>
      {children}
    </div>
  );
}
