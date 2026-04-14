import type { Metadata } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://voixcourses.fr";

export const metadata: Metadata = {
  title: "Application accessibilité seniors — Apprendre en ligne sans barrière | VoixCourses",
  description:
    "VoixCourses est l'application de formation en ligne pensée pour les seniors. Navigation vocale, grande police, interface épurée. Gratuit pour les particuliers.",
  alternates: {
    canonical: "/guide/application-accessibilite-seniors",
  },
  openGraph: {
    type: "website",
    title: "Application accessibilité seniors — Apprendre en ligne sans barrière | VoixCourses",
    description:
      "VoixCourses est l'application de formation en ligne pensée pour les seniors. Navigation vocale, grande police, interface épurée.",
    url: "/guide/application-accessibilite-seniors",
    images: [
      {
        url: "/images/og-default.jpg",
        width: 1200,
        height: 630,
        alt: "Application accessibilité seniors — VoixCourses",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Application accessibilité seniors | VoixCourses",
    description:
      "Formation en ligne pensée pour les seniors. Navigation vocale, grande police, interface épurée. Gratuit.",
    images: ["/images/og-default.jpg"],
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: "L'application qui met la formation en ligne à portée de tous les seniors",
  description:
    "VoixCourses est l'application de formation en ligne pensée pour les seniors. Navigation vocale, grande police, interface épurée. Gratuit pour les particuliers.",
  url: `${SITE_URL}/guide/application-accessibilite-seniors`,
  inLanguage: "fr",
  breadcrumb: {
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Accueil",
        item: SITE_URL,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Guides",
        item: `${SITE_URL}/guide`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: "Application accessibilité seniors",
        item: `${SITE_URL}/guide/application-accessibilite-seniors`,
      },
    ],
  },
};

export default function AppAccessibiliteSeniorsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {children}
    </>
  );
}
