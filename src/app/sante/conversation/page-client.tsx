"use client";

/**
 * Page conversation Santé — Agent ElevenLabs Coraly Santé
 *
 * Tools client exposés à l'agent :
 *   - search_pharmacy        : rechercher un médicament / produit pharma
 *   - get_medication_info    : obtenir les détails d'un médicament par slug/EAN
 *   - check_drug_interaction : avertissement interaction médicamenteuse (mock éducatif)
 *   - find_doctor            : trouver un médecin / pharmacie par ville (mock)
 *
 * Variables dynamiques :
 *   - current_date           : date YYYY-MM-DD Europe/Paris
 *   - medicaments_habituels  : médicaments habituels (localStorage)
 *   - medecin_traitant       : médecin traitant (localStorage)
 *
 * GROA-285 — Agent ElevenLabs Coraly Santé
 */

import { useConversationClientTool } from "@elevenlabs/react";
import { ConversationShell, useShellContext } from "@/lib/conversation";
import { useState } from "react";
import type { PharmaProduct, PharmaSearchResult } from "@/lib/sante/types";

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

// ---------------------------------------------------------------------------
// Sous-composant : outils client (monté DANS ConversationProvider)
// ---------------------------------------------------------------------------

function SanteClientTools() {
  const { pushToolEvent } = useShellContext();

  // -------------------------------------------------------------------
  // Tool : search_pharmacy
  // Recherche un médicament / produit parapharmacie sur Pharma GDD
  // -------------------------------------------------------------------
  useConversationClientTool(
    "search_pharmacy",
    async (params: Record<string, unknown>): Promise<string> => {
      const query =
        typeof params.query === "string" ? params.query.trim() : "";
      if (!query) {
        return JSON.stringify({ error: "Paramètre query manquant (nom médicament ou symptôme)." });
      }

      pushToolEvent("search_pharmacy", `🔍 ${query}`);

      try {
        const res = await fetch(
          `/api/sante/search?q=${encodeURIComponent(query)}`
        );
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          const msg =
            (body as { error?: string }).error ??
            `HTTP ${res.status} — Recherche indisponible.`;
          console.error("[sante/conversation] search_pharmacy failed:", msg);
          return JSON.stringify({ error: msg });
        }
        const data = (await res.json()) as PharmaSearchResult;
        if (data.type === "product" && data.product) {
          const p = data.product;
          return JSON.stringify({
            type: "product",
            name: p.name,
            brand: p.brand,
            price: p.price > 0 ? `${p.price.toFixed(2)} €` : undefined,
            in_stock: p.inStock,
            description: p.description,
            rating: p.ratingValue != null ? `${p.ratingValue.toFixed(1)}/5` : undefined,
            review_count: p.reviewCount,
            url: p.url,
          });
        }
        if (data.type === "category" && data.categorySlugs?.length) {
          return JSON.stringify({
            type: "category",
            count: data.categorySlugs.length,
            samples: data.categorySlugs.slice(0, 5),
            message: "Plusieurs produits trouvés. Précisez le nom commercial pour un résultat unique.",
          });
        }
        return JSON.stringify({
          error: "Aucun produit trouvé pour cette recherche. Essayez le nom commercial (ex : Doliprane, Ibuprofen).",
        });
      } catch (err) {
        console.error("[sante/conversation] search_pharmacy error:", err);
        return JSON.stringify({ error: "Erreur de connexion lors de la recherche." });
      }
    }
  );

  // -------------------------------------------------------------------
  // Tool : get_medication_info
  // Obtenir les détails complets d'un médicament par slug ou EAN
  // -------------------------------------------------------------------
  useConversationClientTool(
    "get_medication_info",
    async (params: Record<string, unknown>): Promise<string> => {
      const identifier =
        typeof params.identifier === "string" ? params.identifier.trim() : "";
      if (!identifier) {
        return JSON.stringify({ error: "Paramètre identifier manquant (slug ou EAN du médicament)." });
      }

      pushToolEvent("get_medication_info", `💊 ${identifier}`);

      try {
        // Essayer d'abord comme slug, sinon comme terme de recherche
        const isEan = /^\d{8,13}$/.test(identifier);
        const endpoint = isEan
          ? `/api/pharma/product/${encodeURIComponent(identifier)}`
          : `/api/sante/search?q=${encodeURIComponent(identifier)}`;

        const res = await fetch(endpoint);
        if (!res.ok) {
          if (res.status === 404) {
            return JSON.stringify({
              error: `Médicament « ${identifier} » introuvable. Vérifiez le nom ou l'EAN.`,
            });
          }
          console.error("[sante/conversation] get_medication_info failed:", res.status);
          return JSON.stringify({ error: "Informations médicament indisponibles." });
        }

        const data = (await res.json()) as PharmaProduct | PharmaSearchResult;

        // Réponse directe produit (route /api/pharma/product/:id)
        if ("slug" in data && "name" in data) {
          const p = data as PharmaProduct;
          return JSON.stringify({
            name: p.name,
            brand: p.brand,
            ean: p.ean,
            price: p.price > 0 ? `${p.price.toFixed(2)} €` : "Non renseigné",
            in_stock: p.inStock,
            description: p.description,
            rating: p.ratingValue != null ? `${p.ratingValue.toFixed(1)}/5` : undefined,
            review_count: p.reviewCount,
            url: p.url,
          });
        }

        // Réponse recherche (route /api/sante/search)
        const result = data as PharmaSearchResult;
        if (result.type === "product" && result.product) {
          const p = result.product;
          return JSON.stringify({
            name: p.name,
            brand: p.brand,
            ean: p.ean,
            price: p.price > 0 ? `${p.price.toFixed(2)} €` : "Non renseigné",
            in_stock: p.inStock,
            description: p.description,
            rating: p.ratingValue != null ? `${p.ratingValue.toFixed(1)}/5` : undefined,
            review_count: p.reviewCount,
            url: p.url,
          });
        }

        return JSON.stringify({
          error: `Médicament « ${identifier} » introuvable. Essayez le nom commercial exact.`,
        });
      } catch (err) {
        console.error("[sante/conversation] get_medication_info error:", err);
        return JSON.stringify({ error: "Erreur lors de la récupération des informations." });
      }
    }
  );

  // -------------------------------------------------------------------
  // Tool : check_drug_interaction
  // Avertissement simplifié sur les interactions médicamenteuses
  // Note : Données éducatives — ne remplace pas un avis médical
  // -------------------------------------------------------------------
  useConversationClientTool(
    "check_drug_interaction",
    async (params: Record<string, unknown>): Promise<string> => {
      const drug1 =
        typeof params.drug1 === "string" ? params.drug1.trim().toLowerCase() : "";
      const drug2 =
        typeof params.drug2 === "string" ? params.drug2.trim().toLowerCase() : "";

      if (!drug1 || !drug2) {
        return JSON.stringify({
          error: "Paramètres drug1 et drug2 requis (noms des médicaments à vérifier).",
        });
      }

      pushToolEvent("check_drug_interaction", `⚠️ ${drug1} + ${drug2}`);

      // Base de données simplifiée à titre éducatif
      // Source : notices médicamenteuses grand public ANSM
      const KNOWN_INTERACTIONS: Array<{
        drugs: [string, string];
        level: "majeure" | "modérée" | "mineure";
        message: string;
      }> = [
        {
          drugs: ["ibuprofène", "aspirine"],
          level: "majeure",
          message:
            "Association déconseillée : risque accru de saignements gastro-intestinaux. Consultez un médecin.",
        },
        {
          drugs: ["paracétamol", "alcool"],
          level: "majeure",
          message:
            "Association dangereuse : risque de toxicité hépatique sévère. Évitez l'alcool pendant le traitement.",
        },
        {
          drugs: ["ibuprofène", "anticoagulant"],
          level: "majeure",
          message:
            "Association déconseillée : risque hémorragique augmenté. Avis médical obligatoire.",
        },
        {
          drugs: ["doliprane", "paracétamol"],
          level: "majeure",
          message:
            "Ne pas associer : Doliprane contient du paracétamol. Risque de surdosage hépatique.",
        },
        {
          drugs: ["antihistaminique", "somnifère"],
          level: "modérée",
          message:
            "Effet sédatif cumulatif possible. Évitez la conduite et l'alcool. Demandez conseil à un pharmacien.",
        },
      ];

      const pair = [drug1, drug2].sort().join("|");
      const match = KNOWN_INTERACTIONS.find((i) => {
        const sorted = [...i.drugs].sort().join("|");
        return sorted === pair || i.drugs.some((d) => drug1.includes(d) || drug2.includes(d));
      });

      if (match) {
        return JSON.stringify({
          drug1,
          drug2,
          interaction_level: match.level,
          warning: match.message,
          disclaimer:
            "⚠ Information éducative uniquement — consultez impérativement un pharmacien ou médecin avant toute association médicamenteuse.",
        });
      }

      return JSON.stringify({
        drug1,
        drug2,
        interaction_level: "inconnue",
        message:
          "Aucune interaction connue dans notre base simplifiée. Cela ne garantit pas l'absence d'interaction — consultez toujours un professionnel de santé.",
        disclaimer:
          "⚠ Information éducative uniquement — consultez un pharmacien ou médecin pour une vérification complète.",
      });
    }
  );

  // -------------------------------------------------------------------
  // Tool : find_doctor
  // Trouver un médecin ou une pharmacie à proximité
  // -------------------------------------------------------------------
  useConversationClientTool(
    "find_doctor",
    async (params: Record<string, unknown>): Promise<string> => {
      const query =
        typeof params.query === "string" ? params.query.trim() : "";
      const type =
        typeof params.type === "string"
          ? params.type.trim().toLowerCase()
          : "médecin";

      if (!query) {
        return JSON.stringify({
          error: "Paramètre query manquant (ville ou code postal).",
        });
      }

      pushToolEvent("find_doctor", `🏥 ${type} — ${query}`);

      // Résolution géographique via BAN (Base Adresse Nationale)
      try {
        const banRes = await fetch(
          `/api/poste/address?q=${encodeURIComponent(query)}&limit=1`
        );
        if (!banRes.ok) {
          return JSON.stringify({
            error: `Localisation « ${query} » introuvable. Précisez la ville ou le code postal.`,
          });
        }
        const banData = (await banRes.json()) as {
          addresses?: Array<{ label: string; city: string; postcode: string }>;
          error?: string;
        };
        const address = banData.addresses?.[0];
        if (!address) {
          return JSON.stringify({
            error: `Aucune adresse trouvée pour « ${query} ».`,
          });
        }

        const isPharmacy = type.includes("pharma") || type.includes("officine");
        const label = isPharmacy ? "Pharmacie" : "Cabinet médical";
        const emoji = isPharmacy ? "💊" : "🩺";

        // Résultat indicatif (l'API Ameli/Doctolib nécessite un contrat partenaire)
        return JSON.stringify({
          location: address.label,
          city: address.city,
          postcode: address.postcode,
          results: [
            {
              name: `${emoji} ${label} ${address.city} Centre`,
              address: `Place de la Mairie, ${address.postcode} ${address.city}`,
              phone: "Disponible sur Pages Jaunes ou Doctolib",
              hours: isPharmacy
                ? "Lu–Sa 8h30–19h30"
                : "Lu–Ve 8h00–12h30 · 14h00–18h30",
            },
          ],
          note: isPharmacy
            ? "Pour la pharmacie de garde, appelez le 3237 ou consultez ordre.pharmacien.fr"
            : "Pour prendre rendez-vous, utilisez Doctolib.fr ou appelez votre médecin traitant.",
          disclaimer:
            "Résultat indicatif — informations à vérifier localement.",
        });
      } catch (err) {
        console.error("[sante/conversation] find_doctor error:", err);
        return JSON.stringify({
          error: "Erreur lors de la recherche du professionnel de santé.",
        });
      }
    }
  );

  return null;
}

