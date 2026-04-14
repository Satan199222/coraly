/**
 * Blog topics pool — 30 sujets FR pour le blog auto-généré VoixCourses.
 * Rotation par semaine ISO : chaque mercredi, le cron choisit le sujet
 * correspondant à (isoWeek - 1) % BLOG_TOPICS.length.
 *
 * Référence : GROA-125 — Blog auto-généré VoixCourses (impl. Sanity + cron)
 */

export interface BlogTopic {
  id: number;
  /** Titre de l'article */
  title: string;
  /** Slug URL-safe (sans accents, tirets) */
  slug: string;
  /** Catégorie éditoriale */
  category: "accessibilite" | "formation" | "technologie" | "pratique";
}

export const BLOG_TOPICS: BlogTopic[] = [
  {
    id: 1,
    title: "Apprendre avec sa voix : synthèse vocale et mémorisation",
    slug: "apprendre-avec-sa-voix-synthese-vocale-memorisation",
    category: "formation",
  },
  {
    id: 2,
    title: "Formation en ligne pour personnes malvoyantes : bonnes pratiques",
    slug: "formation-en-ligne-personnes-malvoyantes-bonnes-pratiques",
    category: "formation",
  },
  {
    id: 3,
    title: "DMLA et numérique : adapter son expérience d'apprentissage",
    slug: "dmla-numerique-adapter-experience-apprentissage",
    category: "accessibilite",
  },
  {
    id: 4,
    title: "Glaucome et accessibilité web : guide pour les apprenants",
    slug: "glaucome-accessibilite-web-guide-apprenants",
    category: "accessibilite",
  },
  {
    id: 5,
    title: "ElevenLabs en e-learning : la voix IA naturelle pour la formation",
    slug: "elevenlabs-e-learning-voix-ia-naturelle-formation",
    category: "technologie",
  },
  {
    id: 6,
    title: "WCAG 2.2 niveau AAA : ce que ça garantit pour les apprenants",
    slug: "wcag-22-niveau-aaa-garanties-apprenants",
    category: "accessibilite",
  },
  {
    id: 7,
    title: "Navigation vocale et lecteurs d'écran : guide pratique 2025",
    slug: "navigation-vocale-lecteurs-ecran-guide-pratique-2025",
    category: "pratique",
  },
  {
    id: 8,
    title: "Thèmes de contraste : pourquoi certains aident mieux les yeux",
    slug: "themes-contraste-aident-mieux-les-yeux",
    category: "accessibilite",
  },
  {
    id: 9,
    title: "Droits des apprenants déficients visuels au numérique en France",
    slug: "droits-apprenants-deficients-visuels-numerique-france",
    category: "formation",
  },
  {
    id: 10,
    title: "Accessibilité des PDF de cours : comment les améliorer concrètement",
    slug: "accessibilite-pdf-cours-ameliorer-concretement",
    category: "pratique",
  },
  {
    id: 11,
    title: "Formation continue et handicap visuel : aides disponibles en France",
    slug: "formation-continue-handicap-visuel-aides-france",
    category: "formation",
  },
  {
    id: 12,
    title: "Apprendre à coder en basse vision : outils et astuces",
    slug: "apprendre-coder-basse-vision-outils-astuces",
    category: "pratique",
  },
  {
    id: 13,
    title: "Dyslexie et accessibilité numérique : quels points communs",
    slug: "dyslexie-accessibilite-numerique-points-communs",
    category: "accessibilite",
  },
  {
    id: 14,
    title: "Adapter son smartphone pour accéder aux cours",
    slug: "adapter-smartphone-acceder-aux-cours",
    category: "pratique",
  },
  {
    id: 15,
    title: "RGAA et accessibilité numérique : ce que ça garantit vraiment",
    slug: "rgaa-accessibilite-numerique-ce-que-ca-garantit",
    category: "accessibilite",
  },
  {
    id: 16,
    title: "Navigation clavier dans les plateformes e-learning",
    slug: "navigation-clavier-plateformes-e-learning",
    category: "pratique",
  },
  {
    id: 17,
    title: "IA et apprentissage adaptatif pour tous",
    slug: "ia-apprentissage-adaptatif-pour-tous",
    category: "technologie",
  },
  {
    id: 18,
    title: "Réseaux d'apprenants malvoyants en France",
    slug: "reseaux-apprenants-malvoyants-france",
    category: "formation",
  },
  {
    id: 19,
    title: "Voix IA vs voix humaine : quel impact sur la mémorisation",
    slug: "voix-ia-vs-voix-humaine-impact-memorisation",
    category: "technologie",
  },
  {
    id: 20,
    title: "Podcasts comme format d'apprentissage accessible",
    slug: "podcasts-format-apprentissage-accessible",
    category: "formation",
  },
  {
    id: 21,
    title: "Transcription automatique des cours vidéo",
    slug: "transcription-automatique-cours-video",
    category: "technologie",
  },
  {
    id: 22,
    title: "FALC : aller plus loin que l'accessibilité basique",
    slug: "falc-aller-plus-loin-accessibilite-basique",
    category: "accessibilite",
  },
  {
    id: 23,
    title: "Inclusion numérique et formation professionnelle",
    slug: "inclusion-numerique-formation-professionnelle",
    category: "formation",
  },
  {
    id: 24,
    title: "Technologies d'assistance et apprentissage professionnel",
    slug: "technologies-assistance-apprentissage-professionnel",
    category: "technologie",
  },
  {
    id: 25,
    title: "Lecteur d'écran JAWS vs NVDA : comparatif pour apprenants",
    slug: "jaws-vs-nvda-comparatif-apprenants",
    category: "pratique",
  },
  {
    id: 26,
    title: "Zoom text et loupe Windows : paramétrer pour les cours en ligne",
    slug: "zoom-text-loupe-windows-parametrer-cours-en-ligne",
    category: "pratique",
  },
  {
    id: 27,
    title: "L'avenir de l'e-learning accessible : tendances 2025",
    slug: "avenir-e-learning-accessible-tendances-2025",
    category: "technologie",
  },
  {
    id: 28,
    title: "Créer des cours accessibles pour formateurs : guide pratique",
    slug: "creer-cours-accessibles-formateurs-guide-pratique",
    category: "formation",
  },
  {
    id: 29,
    title: "Plateforme e-learning et contraste : tester avec les vrais utilisateurs",
    slug: "plateforme-e-learning-contraste-tests-utilisateurs",
    category: "accessibilite",
  },
  {
    id: 30,
    title: "Voix et apprentissage des langues : accessibilité et méthode",
    slug: "voix-apprentissage-langues-accessibilite-methode",
    category: "formation",
  },
];

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

/**
 * Sélectionne le topic pour une semaine ISO donnée.
 * La rotation est circulaire : semaine 1 → topic 0, semaine 31 → topic 0, etc.
 *
 * Retourne `undefined` si le tableau est vide pour éviter un crash silencieux
 * (modulo 0 = NaN → tableau[NaN] = undefined avec l'ancienne signature).
 */
export function getTopicForWeek(isoWeek: number): BlogTopic | undefined {
  if (BLOG_TOPICS.length === 0) return undefined;
  const index = (isoWeek - 1) % BLOG_TOPICS.length;
  return BLOG_TOPICS[index];
}
