/**
 * Cron — Génération automatique d'article de blog VoixCourses.
 *
 * Schedule Vercel : 0 8 * * 3 (mercredi 8h UTC)
 * Déclenchement manuel : GET /api/cron/generate-blog
 *   avec header Authorization: Bearer <CRON_SECRET>
 *
 * Flux :
 *  1. Vérification du secret Vercel Cron (ou CRON_SECRET en dev)
 *  2. Calcul de la semaine ISO → sélection du topic
 *  3. Génération du contenu via Vercel AI SDK
 *  4. Publication dans Sanity (TODO GROA-122 — stubs pour l'instant)
 *
 * TODO GROA-122 : activer publishPost() une fois Sanity configuré
 * TODO GROA-125 : wrapper avec Sentry.withMonitor une fois @sentry/nextjs installé
 */

import { NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";
import { getISOWeek, getTopicForWeek } from "@/lib/blog-topics";
import { publishPost } from "@/lib/sanity/client";

/** Sécurisation du cron : Vercel injecte Authorization: Bearer <CRON_SECRET>
 *  En dev local, passer CRON_SECRET dans .env.local */
function isAuthorized(req: NextRequest): boolean {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    // En développement sans secret configuré, on autorise localement
    console.warn("[cron/generate-blog] CRON_SECRET non défini — accès non sécurisé");
    return true;
  }
  return authHeader === `Bearer ${cronSecret}`;
}

/** Estime le temps de lecture en minutes (250 mots/min) */
function estimateReadingTime(text: string): number {
  const wordCount = text.trim().split(/\s+/).length;
  return Math.max(1, Math.ceil(wordCount / 250));
}

/** Transforme le texte brut en tableau de blocs Portable Text minimaliste */
function textToPortableText(text: string): unknown[] {
  return text
    .split("\n\n")
    .filter((p) => p.trim().length > 0)
    .map((paragraph, i) => ({
      _type: "block",
      _key: `block_${i}`,
      style: "normal",
      markDefs: [],
      children: [{ _type: "span", _key: `span_${i}`, text: paragraph.trim(), marks: [] }],
    }));
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  // TODO GROA-125 : wrapper avec Sentry.withMonitor("blog-cron", async () => { ... })
  // une fois @sentry/nextjs installé et configuré

  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isoWeek = getISOWeek();
  const topic = getTopicForWeek(isoWeek);

  if (!topic) {
    console.error("[cron/generate-blog] BLOG_TOPICS est vide — impossible de sélectionner un sujet");
    return NextResponse.json({ error: "Aucun topic disponible" }, { status: 500 });
  }

  console.info(`[cron/generate-blog] Semaine ISO ${isoWeek} → topic #${topic.id} : "${topic.title}"`);

  // -- Génération du contenu ---------------------------------------------------
  let generatedText: string;
  try {
    const { text } = await generateText({
      // Vercel AI Gateway — "anthropic/claude-sonnet-4-6" via gateway string
      // Remplacer par le bon modèle/provider selon la config Vercel AI Gateway
      model: "anthropic/claude-haiku-4-5" as unknown as Parameters<typeof generateText>[0]["model"],
      system: [
        "Tu es un rédacteur expert en accessibilité numérique et formation en ligne.",
        "Rédige des articles de blog informatifs, bienveillants et accessibles.",
        "Style : professionnel mais chaleureux, phrases courtes, sans jargon inutile.",
        "Langue : français, pas d'anglicismes sauf termes techniques incontournables.",
        "Format : paragraphes séparés par une ligne vide, sans titre Markdown (les titres",
        "sont gérés séparément). Introduction + 4-5 paragraphes + conclusion.",
        "Longueur cible : 600-800 mots.",
      ].join(" "),
      prompt: `Rédige un article de blog complet sur le sujet : "${topic.title}"\n\nCatégorie : ${topic.category}\nOrganisation : VoixCourses (plateforme de formation vocale accessible pour malvoyants et non-voyants)\n\nL'article doit :\n- Apporter une valeur concrète aux apprenants déficients visuels ou malvoyants\n- Mentionner VoixCourses de façon naturelle (pas de publicité agressive)\n- Inclure des conseils pratiques ou exemples concrets\n- Être optimisé pour le référencement naturel (SEO)`,
    });
    generatedText = text;
  } catch (err) {
    console.error("[cron/generate-blog] Échec génération IA:", err);
    return NextResponse.json(
      { error: "Génération IA échouée", detail: String(err) },
      { status: 500 }
    );
  }

  // -- Génération de l'extrait ------------------------------------------------
  let excerpt: string;
  try {
    const { text } = await generateText({
      model: "anthropic/claude-haiku-4-5" as unknown as Parameters<typeof generateText>[0]["model"],
      prompt: `Rédige un extrait de 1-2 phrases (max 200 caractères) pour cet article :\n\nTitre : ${topic.title}\n\nCorps :\n${generatedText.substring(0, 500)}`,
    });
    excerpt = text.substring(0, 300);
  } catch (err) {
    console.warn("[cron/generate-blog] Échec génération extrait, utilisation du début du corps:", err);
    excerpt = generatedText.substring(0, 200).trim() + "…";
  }

  // -- Publication Sanity -----------------------------------------------------
  // TODO GROA-122 : décommenter une fois SANITY_PROJECT_ID + SANITY_API_TOKEN disponibles
  // const postId = await publishPost({
  //   title: topic.title,
  //   slug: { current: topic.slug },
  //   publishedAt: new Date().toISOString(),
  //   excerpt,
  //   body: textToPortableText(generatedText),
  //   topicId: topic.id,
  //   topicSlug: topic.slug,
  //   category: topic.category,
  //   readingTimeMinutes: estimateReadingTime(generatedText),
  //   organizationId: "voixcourses",
  // });

  // Stub temporaire — log de ce qui serait publié
  const draftPost = {
    title: topic.title,
    slug: topic.slug,
    publishedAt: new Date().toISOString(),
    excerpt,
    bodyPreview: generatedText.substring(0, 300) + "…",
    readingTimeMinutes: estimateReadingTime(generatedText),
    isoWeek,
    organizationId: "voixcourses",
    status: "DRY_RUN — Sanity non configuré (attendre GROA-122)",
  };

  // Référencer publishPost pour éviter l'erreur TS "unused import"
  void publishPost;
  void textToPortableText;

  console.info("[cron/generate-blog] Dry run — article qui serait publié:", JSON.stringify(draftPost, null, 2));

  return NextResponse.json({
    ok: true,
    dryRun: true,
    isoWeek,
    topic: { id: topic.id, title: topic.title, slug: topic.slug },
    readingTimeMinutes: estimateReadingTime(generatedText),
    message: "Dry run OK — activer publishPost() après GROA-122",
  });
}
