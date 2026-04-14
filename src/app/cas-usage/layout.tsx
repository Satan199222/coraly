import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "VoixCourses — Pour les seniors, les personnes malvoyantes et les aidants",
  description:
    "Découvrez comment VoixCourses accompagne seniors, personnes malvoyantes et aidants vers plus d'autonomie et d'indépendance.",
  alternates: {
    canonical: "/cas-usage",
  },
  openGraph: {
    type: "website",
    title: "VoixCourses — Pour les seniors, les personnes malvoyantes et les aidants",
    description:
      "Découvrez comment VoixCourses accompagne seniors, personnes malvoyantes et aidants vers plus d'autonomie et d'indépendance.",
    url: "/cas-usage",
    images: [
      {
        url: "/images/og-default.jpg",
        width: 1200,
        height: 630,
        alt: "VoixCourses — Cas d'usage",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "VoixCourses — Pour les seniors, les personnes malvoyantes et les aidants",
    description:
      "Comment VoixCourses accompagne seniors, personnes malvoyantes et aidants vers l'autonomie.",
    images: ["/images/og-default.jpg"],
  },
};

export default function CasUsageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
