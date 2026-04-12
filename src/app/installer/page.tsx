"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AccessibilityBar } from "@/components/accessibility-bar";
import { SiteHeader } from "@/components/site-header";
import { Footer } from "@/components/footer";
import { useExtension } from "@/lib/extension/use-extension";
import {
  detectBrowser,
  browserDisplayName,
  type BrowserInfo,
} from "@/lib/extension/browser-detection";

/**
 * Page dédiée à l'installation de l'extension VoixCourses.
 *
 * - Détecte le navigateur et affiche la procédure appropriée
 * - Cite le Store quand publié, ou mode dev (charger dépaquetée) en fallback
 * - aria-live sur le statut "extension détectée" pour que l'utilisateur sache
 *   quand l'installation a pris
 */
export default function InstallerPage() {
  const extension = useExtension();
  const [browser, setBrowser] = useState<BrowserInfo | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- detectBrowser lit navigator.*, indisponible en SSR
    setBrowser(detectBrowser());
  }, []);

  return (
    <>
      <AccessibilityBar />
      <SiteHeader compact />
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
        <header>
          <h1 className="vc-h2 mt-3">Installer l&apos;extension</h1>
          <p className="text-[var(--text-muted)] mt-1 text-base">
            L&apos;extension permet de remplir votre panier Carrefour en un clic,
            directement dans votre session. Aucun identifiant ne transite par
            VoixCourses.
          </p>
        </header>

      {/* Statut — aria-live pour que l'utilisateur entende la détection.
          Bouton "Tester" pour vérifier activement que l'extension répond
          (utile si l'auto-détection n'a pas déclenché à temps au 1er load). */}
      <ExtensionStatus extension={extension} />


      {browser && !browser.canInstallExtension ? (
        <UnsupportedBrowserNotice browser={browser} />
      ) : (
        <>
          <WhyInstallSection />
          <InstallSteps browser={browser} />
          <PrivacySection />
          <AccessibilitySection />
        </>
      )}
    </div>
      <Footer />
    </>
  );
}

/**
 * Carte de statut extension avec bouton "Tester". Le ping envoie un message
 * PING à l'extension via externally_connectable et attend la réponse. Cela
 * confirme que :
 * 1. L'extension est installée
 * 2. Les matches externally_connectable couvrent bien notre domaine
 * 3. Le background worker de l'extension répond correctement
 *
 * Plus robuste que la simple détection de marqueur DOM.
 */
function ExtensionStatus({
  extension,
}: {
  extension: ReturnType<typeof useExtension>;
}) {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<
    | null
    | { ok: true; version: string }
    | { ok: false; reason: string }
  >(null);

  async function testPing() {
    if (!extension.extensionId) {
      setTestResult({
        ok: false,
        reason:
          "Aucun identifiant d'extension détecté. Rechargez la page après avoir installé.",
      });
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const res = await new Promise<{
        installed?: boolean;
        version?: string;
        error?: string;
      }>((resolve) => {
        // @ts-expect-error chrome global
        if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) {
          resolve({ error: "API chrome.runtime indisponible dans ce navigateur" });
          return;
        }
        // @ts-expect-error chrome global
        chrome.runtime.sendMessage(
          extension.extensionId,
          { type: "PING" },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (response: any) => {
            // @ts-expect-error chrome.runtime.lastError
            const err = chrome.runtime.lastError;
            if (err) resolve({ error: err.message });
            else resolve(response || {});
          }
        );
      });

      if (res.installed && res.version) {
        setTestResult({ ok: true, version: res.version });
      } else {
        setTestResult({
          ok: false,
          reason: res.error || "L'extension n'a pas répondu au PING.",
        });
      }
    } catch (err) {
      setTestResult({
        ok: false,
        reason: err instanceof Error ? err.message : "Erreur inconnue",
      });
    } finally {
      setTesting(false);
    }
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={`p-4 rounded-lg border-2 bg-[var(--bg-surface)] ${
        extension.installed
          ? "border-[var(--success)]"
          : "border-[var(--border)]"
      }`}
    >
      {extension.installed ? (
        <>
          <strong className="text-[var(--success)]">
            ✓ Extension détectée (version {extension.version})
          </strong>
          <p className="text-sm mt-1">
            Vous pouvez retourner sur{" "}
            <Link href="/" className="underline text-[var(--accent)]">
              VoixCourses
            </Link>{" "}
            et envoyer votre liste en 1 clic.
          </p>
        </>
      ) : (
        <>
          <strong>Extension non détectée</strong>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Suivez la procédure ci-dessous. La page se met à jour
            automatiquement dès que l&apos;extension est installée, ou
            cliquez sur « Tester » ci-dessous.
          </p>
        </>
      )}

      <div className="mt-3 flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={testPing}
          disabled={testing}
          aria-label="Tester la communication avec l'extension"
          className="px-4 py-2 rounded-lg border-2 border-[var(--accent)] text-[var(--accent)] font-semibold text-sm hover:bg-[var(--accent)] hover:text-[var(--bg)] disabled:opacity-50 transition-colors"
        >
          {testing ? "Test en cours..." : "Tester la communication"}
        </button>
        {testResult && (
          <span
            role="status"
            aria-live="polite"
            className={`text-sm ${
              testResult.ok
                ? "text-[var(--success)]"
                : "text-[var(--danger)]"
            }`}
          >
            {testResult.ok
              ? `✓ L'extension répond (version ${testResult.version})`
              : `✗ ${testResult.reason}`}
          </span>
        )}
      </div>
    </div>
  );
}

