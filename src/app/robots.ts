import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://voixcourses.fr";

/**
 * robots.txt VoixCourses.
 * - Autorise tous les crawlers sur les pages publiques.
 * - Bloque les routes API et internes.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/blog", "/beta", "/courses"],
        disallow: ["/api/", "/installer/", "/transport/"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
