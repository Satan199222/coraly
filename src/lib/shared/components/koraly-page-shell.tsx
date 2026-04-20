"use client";

/**
 * KoralyPageShell — enveloppe structurelle commune aux 5 pages services Coraly.
 *
 * Gère : AccessibilityBar · LiveRegion · SiteHeader · <main> · Footer · HelpDialog
 * Chaque page service passe son contenu en children.
 *
 * GROA-496
 */

import { AccessibilityBar } from "@/lib/shared/components/accessibility-bar";
import { LiveRegion } from "@/lib/shared/components/live-region";
import { SiteHeader } from "@/components/site-header";
import { Footer } from "@/components/footer";
import { HelpDialog } from "@/components/help-dialog";
type CoralyService = "courses" | "tv" | "transport" | "poste" | "sante" | "recettes";

interface KoralyPageShellProps {
  /** Identifiant du service pour l'AccessibilityBar (tv, transport, sante, recettes, poste). */
  service: CoralyService;
  /** Message d'annonce lu par l'aria-live de LiveRegion. */
  announcement: string;
  /** Callback quand l'utilisateur bascule la voix dans l'AccessibilityBar. */
  onVoiceToggle?: (enabled: boolean) => void;
  /** État d'ouverture de la HelpDialog. */
  helpOpen: boolean;
  /** Ferme la HelpDialog. */
  onHelpClose: () => void;
  /** Callback "ouvrir aide" pour l'AccessibilityBar (optionnel). */
  onHelpOpen?: () => void;
  /** Classes CSS supplémentaires sur <main>. */
  mainClassName?: string;
  /** Styles inline supplémentaires sur <main>. */
  mainStyle?: React.CSSProperties;
  children: React.ReactNode;
}

export function KoralyPageShell({
  service,
  announcement,
  onVoiceToggle,
  helpOpen,
  onHelpClose,
  onHelpOpen,
  mainClassName = "min-h-screen px-4 py-8 max-w-2xl mx-auto",
  mainStyle,
  children,
}: KoralyPageShellProps) {
  return (
    <>
      <AccessibilityBar
        service={service}
        onVoiceToggle={onVoiceToggle}
        onHelpRequest={onHelpOpen}
      />
      <LiveRegion message={announcement} />
      <SiteHeader />
      <main
        id="main"
        tabIndex={-1}
        className={mainClassName}
        style={{ outline: "none", ...mainStyle }}
      >
        {children}
      </main>
      <Footer />
      <HelpDialog open={helpOpen} onClose={onHelpClose} />
    </>
  );
}
