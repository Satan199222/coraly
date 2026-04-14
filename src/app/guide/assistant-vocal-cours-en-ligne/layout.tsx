import type { Metadata } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://voixcourses.fr";

export const metadata: Metadata = {
  title: "Assistant vocal pour cours en ligne — Apprendre sans les mains | VoixCourses",
  description:
    "Un assistant vocal pour vos cours en ligne : commandez par la voix, apprenez à votre rythme. Découvrez comment VoixCourses rend la formation accessible à tous.",
  alternates: {
    canonical: "/guide/assistant-vocal-cours-en-ligne",
  },
  openGraph: {
    type: "website",
    title: "Assistant vocal pour cours en ligne — Apprendre sans les mains | VoixCourses",
    description:
      "Un assistant vocal pour vos cours en ligne : commandez par la voix, apprenez à votre rythme. VoixCourses rend la formation accessible à tous.",
    url: "/guide/assistant-vocal-cours-en-ligne",
    images: [
      {
        url: "/images/og-default.jpg",
        width: 1200,
        height: 630,
        alt: "Assistant vocal cours en ligne — VoixCourses",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Assistant vocal pour cours en ligne | VoixCourses",
    description:
      "Commandez vos cours par la voix, apprenez à votre rythme. Formation accessible à tous.",
    images: ["/images/og-default.jpg"],
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: "L'assistant vocal qui transforme votre façon d'apprendre en ligne",
  description:
    "Un assistant vocal pour vos cours en ligne : commandez par la voix, apprenez à votre rythme. Découvrez comment VoixCourses rend la formation accessible à tous.",
  url: `${SITE_URL}/guide/assistant-vocal-cours-en-ligne`,
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
        name: "Assistant vocal pour cours en ligne",
        item: `${SITE_URL}/guide/assistant-vocal-cours-en-ligne`,
      },
    ],
  },
};

export default function AssistantVocalLayout({
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