function UnsupportedBrowserNotice({ browser }: { browser: BrowserInfo }) {
  return (
    <section
      aria-label="Navigateur non supporté"
      className="p-6 rounded-lg border-2 border-[var(--danger)] bg-[var(--bg-surface)]"
    >
      <h2 className="text-xl font-bold mb-2">
        Extension indisponible sur {browserDisplayName(browser.kind)}
      </h2>
      <p className="text-[var(--text-muted)] mb-4">
        {browser.unsupportedReason}
      </p>
      <Link
        href="/"
        className="inline-block px-4 py-2 rounded-lg bg-[var(--accent)] text-[var(--bg)] font-bold hover:bg-[var(--accent-hover)]"
      >
        Utiliser VoixCourses sans extension (liste manuelle)
      </Link>
    </section>
  );
}

function WhyInstallSection() {
  return (
    <section aria-label="Pourquoi installer l'extension">
      <h2 className="text-xl font-bold mb-3">Pourquoi l&apos;installer ?</h2>
      <ul className="space-y-2 text-base list-disc list-inside text-[var(--text-muted)]">
        <li>
          <strong className="text-[var(--text)]">1 clic</strong> pour transférer
          votre liste dans votre panier Carrefour, directement dans votre
          session navigateur.
        </li>
        <li>
          <strong className="text-[var(--text)]">Voix active</strong> aussi sur
          carrefour.fr : confirmation vocale de l&apos;ajout, nombre d&apos;articles,
          statut de connexion.
        </li>
        <li>
          <strong className="text-[var(--text)]">Raccourcis clavier</strong> R /
          I / E directement dans la bannière Carrefour.
        </li>
      </ul>
    </section>
  );
}

