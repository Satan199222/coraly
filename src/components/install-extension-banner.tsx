"use client";

import { useEffect, useState } from "react";
import { useExtension } from "@/lib/extension/use-extension";
import {
  detectBrowser,
  type BrowserInfo,
} from "@/lib/extension/browser-detection";

const DISMISS_KEY = "voixcourses-install-banner-dismissed";

/**
 * Bandeau "Installer l'extension" — affiché uniquement si :
 * - extension non détectée
 * - navigateur supporté
 * - l'utilisateur n'a pas explicitement dismissé
 *
 * Affiche un message alternatif si navigateur non supporté (Safari/mobile).
 */
export function InstallExtensionBanner() {
  const extension = useExtension();
  const [dismissed, setDismissed] = useState(false);
  const [browser, setBrowser] = useState<BrowserInfo | null>(null);

  useEffect(() => {
    setBrowser(detectBrowser());
    setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
  }, []);

  if (extension.installed) return null;
  if (dismissed) return null;
  if (!browser) return null;

  function handleDismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  }

  // Navigateur non supporté : on informe sans pousser l'install
  if (!browser.canInstallExtension) {
    return (
      <aside
        role="region"
        aria-label="Information extension VoixCourses"
        className="p-4 rounded-lg border-2 border-[var(--border)] bg-[var(--bg-surface)] flex items-start gap-3"
      >
        <span aria-hidden className="text-2xl shrink-0">ℹ️</span>
        <div className="flex-1 text-sm">
          <strong className="block mb-1">Extension non disponible</strong>
          <p className="text-[var(--text-muted)]">
            {browser.unsupportedReason}
          </p>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Fermer cette information"
          className="text-[var(--text-muted)] hover:text-[var(--text)] shrink-0 text-sm"
        >
          ✕
        </button>
      </aside>
    );
  }

  return (
    <aside
      role="region"
      aria-label="Installer l'extension VoixCourses"
      className="p-4 rounded-lg border-2 border-[var(--accent)] bg-[var(--bg-surface)] flex items-start gap-3"
    >
      <span aria-hidden className="text-2xl shrink-0">⚡</span>
      <div className="flex-1 text-sm">
        <strong className="block mb-1">
          Installez l&apos;extension pour aller 10 fois plus vite
        </strong>
        <p className="text-[var(--text-muted)] mb-2">
          Avec l&apos;extension, votre panier Carrefour se remplit en 1 clic.
          Sans elle, vous devrez utiliser un bookmarklet moins pratique.
          Installation en 30 secondes.
        </p>
        <div className="flex gap-2 flex-wrap">
          <a
            href="/installer"
            aria-label={`Voir la procédure d'installation pour ${browser.kind === "unknown" ? "votre navigateur" : browser.kind}`}
            className="inline-block px-4 py-2 rounded-lg bg-[var(--accent)] text-[var(--bg)] font-bold text-sm hover:bg-[var(--accent-hover)] transition-colors"
          >
            Voir la procédure →
          </a>
          {browser.storeUrl && (
            <a
              href={browser.storeUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Ouvrir ${browser.storeLabel} dans un nouvel onglet`}
              className="inline-block px-4 py-2 rounded-lg border-2 border-[var(--border)] text-[var(--text)] font-semibold text-sm hover:border-[var(--accent)] transition-colors"
            >
              Ouvrir {browser.storeLabel}
            </a>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Masquer cette suggestion (réapparaîtra plus tard)"
        className="text-[var(--text-muted)] hover:text-[var(--text)] shrink-0 text-sm"
      >
        ✕
      </button>
    </aside>
  );
}
