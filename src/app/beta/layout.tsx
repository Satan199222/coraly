import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Accès bêta",
  description:
    "Rejoignez les bêta-testeurs VoixCourses. Testez l'application de courses vocale avant son lancement public et contribuez à rendre le numérique plus accessible.",
  alternates: {
    canonical: "/beta",
  },
  openGraph: {
    type: "website",
    title: "Accès bêta — VoixCourses",
    description:
      "Rejoignez les bêta-testeurs VoixCourses. Testez l'application de courses vocale avant son lancement public.",
    url: "/beta",
    images: [
      {
        url: "/images/og-default.jpg",
        width: 1200,
        height: 630,
        alt: "VoixCourses — Accès bêta prioritaire",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Accès bêta — VoixCourses",
    description:
      "Rejoignez les bêta-testeurs VoixCourses. Testez l'application de courses vocale avant son lancement public.",
    images: ["/images/og-default.jpg"],
  },
};

export default function BetaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
