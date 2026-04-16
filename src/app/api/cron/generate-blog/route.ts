/**
 * Cron — Génération automatique d'article de blog Coraly (pipeline J ELEMENT).
 *
 * Schedule Vercel : 0 8 * * 3 (mercredi 8h UTC)
 * Déclenchement manuel : GET /api/cron/generate-blog
 *   avec header Authorization: Bearer <CRON_SECRET>
 *
 * Pipeline :
 *  1. Auth CRON_SECRET (strict — rejet si non configuré)
 *  2. Fetch articles existants depuis Sanity (équilibrage catégories)
 *  3. Génération topic IA via Gemini 2.5 Flash (3 retries)
 *  4. Génération corps article markdown + YAML front-matter via Gemini 2.5 Flash
 *  5. Parse front-matter → description + image_prompt
 *  6. Conversion markdown → Portable Text (h2/h3/listes/bold/italic/liens)
 *  7. Génération image couverture via Flux Pro 1.1 + overlay logo Sharp
 *  8. Upload image dans Sanity assets
 *  9. Publication article dans Sanity (avec ref image)
 *
 * Référence : GROA-354 — J ELEMENT alignment (FR)
 * TODO GROA-125 : wrapper avec Sentry.withMonitor une fois @sentry/nextjs installé
 */

import { NextRequest, NextResponse } from "next/server";
import { getAllPosts, getWriteClientForCron, publishPost } from "@/lib/sanity/client";
import { BLOG_THEMES, BlogCategory, BlogTopic, getISOWeek } from "@/lib/blog-topics";

// ---------------------------------------------------------------------------
// Auth — strict, aucune tolérance si CRON_SECRET non configuré
// ---------------------------------------------------------------------------

function isAuthorized(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("[cron/generate-blog] CRON_SECRET non configuré — requête rejetée");
    return false;
  }
  return req.headers.get("authorization") === `Bearer ${cronSecret}`;
}

// ---------------------------------------------------------------------------
// Gemini 2.5 Flash via Vercel AI Gateway
// ---------------------------------------------------------------------------

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

async function callGemini(messages: ChatMessage[]): Promise<string> {
  const apiKey = process.env.AI_GATEWAY_API_KEY;
  if (!apiKey) {
    throw new Error("[cron/generate-blog] AI_GATEWAY_API_KEY non configuré");
  }

  const resp = await fetch("https://ai-gateway.vercel.sh/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages,
    }),
  });

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`[cron/generate-blog] Gemini API error ${resp.status}: ${body}`);
  }

  const data = (await resp.json()) as { choices: { message: { content: string } }[] };
  return data.choices[0].message.content;
}

// ---------------------------------------------------------------------------
// Topic generation — Gemini 2.5 Flash, 3 retries, équilibrage catégories
// ---------------------------------------------------------------------------

interface ExistingArticle {
  title: string;
  slug: string;
  category: string;
}

