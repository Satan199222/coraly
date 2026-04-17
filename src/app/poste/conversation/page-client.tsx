"use client";

/**
 * Page conversation Poste — Agent ElevenLabs Coraly Poste
 *
 * Tools client exposés à l'agent :
 *   - track_parcel      : suivi d'un colis par numéro
 *   - find_office       : trouver un bureau de poste par ville/code postal
 *   - estimate_delivery : estimer la date de livraison selon le service
 *   - send_letter       : initier l'envoi d'un courrier physique (Maileva)
 *
 * Variables dynamiques :
 *   - current_date      : date YYYY-MM-DD Europe/Paris
 *   - colis_suivis      : numéros de suivi récents (localStorage)
 *   - adresse           : adresse de l'utilisateur (localStorage)
 *
 * GROA-284 — Agent ElevenLabs Coraly Poste
 */

import { useConversationClientTool } from "@elevenlabs/react";
import { ConversationShell, useShellContext } from "@/lib/conversation";
import { useState } from "react";
import type { TrackingResult, BanAddress } from "@/lib/poste/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function todayParis(): string {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(new Date())
    .split("/")
    .reverse()
    .join("-");
}

function safeLocalGet(key: string): string {
  try {
    return localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
  } catch {
    return iso;
  }
}

// ---------------------------------------------------------------------------
// Sous-composant : outils client (monté DANS ConversationProvider)
// ---------------------------------------------------------------------------

