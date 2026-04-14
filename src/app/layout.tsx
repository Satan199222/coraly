import type { Metadata } from "next";
import Script from "next/script";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";
import { THEME_INIT_SCRIPT } from "./theme-init";
import { luciole } from "@/lib/fonts";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://voixcourses.fr";
const GA4_ID = process.env.NEXT_PUBLIC_GA4_ID;
const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "VoixCourses — Vos courses par la voix",
    template: "%s — VoixCourses",
  },
  description:
    "Faites vos courses en ligne par la voix. Dictez, Koraly compose votre panier. Accessible aux non-voyants, malvoyants et seniors.",
  keywords: [
    "courses en ligne accessibles",
    "dictée vocale courses",
    "application courses malvoyants",
    "shopping vocal senior",
    "accessibilité numérique courses",
    "VoixCourses",
    "Koraly",
    "RGAA AAA",
  ],
  authors: [{ name: "GROUPE J" }],
  creator: "GROUPE J",
  publisher: "GROUPE J",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "fr_FR",
    url: SITE_URL,
    siteName: "VoixCourses",
    title: "VoixCourses — Vos courses par la voix",
    description:
      "Faites vos courses en ligne par la voix. Dictez, Koraly compose votre panier. Accessible aux non-voyants, malvoyants et seniors.",
    images: [
      {
        url: "/images/og-default.jpg",
        width: 1200,
        height: 630,
        alt: "VoixCourses — Application de courses vocale accessible",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@voixcourses",
    creator: "@voixcourses",
    title: "VoixCourses — Vos courses par la voix",
    description:
      "Faites vos courses en ligne par la voix. Dictez, Koraly compose votre panier. Accessible aux non-voyants, malvoyants et seniors.",
    images: ["/images/og-default.jpg"],
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      name: "VoixCourses",
      url: SITE_URL,
      description:
        "Application de courses en ligne accessibles par commande vocale. Conçue pour les personnes non-voyantes, malvoyantes et seniors.",
      applicationCategory: "ShoppingApplication",
      operatingSystem: "Web, Chrome Extension",
      inLanguage: "fr",
      availableOnDevice: ["Desktop", "Mobile"],
      featureList: [
        "Commande vocale des courses",
        "Synthèse vocale Koraly",
        "Mode clavier accessible WCAG AAA",
        "Mode conversation IA",
        "Extension Chrome",
        "Compatible lecteurs d'écran",
      ],
      accessibilityFeature: [
        "voiceControl",
        "audioDescription",
        "fullKeyboardControl",
        "highContrastDisplay",
        "largePrint",
      ],
      accessibilityHazard: "none",
      accessibilityAPI: "ARIA",
      accessibilitySummary:
        "Application entièrement accessible WCAG AAA pour les personnes malvoyantes, non-voyantes et seniors.",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "EUR",
        availability: "https://schema.org/InStock",
      },
      creator: {
        "@type": "Organization",
        name: "GROUPE J",
        url: SITE_URL,
      },
    },
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: "GROUPE J",
      url: SITE_URL,
      description:
        "Éditeur de VoixCourses, application de courses vocale accessible.",
      contactPoint: {
        "@type": "ContactPoint",
        contactType: "customer support",
        availableLanguage: "French",
      },
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: "VoixCourses",
      description: "Application de courses accessibles par la voix",
      publisher: { "@id": `${SITE_URL}/#organization` },
      inLanguage: "fr",
      potentialAction: {
        "@type": "SearchAction",
        target: {
          "@type": "EntryPoint",
          urlTemplate: `${SITE_URL}/blog?q={search_term_string}`,
        },
        "query-input": "required name=search_term_string",
      },
    },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" suppressHydrationWarning className={luciole.variable}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body suppressHydrationWarning>
        <Script id="theme-init" strategy="beforeInteractive">
          {THEME_INIT_SCRIPT}
        </Script>

        {/* Google Analytics 4 */}
        {GA4_ID && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${GA4_ID}`}
              strategy="afterInteractive"
            />
            <Script id="ga4-init" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${GA4_ID}', {
                  page_path: window.location.pathname,
                  anonymize_ip: true
                });
              `}
            </Script>
          </>
        )}

        {/* Meta Pixel */}
        {META_PIXEL_ID && (
          <Script id="meta-pixel-init" strategy="afterInteractive">
            {`
              !function(f,b,e,v,n,t,s)
              {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
              n.callMethod.apply(n,arguments):n.queue.push(arguments)};
              if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
              n.queue=[];t=b.createElement(e);t.async=!0;
              t.src=v;s=b.getElementsByTagName(e)[0];
              s.parentNode.insertBefore(t,s)}(window, document,'script',
              'https://connect.facebook.net/en_US/fbevents.js');
              fbq('init', '${META_PIXEL_ID}');
              fbq('track', 'PageView');
            `}
          </Script>
        )}

        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:bg-[var(--accent)] focus:text-[var(--bg)] focus:px-4 focus:py-2 focus:rounded"
        >
          Aller au contenu principal
        </a>
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
