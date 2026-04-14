import type { Metadata } from "next";
import { getPostBySlug } from "@/lib/sanity/client";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://voixcourses.fr";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;

  let post = null;
  try {
    post = await getPostBySlug(slug);
  } catch {
    // Sanity non configuré — utiliser les métadonnées par défaut.
  }

  if (!post) {
    return {
      title: "Article",
      description:
        "Article de blog VoixCourses sur l'accessibilité numérique et les courses vocales.",
      alternates: { canonical: `/blog/${slug}` },
    };
  }

  const ogImage = `${SITE_URL}/images/og-blog.jpg`;

  return {
    title: post.title,
    description: post.excerpt,
    alternates: {
      canonical: `/blog/${slug}`,
    },
    openGraph: {
      type: "article",
      title: post.title,
      description: post.excerpt,
      url: `/blog/${slug}`,
      publishedTime: post.publishedAt,
      section: post.category,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: post.title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.excerpt,
      images: [ogImage],
    },
  };
}

export default function BlogSlugLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