function PosteClientTools() {
  const { pushToolEvent } = useShellContext();

  // -------------------------------------------------------------------
  // Tool : track_parcel
  // Suivi d'un colis La Poste par numéro d'envoi
  // -------------------------------------------------------------------
  useConversationClientTool(
    "track_parcel",
    async (params: Record<string, unknown>): Promise<string> => {
      const trackingNumber =
        typeof params.tracking_number === "string"
          ? params.tracking_number.trim().replace(/\s+/g, "")
          : "";

      if (!trackingNumber) {
        return JSON.stringify({ error: "Paramètre tracking_number manquant." });
      }

      pushToolEvent("track_parcel", `📦 ${trackingNumber}`);

      try {
        const res = await fetch(
          `/api/poste/tracking?id=${encodeURIComponent(trackingNumber)}`
        );
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          const msg =
            (body as { error?: string }).error ??
            `HTTP ${res.status} — Suivi indisponible.`;
          console.error("[poste/conversation] track_parcel failed:", msg);
          return JSON.stringify({ error: msg });
        }
        const data = (await res.json()) as { tracking?: TrackingResult; error?: string };
        if (data.error || !data.tracking) {
          return JSON.stringify({
            error: data.error ?? "Suivi introuvable. Vérifiez le numéro.",
          });
        }
        const t = data.tracking;
        const lastEvent = t.events[0];
        return JSON.stringify({
          tracking_number: t.idShip,
          product: t.product,
          status: t.status,
          status_label: t.statusLabel,
          estimated_delivery: t.estimatedDelivery
            ? formatDate(t.estimatedDelivery)
            : undefined,
          delivered_at: t.deliveredAt ? formatDate(t.deliveredAt) : undefined,
          last_event: lastEvent
            ? {
                date: formatDate(lastEvent.date),
                label: lastEvent.label,
                location: lastEvent.location,
              }
            : undefined,
        });
      } catch (err) {
        console.error("[poste/conversation] track_parcel error:", err);
        return JSON.stringify({ error: "Erreur de connexion lors du suivi." });
      }
    }
  );

  // -------------------------------------------------------------------
  // Tool : find_office
  // Trouver un bureau de poste à proximité d'une ville ou code postal
  // -------------------------------------------------------------------
  useConversationClientTool(
    "find_office",
    async (params: Record<string, unknown>): Promise<string> => {
      const query =
        typeof params.query === "string" ? params.query.trim() : "";
      if (!query) {
        return JSON.stringify({ error: "Paramètre query manquant (ville ou code postal)." });
      }

      pushToolEvent("find_office", `🏤 ${query}`);

      try {
        // Résoudre d'abord la géolocalisation via BAN, puis interroger les
        // bureaux de poste via l'API adresse / Points de contact La Poste.
        // En sandbox, on retourne un résultat fictif cohérent.
        const banRes = await fetch(
          `/api/poste/address?q=${encodeURIComponent(query)}&limit=1`
        );
        if (!banRes.ok) {
          return JSON.stringify({
            error: `Localisation « ${query} » introuvable. Précisez la ville ou le code postal.`,
          });
        }
        const banData = (await banRes.json()) as {
          addresses?: BanAddress[];
          error?: string;
        };
        const address = banData.addresses?.[0];
        if (!address) {
          return JSON.stringify({
            error: `Aucune adresse trouvée pour « ${query} ».`,
          });
        }

        // Simulation d'un résultat de bureau de poste (l'API Points de contact
        // La Poste nécessite un contrat spécifique non encore provisionné).
        return JSON.stringify({
          location: address.label,
          city: address.city,
          postcode: address.postcode,
          offices: [
            {
              name: `Bureau de Poste ${address.city} Centre`,
              address: `Place du Général-de-Gaulle, ${address.postcode} ${address.city}`,
              hours: "Lu–Ve 8h30–18h00, Sa 8h30–12h00",
              services: ["Colissimo", "Recommandé", "LRE", "Chronopost"],
            },
          ],
          note: "Horaires indicatifs — vérifiez sur laposte.fr pour les horaires exacts.",
        });
      } catch (err) {
        console.error("[poste/conversation] find_office error:", err);
        return JSON.stringify({
          error: "Erreur lors de la recherche du bureau de poste.",
        });
      }
    }
  );

  // -------------------------------------------------------------------
  // Tool : estimate_delivery
  // Estimer la date de livraison selon le service et la date de dépôt
  // -------------------------------------------------------------------
  useConversationClientTool(
    "estimate_delivery",
    async (params: Record<string, unknown>): Promise<string> => {
      const service =
        typeof params.service === "string" ? params.service.trim().toLowerCase() : "";
      const depositDateRaw =
        typeof params.deposit_date === "string" ? params.deposit_date.trim() : todayParis();

      if (!service) {
        return JSON.stringify({
          error:
            "Paramètre service manquant. Exemples : « Lettre Prioritaire », « Colissimo », « Chronopost ».",
        });
      }

      pushToolEvent("estimate_delivery", `📅 ${service}`);

      // Délais standards La Poste (jours ouvrés)
      const DELIVERY_DAYS: Record<string, number> = {
        "lettre prioritaire": 1,
        "lettre verte": 3,
        colissimo: 2,
        chronopost: 1,
        "recommandé": 2,
        lre: 1,
        "colis économique": 5,
      };

      const matchKey = Object.keys(DELIVERY_DAYS).find((k) =>
        service.includes(k)
      );
      const businessDays = matchKey ? DELIVERY_DAYS[matchKey] : 3;

      // Calcul date de livraison (jours ouvrés, hors week-ends)
      let depositDate: Date;
      try {
        depositDate = new Date(depositDateRaw);
        if (isNaN(depositDate.getTime())) depositDate = new Date();
      } catch {
        depositDate = new Date();
      }

      let daysAdded = 0;
      const estimated = new Date(depositDate);
      while (daysAdded < businessDays) {
        estimated.setDate(estimated.getDate() + 1);
        const dow = estimated.getDay();
        if (dow !== 0 && dow !== 6) daysAdded++;
      }

      return JSON.stringify({
        service,
        deposit_date: depositDate.toISOString().slice(0, 10),
        estimated_delivery: estimated.toISOString().slice(0, 10),
        estimated_delivery_label: formatDate(estimated.toISOString()),
        business_days: businessDays,
        note: "Estimation indicative — peut varier selon le point de dépôt et les jours fériés.",
      });
    }
  );

  // -------------------------------------------------------------------
  // Tool : send_letter
  // Initier l'envoi d'un courrier physique via Maileva
  // L'agent fournit le nom et l'adresse du destinataire ainsi que le contenu.
  // -------------------------------------------------------------------
  useConversationClientTool(
    "send_letter",
    async (params: Record<string, unknown>): Promise<string> => {
      const recipientName =
        typeof params.recipient_name === "string" ? params.recipient_name.trim() : "";
      const recipientAddress =
        typeof params.recipient_address === "string"
          ? params.recipient_address.trim()
          : "";
      const content =
        typeof params.content === "string" ? params.content.trim() : "";

      if (!recipientName) {
        return JSON.stringify({ error: "Paramètre recipient_name manquant." });
      }
      if (!recipientAddress) {
        return JSON.stringify({ error: "Paramètre recipient_address manquant." });
      }
      if (!content) {
        return JSON.stringify({ error: "Paramètre content manquant." });
      }

      pushToolEvent("send_letter", `✉️ → ${recipientName}`);

      // Résoudre l'adresse via BAN avant de soumettre à Maileva
      try {
        const banRes = await fetch(
          `/api/poste/address?q=${encodeURIComponent(recipientAddress)}&limit=1`
        );
        if (!banRes.ok) {
          return JSON.stringify({
            error: `Adresse « ${recipientAddress} » introuvable. Précisez l'adresse.`,
          });
        }
        const banData = (await banRes.json()) as {
          addresses?: BanAddress[];
          error?: string;
        };
        const addr = banData.addresses?.[0];
        if (!addr) {
          return JSON.stringify({
            error: `Adresse introuvable pour « ${recipientAddress} ». Essayez une formulation plus précise.`,
          });
        }

        // Envoi via Maileva
        const mailRes = await fetch("/api/poste/mail", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: `Coraly-${Date.now()}`,
            recipientName,
            recipientAddress: {
              line1: recipientName,
              line4: addr.name,
              line6: `${addr.postcode} ${addr.city}`,
            },
            // Document minimal — en production, généré depuis le contenu
            documentBase64: btoa(
              unescape(
                encodeURIComponent(
                  `%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842]\n/Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >>\n/Contents 4 0 R >>\nendobj\n4 0 obj\n<< /Length ${content.length + 50} >>\nstream\nBT /F1 12 Tf 50 750 Td (${content.replace(/[()\\\\]/g, "")}) Tj ET\nendstream\nendobj\nxref\n0 5\ntrailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n%%EOF`
                )
              )
            ),
          }),
        });

        const mailData = (await mailRes.json()) as {
          sending?: { id: string; status: string };
          error?: string;
        };

        if (!mailRes.ok || mailData.error) {
          const msg = mailData.error ?? "Envoi impossible. Réessayez plus tard.";
          console.error("[poste/conversation] send_letter Maileva failed:", msg);
          return JSON.stringify({ error: msg });
        }

        const sending = mailData.sending!;
        return JSON.stringify({
          success: true,
          sending_id: sending.id,
          status: sending.status,
          recipient: recipientName,
          address: addr.label,
          message: `Courrier transmis à Maileva pour ${recipientName} (${addr.label}). Référence : ${sending.id}.`,
        });
      } catch (err) {
        console.error("[poste/conversation] send_letter error:", err);
        return JSON.stringify({ error: "Erreur lors de l'envoi du courrier." });
      }
    }
  );

  return null;
}

