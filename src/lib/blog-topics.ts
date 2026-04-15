/**
 * Blog themes — configuration éditoriale pour la génération IA de sujets.
 *
 * Remplace l'ancien pool statique BLOG_TOPICS[]. Le cron (generate-blog)
 * appelle Gemini 2.5 Flash avec ces thèmes pour générer un sujet dynamique
 * à chaque exécution, en équilibrant automatiquement les catégories.
 *
 * Référence : GROA-354 — J ELEMENT alignment (FR)
 */

export type BlogCategory = "accessibilite" | "technologie" | "formation" | "pratique";

export interface BlogTopic {
  /** Titre de l'article */
  title: string;
  /** Slug URL-safe (sans accents, tirets) */
  slug: string;
  /** Catégorie éditoriale */
  category: BlogCategory;
  /** Mots-clés SEO */
  keywords: string[];
  /** Tags */
  tags?: string[];
}

export interface BlogTheme {
  /** Description du thème pour le prompt IA */
  description: string;
  /** Mots-clés principaux du thème */
  mainKeywords: string[];
  /** Exemples de sujets pour guider l'IA */
  exampleTopics: string[];
}

export const BLOG_THEMES: Record<BlogCategory, BlogTheme> = {
  accessibilite: {
    description: "Accessibilité numérique pour malvoyants et non-voyants",
    mainKeywords: [
      "DMLA",
      "glaucome",
      "malvoyance",
      "NVDA",
      "JAWS",
      "WCAG",
      "RGAA",
      "a11y",
      "basse vision",
      "contraste",
    ],
    exampleTopics: [
      "DMLA et apprentissage numérique : adapter son environnement",
      "Configurer NVDA pour les cours en ligne",
      "Glaucome et contrastes d'interface web",
    ],
  },
  technologie: {
    description: "Technologies assistives et IA vocale pour l'apprentissage",
    mainKeywords: [
      "voix IA",
      "ElevenLabs",
      "TTS",
      "synthèse vocale",
      "lecteur d'écran",
      "extension Chrome",
      "VoiceOver",
      "Talkback",
    ],
    exampleTopics: [
      "ElevenLabs et e-learning accessible en 2025",
      "Meilleures extensions Chrome pour malvoyants",
      "Comparatif synthèses vocales TTS gratuites",
    ],
  },
  formation: {
    description: "Formation en ligne accessible et mémorisation audio",
    mainKeywords: [
      "e-learning accessible",
      "mémorisation audio",
      "DPC",
      "formation continue",
      "handicap visuel",
      "CPF",
      "OPCO",
    ],
    exampleTopics: [
      "Mémorisation par l'audio : techniques efficaces",
      "DPC et formation pour travailleurs en situation de handicap",
      "Financer sa formation avec le CPF quand on est malvoyant",
    ],
  },
  pratique: {
    description: "Guides pratiques, setup et workflows pour apprenants malvoyants",
    mainKeywords: [
      "setup",
      "workflow",
      "outils",
      "astuces",
      "paramétrage",
      "smartphone accessible",
      "raccourcis clavier",
    ],
    exampleTopics: [
      "Paramétrer son smartphone Android pour les cours",
      "Workflow d'apprentissage audio-first étape par étape",
      "Outils indispensables pour étudier en basse vision",
    ],
  },
};

/**
 * Retourne le numéro de semaine ISO (1–53) de la date donnée (ou aujourd'hui).
 * Algorithme ISO 8601 : la semaine commence le lundi.
 */
export function getISOWeek(date: Date = new Date()): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayOfWeek = d.getUTCDay() || 7; // dimanche = 7
  d.setUTCDate(d.getUTCDate() + 4 - dayOfWeek);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
}