async function generateTopic(existingArticles: ExistingArticle[]): Promise<BlogTopic> {
  // Compter les articles par catégorie pour équilibrer — dérivé de BLOG_THEMES
  const counts: Record<string, number> = Object.fromEntries(
    Object.keys(BLOG_THEMES).map((k) => [k, 0])
  );
  for (const a of existingArticles) {
    if (a.category in counts) counts[a.category]++;
  }

  const priorityOrder = (Object.keys(counts) as BlogCategory[]).sort(
    (a, b) => counts[a] - counts[b]
  );

  const themesCtx = (Object.entries(BLOG_THEMES) as [BlogCategory, (typeof BLOG_THEMES)[BlogCategory]][])
    .map(
      ([cat, theme]) =>
        `- ${cat}: ${theme.description} (mots-clés: ${theme.mainKeywords.slice(0, 5).join(", ")})`
    )
    .join("\n");

  const existingTitles = existingArticles.length
    ? existingArticles.map((a) => `- ${a.title}`).join("\n")
    : "(aucun article existant)";

  const SYSTEM = `Tu es un expert en accessibilité numérique et formation pour malvoyants.
Tu génères des sujets d'articles de blog pour Coraly, plateforme de formation vocale accessible.
Thèmes disponibles :
${themesCtx}

Réponds UNIQUEMENT en JSON valide, sans balise markdown, sans commentaire.`;

  const USER = `Articles existants à éviter :
${existingTitles}

Catégories par priorité (moins utilisée en premier) : ${priorityOrder.join(", ")}

Génère un sujet d'article en JSON :
{
  "title": "Titre de l'article en français",
  "slug": "slug-url-safe-sans-accents",
  "category": "accessibilite|technologie|formation|pratique",
  "keywords": ["mot1", "mot2", "mot3"],
  "tags": ["tag1", "tag2"]
}

Contraintes :
- Sujet concret et utile pour les apprenants malvoyants
- Aucun doublon avec les articles existants
- Favoriser la catégorie "${priorityOrder[0]}"
- Slug en minuscules, tirets uniquement, sans accents`;

  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const raw = await callGemini([
        { role: "system", content: SYSTEM },
        { role: "user", content: USER },
      ]);
      // Nettoyer les éventuels blocs ```json ... ```
      const cleaned = raw.replace(/^```(?:json)?\r?\n?/, "").replace(/\r?\n?```$/, "").trim();
      const topic = JSON.parse(cleaned) as BlogTopic;
      if (!topic.title || !topic.slug || !topic.category) {
        throw new Error("Champs obligatoires manquants dans la réponse JSON");
      }
      return topic;
    } catch (err) {
      lastError = err as Error;
      console.warn(
        `[cron/generate-blog] generateTopic tentative ${attempt + 1}/3 échouée:`,
        err
      );
    }
  }
  throw new Error(
    `[cron/generate-blog] generateTopic échouée après 3 tentatives: ${lastError?.message}`
  );
}

// ---------------------------------------------------------------------------
// Article body — Gemini 2.5 Flash, markdown + YAML front-matter
// ---------------------------------------------------------------------------

interface ArticleBody {
  description: string;
  imagePrompt: string;
  markdownContent: string;
}

async function generateArticleBody(topic: BlogTopic): Promise<ArticleBody> {
  const theme = BLOG_THEMES[topic.category as BlogCategory];
  const SYSTEM = `Tu es un rédacteur expert en accessibilité numérique et formation pour malvoyants.
Tu rédiges des articles de blog pour Coraly, plateforme audio-first pour apprenants déficients visuels.
Style : professionnel mais chaleureux, phrases courtes, accessibles.
Langue : français uniquement.

Tu réponds en markdown structuré avec YAML front-matter.`;

  const USER = `Rédige un article complet sur : "${topic.title}"
Catégorie : ${topic.category}${theme ? ` — ${theme.description}` : ""}
Mots-clés SEO : ${topic.keywords?.join(", ") ?? ""}

Format de réponse OBLIGATOIRE :
---
description: "Résumé SEO de 1-2 phrases (max 160 caractères)"
image_prompt: "English description of an accessible/assistive-tech scene for cover image generation (30-50 words, photorealistic)"
---

## [Titre de section H2]

[Contenu de l'article en markdown]

Règles :
- Structure : introduction + 3-4 sections H2 + conclusion
- Longueur : 900-1200 mots
- Mentionner Coraly naturellement (1-2 fois)
- Conseils pratiques concrets pour les malvoyants
- Optimisé SEO
- image_prompt en ANGLAIS, décrivant une scène réaliste liée à l'accessibilité ou à la tech assistive`;

  const raw = await callGemini([
    { role: "system", content: SYSTEM },
    { role: "user", content: USER },
  ]);

  const { data, content } = parseFrontMatter(raw);

  return {
    description: data["description"] ?? topic.title,
    imagePrompt:
      data["image_prompt"] ??
      `A visually impaired person using assistive technology on a laptop, natural lighting, accessible workspace`,
    markdownContent: content,
  };
}

// ---------------------------------------------------------------------------
// YAML front-matter parser (sans dépendance externe)
// ---------------------------------------------------------------------------

