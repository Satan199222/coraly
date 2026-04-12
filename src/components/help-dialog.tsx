"use client";

import { useEffect, useRef } from "react";

interface HelpDialogProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Dialog modal accessible expliquant les raccourcis et fonctionnalités.
 *
 * Implémentation manuelle (pas <dialog>) car :
 * - compat plus large
 * - contrôle total du focus trap
 *
 * Focus géré : à l'ouverture, focus sur le bouton Fermer. À la fermeture,
 * retour au déclencheur (géré par l'appelant via la touche qui a ouvert).
 */
export function HelpDialog({ open, onClose }: HelpDialogProps) {
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    // Focus sur le bouton de fermeture à l'ouverture pour que Tab reste
    // dans le dialog (pattern focus trap basique).
    setTimeout(() => closeBtnRef.current?.focus(), 50);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    // Focus trap : on maintient Tab à l'intérieur du dialog.
    function trapTab(e: KeyboardEvent) {
      if (e.key !== "Tab") return;
      const root = dialogRef.current;
      if (!root) return;
      const focusables = root.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", trapTab);
    return () => document.removeEventListener("keydown", trapTab);
  }, [open]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="help-dialog-title"
      aria-describedby="help-dialog-desc"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70"
      onClick={(e) => {
        // Fermer si clic sur le backdrop (pas sur le contenu)
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="max-w-xl w-full bg-[var(--bg-surface)] border-2 border-[var(--accent)] rounded-xl p-6 shadow-2xl"
      >
        <h2
          id="help-dialog-title"
          className="text-2xl font-bold mb-2 text-[var(--accent)]"
        >
          Raccourcis &amp; Aide
        </h2>
        <p
          id="help-dialog-desc"
          className="text-[var(--text-muted)] mb-4 text-sm"
        >
          VoixCourses est conçu pour fonctionner entièrement au clavier et avec
          un lecteur d&apos;écran.
        </p>

        <section aria-label="Raccourcis clavier" className="mb-4">
          <h3 className="font-bold mb-2">Raccourcis clavier</h3>
          <ul className="space-y-2 text-sm">
            <li>
              <kbd className="px-2 py-0.5 rounded bg-[var(--bg)] border border-[var(--border)]">
                Tab
              </kbd>{" "}
              / {" "}
              <kbd className="px-2 py-0.5 rounded bg-[var(--bg)] border border-[var(--border)]">
                Maj+Tab
              </kbd>{" "}
              : naviguer entre les contrôles
            </li>
            <li>
              <kbd className="px-2 py-0.5 rounded bg-[var(--bg)] border border-[var(--border)]">
                Entrée
              </kbd>{" "}
              /{" "}
              <kbd className="px-2 py-0.5 rounded bg-[var(--bg)] border border-[var(--border)]">
                Espace
              </kbd>{" "}
              : activer un bouton
            </li>
            <li>
              <kbd className="px-2 py-0.5 rounded bg-[var(--bg)] border border-[var(--border)]">
                ?
              </kbd>{" "}
              : afficher cette aide
            </li>
            <li>
              <kbd className="px-2 py-0.5 rounded bg-[var(--bg)] border border-[var(--border)]">
                Échap
              </kbd>{" "}
              : arrêter la lecture vocale en cours, ou fermer cette fenêtre
            </li>
            <li>
              <kbd className="px-2 py-0.5 rounded bg-[var(--bg)] border border-[var(--border)]">
                M
              </kbd>{" "}
              : démarrer ou arrêter la dictée (étape 2)
            </li>
          </ul>
        </section>

        <section aria-label="Astuces" className="mb-4">
          <h3 className="font-bold mb-2">Astuces</h3>
          <ul className="space-y-2 text-sm list-disc list-inside">
            <li>
              Étape 2 : tapez ou dictez votre liste naturellement. Utilisez le
              bouton <strong>Écouter</strong> pour vous relire avant validation.
            </li>
            <li>
              Étape 3 : le bouton <strong>Tout confirmer</strong> valide d&apos;un
              coup tous les produits trouvés — plus rapide si la recherche est
              bonne.
            </li>
            <li>
              Dans les <strong>préférences avancées</strong>, vous pouvez
              définir votre régime alimentaire (sans gluten, végan…) : il sera
              appliqué à toutes vos recherches automatiquement.
            </li>
            <li>
              Votre <strong>dernière commande</strong> est proposée en un clic
              à l&apos;étape 2 — pas besoin de redicter la même liste chaque
              semaine.
            </li>
          </ul>
        </section>

        <button
          ref={closeBtnRef}
          type="button"
          onClick={onClose}
          aria-label="Fermer la fenêtre d'aide"
          className="w-full px-4 py-3 rounded-lg bg-[var(--accent)] text-[var(--bg)] font-bold hover:bg-[var(--accent-hover)] transition-colors"
        >
          Fermer (Échap)
        </button>
      </div>
    </div>
  );
}