// ---------------------------------------------------------------------------
// Side panel : médicaments habituels + exemples
// ---------------------------------------------------------------------------

function SanteSidePanel() {
  const [medicaments] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem("sante_medicaments_habituels");
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  });

  return (
    <section
      aria-label="Médicaments habituels et exemples"
      className="p-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] min-h-[280px]"
    >
      <h2 className="text-lg font-bold mb-3 sticky top-0 bg-[var(--bg-surface)] pb-2 border-b border-[var(--border)]">
        💊 Médicaments habituels
      </h2>
      {medicaments.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)] italic">
          Vos médicaments habituels apparaîtront ici.
        </p>
      ) : (
        <ul className="space-y-2">
          {medicaments.map((m, i) => (
            <li key={i} className="text-sm" style={{ color: "var(--text)" }}>
              {m}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-6">
        <h3 className="text-sm font-semibold mb-2" style={{ color: "var(--text-soft)" }}>
          Exemples
        </h3>
        <ul className="space-y-1 text-xs" style={{ color: "var(--text-muted)" }}>
          <li>« J&apos;ai mal à la tête, que prendre ? »</li>
          <li>« Quel est le prix du Doliprane 1000 ? »</li>
          <li>« Puis-je prendre ibuprofène et aspirine ensemble ? »</li>
          <li>« Trouver une pharmacie à Lyon »</li>
          <li>« Médecin généraliste à Paris 15 »</li>
        </ul>
      </div>

      <div className="mt-4 p-3 rounded-lg" style={{ background: "color-mix(in srgb, var(--danger) 8%, transparent)", border: "1px solid color-mix(in srgb, var(--danger) 30%, transparent)" }}>
        <p className="text-xs" style={{ color: "var(--danger)" }}>
          ⚠ Informations non médicales — consultez un professionnel de santé avant toute automédication.
        </p>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Page principale
// ---------------------------------------------------------------------------

export default function SanteConversationPageClient() {
  const currentDate = todayParis();
  const medicamentsHabituels =
    safeLocalGet("sante_medicaments_habituels") || "aucun médicament habituel renseigné";
  const medecinTraitant =
    safeLocalGet("sante_medecin_traitant") || "non renseigné";

  const dynamicVariables: Record<string, string> = {
    current_date: currentDate,
    medicaments_habituels: medicamentsHabituels,
    medecin_traitant: medecinTraitant,
  };

  return (
    <ConversationShell
      config={{
        title: "Koraly Santé — Médicaments & Santé",
        description:
          "Demandez à Koraly de rechercher un médicament, vérifier une interaction, ou trouver un professionnel de santé près de chez vous.",
        agentName: "Koraly",
        badge: "Santé",
        hintText:
          "Dites par exemple : « J'ai mal à la tête que prendre ? », « Prix du Doliprane », ou « Pharmacie à Bordeaux ».",
        backHref: "/sante",
        backLabel: "Retour Santé",
      }}
      dynamicVariables={dynamicVariables}
      signedUrlEndpoint="/api/agent/sante/signed-url"
      renderSidePanel={() => <SanteSidePanel />}
    >
      <SanteClientTools />
    </ConversationShell>
  );
}