function parseFrontMatter(markdown: string): {
  data: Record<string, string>;
  content: string;
} {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return { data: {}, content: markdown };

  const data: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    const value = line
      .slice(colonIdx + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
    if (key) data[key] = value;
  }

  return { data, content: match[2] };
}

// ---------------------------------------------------------------------------
// Markdown → Portable Text
// Supporte : h1/h2/h3, listes à puces, bold, italic, liens, paragraphes
// ---------------------------------------------------------------------------

type PortableTextSpan = {
  _type: "span";
  _key: string;
  text: string;
  marks: string[];
};

type PortableTextMarkDef = {
  _key: string;
  _type: "link";
  href: string;
};

type PortableTextBlock = {
  _type: "block";
  _key: string;
  style: string;
  listItem?: string;
  level?: number;
  markDefs: PortableTextMarkDef[];
  children: PortableTextSpan[];
};

function markdownToPortableText(markdown: string): PortableTextBlock[] {
  const blocks: PortableTextBlock[] = [];
  const lines = markdown.split("\n");
  let keyCounter = 0;

  function nextKey(prefix: string) {
    return `${prefix}_${keyCounter++}`;
  }

  // Parse inline marks: **bold**, *italic*, [link](url)
  function parseInline(
    text: string,
    blockKey: string
  ): { children: PortableTextSpan[]; markDefs: PortableTextMarkDef[] } {
    const spans: PortableTextSpan[] = [];
    const markDefs: PortableTextMarkDef[] = [];
    let remaining = text;
    let linkIdx = 0;

    while (remaining.length > 0) {
      const linkMatch = remaining.match(/^\[([^\]]+)\]\(([^)]+)\)/);
      if (linkMatch) {
        const key = `lnk_${blockKey}_${linkIdx++}`;
        markDefs.push({ _key: key, _type: "link", href: linkMatch[2] });
        spans.push({
          _type: "span",
          _key: nextKey("sp"),
          text: linkMatch[1],
          marks: [key],
        });
        remaining = remaining.slice(linkMatch[0].length);
        continue;
      }

      const boldMatch = remaining.match(/^\*\*([^*]+)\*\*/);
      if (boldMatch) {
        spans.push({
          _type: "span",
          _key: nextKey("sp"),
          text: boldMatch[1],
          marks: ["strong"],
        });
        remaining = remaining.slice(boldMatch[0].length);
        continue;
      }

      const italicMatch = remaining.match(/^\*([^*\n]+)\*/);
      if (italicMatch) {
        spans.push({
          _type: "span",
          _key: nextKey("sp"),
          text: italicMatch[1],
          marks: ["em"],
        });
        remaining = remaining.slice(italicMatch[0].length);
        continue;
      }

      // Plain text — consume up to next special character
      const plainMatch = remaining.match(/^([^[*\\]+)/);
      if (plainMatch) {
        spans.push({
          _type: "span",
          _key: nextKey("sp"),
          text: plainMatch[1],
          marks: [],
        });
        remaining = remaining.slice(plainMatch[0].length);
        continue;
      }

      // Fallback — consume one character
      spans.push({
        _type: "span",
        _key: nextKey("sp"),
        text: remaining[0],
        marks: [],
      });
      remaining = remaining.slice(1);
    }

    return { children: spans, markDefs };
  }

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // H3
    const h3 = line.match(/^### (.+)/);
    if (h3) {
      const bKey = nextKey("blk");
      const { children, markDefs } = parseInline(h3[1], bKey);
      blocks.push({ _type: "block", _key: bKey, style: "h3", markDefs, children });
      i++;
      continue;
    }

    // H2
    const h2 = line.match(/^## (.+)/);
    if (h2) {
      const bKey = nextKey("blk");
      const { children, markDefs } = parseInline(h2[1], bKey);
      blocks.push({ _type: "block", _key: bKey, style: "h2", markDefs, children });
      i++;
      continue;
    }

    // H1
    const h1 = line.match(/^# (.+)/);
    if (h1) {
      const bKey = nextKey("blk");
      const { children, markDefs } = parseInline(h1[1], bKey);
      blocks.push({ _type: "block", _key: bKey, style: "h1", markDefs, children });
      i++;
      continue;
    }

    // Bullet list
    const bullet = line.match(/^[-*] (.+)/);
    if (bullet) {
      const bKey = nextKey("blk");
      const { children, markDefs } = parseInline(bullet[1], bKey);
      blocks.push({
        _type: "block",
        _key: bKey,
        style: "normal",
        listItem: "bullet",
        level: 1,
        markDefs,
        children,
      });
      i++;
      continue;
    }

    // Empty line → skip
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Paragraph — collect consecutive non-empty non-heading non-list lines
    let paraText = line;
    i++;
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !lines[i].match(/^#{1,3} /) &&
      !lines[i].match(/^[-*] /)
    ) {
      paraText += " " + lines[i];
      i++;
    }

    const bKey = nextKey("blk");
    const { children, markDefs } = parseInline(paraText, bKey);
    blocks.push({ _type: "block", _key: bKey, style: "normal", markDefs, children });
  }

  return blocks;
}

// ---------------------------------------------------------------------------
// Image generation — Flux Pro 1.1 via Vercel AI Gateway
// ---------------------------------------------------------------------------

async function generateCoverImage(imagePrompt: string): Promise<Buffer | null> {
  const apiKey = process.env.AI_GATEWAY_API_KEY;
  if (!apiKey) {
    console.warn("[cron/generate-blog] AI_GATEWAY_API_KEY manquant — image de couverture ignorée");
    return null;
  }

  try {
    const resp = await fetch("https://ai-gateway.vercel.sh/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "bfl/flux-pro-1.1",
        prompt: imagePrompt,
        response_format: "b64_json",
        aspect_ratio: "4:3",
      }),
    });

    if (!resp.ok) {
      console.warn(`[cron/generate-blog] Flux API error ${resp.status} — image ignorée`);
      return null;
    }

    const data = (await resp.json()) as { data?: { b64_json?: string }[] };
    const b64 = data.data?.[0]?.b64_json;
    if (!b64) {
      console.warn("[cron/generate-blog] Pas de b64_json dans la réponse Flux — image ignorée");
      return null;
    }

    return Buffer.from(b64, "base64");
  } catch (err) {
    console.warn("[cron/generate-blog] Génération image Flux échouée:", err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Logo overlay + conversion webp via Sharp
// ---------------------------------------------------------------------------

async function processImageWithLogo(rawBuffer: Buffer): Promise<Buffer> {
  const sharp = (await import("sharp")).default;
  const path = await import("path");
  const fs = await import("fs/promises");

  const meta = await sharp(rawBuffer).metadata();
  const w = meta.width ?? 1200;
  const h = meta.height ?? 900;

  const composites: Parameters<ReturnType<typeof sharp>["composite"]>[0] = [];

  const logoPath = path.join(process.cwd(), "public", "images", "logo-coraly.png");
  try {
    await fs.access(logoPath);
    const logoWidth = Math.round(w * 0.12);
    const padding = Math.round(w * 0.02);
    const logoBuffer = await sharp(logoPath).resize(logoWidth).toBuffer();
    const logoMeta = await sharp(logoBuffer).metadata();
    const logoHeight = logoMeta.height ?? Math.round(logoWidth * 0.5);

    composites.push({
      input: logoBuffer,
      left: w - logoWidth - padding,
      top: h - logoHeight - padding,
    });
  } catch {
    console.warn(
      "[cron/generate-blog] Logo public/images/logo-coraly.png non trouvé — overlay ignoré"
    );
  }

  return sharp(rawBuffer).composite(composites).webp({ quality: 85 }).toBuffer();
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function estimateReadingTime(text: string): number {
  const wordCount = text.trim().split(/\s+/).length;
  return Math.max(1, Math.ceil(wordCount / 250));
}

// ---------------------------------------------------------------------------
// Handler principal
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest): Promise<NextResponse> {
  // TODO GROA-125 : wrapper avec Sentry.withMonitor("blog-cron", ...) une fois @sentry/nextjs installé

  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isoWeek = getISOWeek();
  console.info(`[cron/generate-blog] Démarrage — semaine ISO ${isoWeek}`);

  // -- 1. Fetch articles existants ------------------------------------------
  let existingArticles: ExistingArticle[] = [];
  try {
    const posts = await getAllPosts();
    existingArticles = posts.map((p) => ({
      title: p.title,
      slug: p.slug.current,
      category: p.category,
    }));
    console.info(`[cron/generate-blog] ${existingArticles.length} articles existants chargés`);
  } catch (err) {
    console.warn("[cron/generate-blog] Impossible de charger les articles existants:", err);
    // Non-bloquant — on continue sans contexte
  }

  // -- 2. Génération du topic ------------------------------------------------
  let topic: BlogTopic;
  try {
    topic = await generateTopic(existingArticles);
    console.info(`[cron/generate-blog] Topic généré : "${topic.title}" [${topic.category}]`);
  } catch (err) {
    console.error("[cron/generate-blog] Échec génération topic:", err);
    return NextResponse.json(
      { error: "Génération topic échouée", detail: String(err) },
      { status: 500 }
    );
  }

  // -- 3. Génération du corps de l'article -----------------------------------
  let articleBody: ArticleBody;
  try {
    articleBody = await generateArticleBody(topic);
    console.info(
      `[cron/generate-blog] Corps généré — ${articleBody.markdownContent.length} caractères`
    );
  } catch (err) {
    console.error("[cron/generate-blog] Échec génération corps article:", err);
    return NextResponse.json(
      { error: "Génération article échouée", detail: String(err) },
      { status: 500 }
    );
  }

  // -- 4. Conversion markdown → Portable Text --------------------------------
  const portableBody = markdownToPortableText(articleBody.markdownContent);

  // -- 5. Génération image de couverture (non-fatal) -------------------------
  let mainImageRef: { _type: "image"; asset: { _type: "reference"; _ref: string } } | undefined;

  const rawImageBuffer = await generateCoverImage(articleBody.imagePrompt);
  if (rawImageBuffer) {
    try {
      const processedBuffer = await processImageWithLogo(rawImageBuffer);
      const writeClient = getWriteClientForCron();
      const uploadedAsset = await writeClient.assets.upload(
        "image",
        processedBuffer,
        {
          filename: `${topic.slug}-cover.webp`,
          contentType: "image/webp",
        }
      );
      mainImageRef = {
        _type: "image",
        asset: { _type: "reference", _ref: uploadedAsset._id },
      };
      console.info(
        `[cron/generate-blog] Image uploadée dans Sanity — asset: ${uploadedAsset._id}`
      );
    } catch (err) {
      console.warn("[cron/generate-blog] Échec upload image Sanity — article publié sans image:", err);
    }
  }

  // -- 6. Publication dans Sanity --------------------------------------------
  const readingTimeMinutes = estimateReadingTime(articleBody.markdownContent);
  let postId: string;
  try {
    postId = await publishPost({
      title: topic.title,
      slug: { current: topic.slug },
      publishedAt: new Date().toISOString(),
      excerpt: articleBody.description,
      body: portableBody,
      topicSlug: topic.slug,
      category: topic.category as "accessibilite" | "formation" | "technologie" | "pratique",
      readingTimeMinutes,
      ...(mainImageRef ? { mainImage: mainImageRef } : {}),
    });
  } catch (err) {
    console.error("[cron/generate-blog] Échec publication Sanity:", err);
    return NextResponse.json(
      { error: "Publication Sanity échouée", detail: String(err) },
      { status: 500 }
    );
  }

  console.info(
    `[cron/generate-blog] Article publié — sanityId: ${postId}, slug: ${topic.slug}, image: ${mainImageRef ? "oui" : "non"}`
  );

  return NextResponse.json({
    ok: true,
    sanityId: postId,
    isoWeek,
    topic: { title: topic.title, slug: topic.slug, category: topic.category },
    readingTimeMinutes,
    hasImage: !!mainImageRef,
  });
}
