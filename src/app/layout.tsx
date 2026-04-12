import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import { THEME_INIT_SCRIPT } from "./theme-init";

export const metadata: Metadata = {
  title: "VoixCourses — Assistant Courses Accessible",
  description:
    "Faites vos courses en ligne par la voix. Dictez votre liste, l'IA s'occupe du reste.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body>
        <Script id="theme-init" strategy="beforeInteractive">
          {THEME_INIT_SCRIPT}
        </Script>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:bg-[var(--accent)] focus:text-[var(--bg)] focus:px-4 focus:py-2 focus:rounded"
        >
          Aller au contenu principal
        </a>
        <main id="main" tabIndex={-1}>
          {children}
        </main>
      </body>
    </html>
  );
}
