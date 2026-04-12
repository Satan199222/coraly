const ENSEIGNES = ["Carrefour", "Auchan", "Monoprix", "Franprix", "Intermarché"];

/**
 * Bandeau "Disponible chez" avec le nom des enseignes en wordmark simple.
 * Pas de logos officiels — on les remplacera par des SVG obtenus des enseignes.
 */
export function TrustStrip() {
  return (
    <section
      id="enseignes"
      aria-label="Enseignes disponibles"
      className="py-7 border-y"
      style={{ background: "var(--bg-alt)", borderColor: "var(--border)" }}
    >
      <div className="max-w-[1200px] mx-auto px-10 flex justify-between items-center gap-8 flex-wrap">
        <div className="vc-micro" style={{ color: "var(--text-muted)", letterSpacing: "2.5px" }}>
          Disponible chez
        </div>
        <div className="flex gap-9 items-center flex-wrap">
          {ENSEIGNES.map((e) => (
            <span
              key={e}
              className="text-lg font-bold opacity-70"
              style={{ color: "var(--text-soft)", letterSpacing: "-0.3px" }}
            >
              {e}
            </span>
          ))}
          <span className="text-lg font-bold opacity-40" style={{ color: "var(--text-soft)" }}>
            + bientôt
          </span>
        </div>
      </div>
    </section>
  );
}
