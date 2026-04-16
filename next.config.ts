import type { NextConfig } from "next";

/**
 * Headers de sécurité globaux.
 *
 * - Strict-Transport-Security : force HTTPS pendant 2 ans (HSTS preload-ready).
 * - X-Content-Type-Options : bloque le MIME-sniffing.
 * - X-Frame-Options : interdit que Coraly soit iframé (clickjacking).
 * - Referrer-Policy : ne fuite que l'origine, pas la query complète.
 * - Permissions-Policy : coupe les API sensibles qu'on n'utilise pas.
 *   On garde `microphone` explicite car la dictée en a besoin.
 * - X-DNS-Prefetch-Control : minor, réduit fuites via prefetch DNS.
 *
 * CSP non activée ici : Next/Tailwind en dev ont besoin d'inline styles et
 * d'exécution dynamique (Turbopack HMR). Pour prod, on peut activer une CSP
 * stricte dédiée — à faire quand la surface se stabilise.
 */
const securityHeaders = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: [
      "microphone=(self)", // dictée vocale
      "camera=()",
      "geolocation=()",
      "payment=()",
      "usb=()",
      "bluetooth=()",
    ].join(", "),
  },
  { key: "X-DNS-Prefetch-Control", value: "on" },
];

const nextConfig: NextConfig = {
  serverExternalPackages: ["playwright-core", "sharp"],
  turbopack: {
    root: __dirname,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