function InstallSteps({ browser }: { browser: BrowserInfo | null }) {
  if (!browser) return null;

  // Placeholder Store : tant que l'extension n'est pas publiée, on propose
  // l'install manuelle. Quand elle le sera, on remplacera par le flow Store.
  const storePublished = false;

  return (
    <section aria-label="Procédure d'installation">
      <h2 className="text-xl font-bold mb-3">
        Procédure pour {browserDisplayName(browser.kind)}
      </h2>

      {storePublished && browser.storeUrl ? (
        <ol className="space-y-3 text-base list-decimal list-inside">
          <li>
            <a
              href={browser.storeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="underline text-[var(--accent)]"
            >
              Ouvrir {browser.storeLabel}
            </a>{" "}
            dans un nouvel onglet.
          </li>
          <li>
            Cliquer sur <strong>Ajouter / Installer</strong> et confirmer.
          </li>
          <li>
            Revenir sur cet onglet — le statut ci-dessus doit devenir vert
            automatiquement.
          </li>
        </ol>
      ) : (
        <DevInstallProcedure browser={browser} />
      )}
    </section>
  );
}

function DevInstallProcedure({ browser }: { browser: BrowserInfo }) {
  const isFirefox = browser.kind === "firefox";

  return (
    <div className="space-y-4">
      <p className="text-sm p-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border)]">
        <strong>⚠️ Extension en cours de publication.</strong> En attendant,
        l&apos;installation se fait en mode développeur (30 secondes).
      </p>

      {isFirefox ? (
        <ol className="space-y-3 text-base list-decimal list-inside">
          <li>
            <a
              href="https://github.com/Satan199222/voixcourses/releases/latest"
              target="_blank"
              rel="noopener noreferrer"
              className="underline text-[var(--accent)]"
            >
              Télécharger le fichier .zip
            </a>{" "}
            de la dernière version.
          </li>
          <li>
            Ouvrir un onglet sur{" "}
            <code className="px-1.5 py-0.5 rounded bg-[var(--bg-surface)] border border-[var(--border)] text-sm">
              about:debugging#/runtime/this-firefox
            </code>
          </li>
          <li>
            Cliquer sur <strong>Charger un module complémentaire temporaire</strong>.
          </li>
          <li>
            Sélectionner le fichier <code>manifest.json</code> du zip
            téléchargé.
          </li>
          <li>
            Recharger cette page — le statut doit devenir vert.
          </li>
        </ol>
      ) : (
        <ol className="space-y-3 text-base list-decimal list-inside">
          <li>
            <a
              href="https://github.com/Satan199222/voixcourses/releases/latest"
              target="_blank"
              rel="noopener noreferrer"
              className="underline text-[var(--accent)]"
            >
              Télécharger le fichier .zip
            </a>{" "}
            de la dernière version, puis <strong>décompressez-le</strong> dans
            un dossier sur votre ordinateur.
          </li>
          <li>
            Ouvrir un onglet sur{" "}
            <code className="px-1.5 py-0.5 rounded bg-[var(--bg-surface)] border border-[var(--border)] text-sm">
              chrome://extensions/
            </code>{" "}
            (fonctionne aussi pour Edge/Brave/Opera).
          </li>
          <li>
            Activer le <strong>Mode développeur</strong> (interrupteur en haut
            à droite).
          </li>
          <li>
            Cliquer sur <strong>Charger l&apos;extension non empaquetée</strong>{" "}
            et sélectionner le dossier décompressé.
          </li>
          <li>
            Recharger cette page — le statut doit devenir vert.
          </li>
        </ol>
      )}

      <p className="text-xs text-[var(--text-muted)]">
        <strong>Navigation clavier uniquement ?</strong> Tabulez jusqu&apos;au
        bouton « Télécharger », appuyez Entrée ; ensuite les pages{" "}
        <code>chrome://extensions</code> / <code>about:debugging</code> sont
        entièrement accessibles au clavier. Si vous bloquez, écrivez-nous.
      </p>
    </div>
  );
}

function PrivacySection() {
  return (
    <section
      aria-label="Confidentialité"
      className="p-4 rounded-lg bg-[var(--bg-surface)] border border-[var(--border)]"
    >
      <h2 className="text-lg font-bold mb-2">🔐 Confidentialité</h2>
      <ul className="text-sm text-[var(--text-muted)] space-y-1 list-disc list-inside">
        <li>
          L&apos;extension n&apos;accède qu&apos;à <code>carrefour.fr</code> et à
          l&apos;app VoixCourses (<code>voixcourses.vercel.app</code>). Aucun
          autre site.
        </li>
        <li>
          Vos identifiants Carrefour ne transitent <strong>jamais</strong> par
          VoixCourses — l&apos;extension agit dans votre propre session navigateur.
        </li>
        <li>
          Aucune télémétrie, aucun suivi, aucune donnée envoyée à un serveur
          tiers.
        </li>
      </ul>
    </section>
  );
}

function AccessibilitySection() {
  return (
    <section
      aria-label="Accessibilité"
      className="p-4 rounded-lg bg-[var(--bg-surface)] border border-[var(--border)]"
    >
      <h2 className="text-lg font-bold mb-2">♿ Accessibilité</h2>
      <ul className="text-sm text-[var(--text-muted)] space-y-1 list-disc list-inside">
        <li>
          Bannière Carrefour 100 % accessible au clavier — raccourcis{" "}
          <kbd className="px-1 rounded bg-[var(--bg)] border border-[var(--border)]">
            R
          </kbd>
          ,{" "}
          <kbd className="px-1 rounded bg-[var(--bg)] border border-[var(--border)]">
            I
          </kbd>
          ,{" "}
          <kbd className="px-1 rounded bg-[var(--bg)] border border-[var(--border)]">
            E
          </kbd>
          .
        </li>
        <li>
          Synthèse vocale française : confirmation d&apos;ajout, nombre
          d&apos;articles, statut de connexion.
        </li>
        <li>
          Compatible NVDA, JAWS, VoiceOver.
        </li>
      </ul>
    </section>
  );
}
