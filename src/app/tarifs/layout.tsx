import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tarifs VoixCourses — Gratuit pour les particuliers, offre Pro pour les associations",
  description:
    "VoixCourses est gratuit pour les particuliers. Les associations et structures médico-sociales bénéficient d'une offre dédiée multi-utilisateurs.",
  alternates: {
    canonical: "/tarifs",
  },
  openGraph: {
    type: "website",
    title: "Tarifs VoixCourses — Gratuit pour les particuliers",
    description:
      "VoixCourses est gratuit pour les particuliers. Les associations et structures médico-sociales bénéficient d'une offre dédiée multi-utilisateurs.",
    url: "/tarifs",
    images: [
      {
        url: "/images/og-default.jpg",
        width: 1200,
        height: 630,
        alt: "Tarifs VoixCourses",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Tarifs VoixCourses — Gratuit pour les particuliers",
    description:
      "VoixCourses est gratuit pour les particuliers. Les associations bénéficient d'une offre Pro dédiée.",
    images: ["/images/og-default.jpg"],
  },
};

export default function TarifsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
