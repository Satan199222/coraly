import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Blog",
  description:
    "Articles sur l'accessibilité numérique, les courses vocales, la malvoyance et l'innovation inclusive. Conseils pratiques et actualités VoixCourses.",
  alternates: {
    canonical: "/blog",
  },
  openGraph: {
    type: "website",
    title: "Blog — VoixCourses",
    description:
      "Articles sur l'accessibilité numérique, les courses vocales, la malvoyance et l'innovation inclusive.",
    url: "/blog",
    images: [
      {
        url: "/images/og-blog.jpg",
        width: 1200,
        height: 630,
        alt: "Blog VoixCourses — Accessibilité et courses vocales",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Blog — VoixCourses",
    description:
      "Articles sur l'accessibilité numérique, les courses vocales, la malvoyance et l'innovation inclusive.",
    images: ["/images/og-blog.jpg"],
  },
};

export default function BlogLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