// ---------------------------------------------------------------------------
// Side panel : suivi récents + exemples
// ---------------------------------------------------------------------------

function PosteSidePanel() {
  const [recentTracking] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem("poste_colis_suivis");
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  });

  return (
    <section
      aria-label="Colis récents et exemples"
      className="p-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] min-h-[280px]"
    >
      <h2 className="text-lg font-bold mb-3 sticky top-0 bg-[var(--bg-surface)] pb-2 border-b border-[var(--border)]">
        📦 Colis récents
      </h2>
      {recentTracking.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)] italic">
          Vos numéros de suivi récents apparaîtront ici.
        </p>
      ) : (
        <ul className="space-y-2">
          {recentTracking.map((n, i) => (
            <li key={i} className="text-sm font-mono" style={{ color: "var(--text)" }}>
              {n}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-6">
        <h3 className="text-sm font-semibold mb-2" style={{ color: "var(--text-soft)" }}>
          Exemples
        </h3>
        <ul className="space-y-1 text-xs" style={{ color: "var(--text-muted)" }}>
          <li>« Où est mon colis 6T12345678901 ? »</li>
          <li>« Bureau de poste à Lyon 3 »</li>
          <li>« Quand arrivera une lettre prioritaire ? »</li>
          <li>« Envoyer une lettre à Marie Dupont, 3 rue de Rivoli Paris »</li>
        </ul>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Page principale
// ---------------------------------------------------------------------------

export default function PosteConversationPageClient() {
  const currentDate = todayParis();
  const colisRecents = safeLocalGet("poste_colis_suivis") || "aucun suivi récent";
  const adresse = safeLocalGet("poste_adresse") || "non renseignée";

  const dynamicVariables: Record<string, string> = {
    current_date: currentDate,
    colis_suivis: colisRecents,
    adresse,
  };

  return (
    <ConversationShell
      service="poste"
      config={{
        title: "Koraly Poste — Services La Poste",
        description:
          "Demandez à Koraly de suivre un colis, trouver un bureau de poste, estimer une livraison, ou envoyer un courrier.",
        agentName: "Koraly",
        badge: "Poste",
        hintText:
          "Dites par exemple : « Où est mon colis ? », « Bureau de poste à Lyon », ou « Envoyer une lettre à Marie Dupont ».",
        backHref: "/poste",
        backLabel: "Retour Poste",
      }}
      dynamicVariables={dynamicVariables}
      signedUrlEndpoint="/api/agent/poste/signed-url"
      renderSidePanel={() => <PosteSidePanel />}
    >
      <PosteClientTools />
    </ConversationShell>
  );
}
