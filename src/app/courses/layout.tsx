import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Faire mes courses",
  description:
    "Dictez vos courses à Koraly : pommes Golden, lait demi-écrémé, pain complet. Accessible au clavier, à la voix et en mode conversation IA.",
  alternates: {
    canonical: "/courses",
  },
  openGraph: {
    type: "website",
    title: "Faire mes courses — VoixCourses",
    description:
      "Dictez vos courses à Koraly. Accessible au clavier, à la voix et en mode conversation IA.",
    url: "/courses",
    images: [
      {
        url: "/images/og-default.jpg",
        width: 1200,
        height: 630,
        alt: "VoixCourses — Interface de courses vocale",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Faire mes courses — VoixCourses",
    description:
      "Dictez vos courses à Koraly. Accessible au clavier, à la voix et en mode conversation IA.",
    images: ["/images/og-default.jpg"],
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default function CoursesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
