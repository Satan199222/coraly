import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "VoixCourses — Apprendre en ligne par la voix, accessible à tous",
  description:
    "Découvrez les fonctionnalités de VoixCourses : navigation vocale, accessibilité WCAG AA+ et extension Chrome. Gratuit pour les particuliers.",
  alternates: {
    canonical: "/fonctionnalites",
  },
  openGraph: {
    type: "website",
    title: "VoixCourses — Apprendre en ligne par la voix, accessible à tous",
    description:
      "Découvrez les fonctionnalités de VoixCourses : navigation vocale, accessibilité WCAG AA+ et extension Chrome. Gratuit pour les particuliers.",
    url: "/fonctionnalites",
    images: [
      {
        url: "/images/og-default.jpg",
        width: 1200,
        height: 630,
        alt: "VoixCourses — Fonctionnalités",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "VoixCourses — Apprendre en ligne par la voix, accessible à tous",
    description:
      "Découvrez les fonctionnalités de VoixCourses : navigation vocale, accessibilité WCAG AA+ et extension Chrome.",
    images: ["/images/og-default.jpg"],
  },
};

export default function FonctionnalitesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
