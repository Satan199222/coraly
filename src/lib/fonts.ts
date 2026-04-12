import localFont from "next/font/local";

/**
 * Luciole : police conçue par le CTRDV (Centre Technique Régional pour la Déficience
 * Visuelle) avec des utilisateurs malvoyants. Licence SIL Open Font License.
 * https://www.luciole-vision.com/
 */
export const luciole = localFont({
  src: [
    { path: "../fonts/luciole/Luciole-Regular.woff2", weight: "400", style: "normal" },
    { path: "../fonts/luciole/Luciole-Regular-Italic.woff2", weight: "400", style: "italic" },
    { path: "../fonts/luciole/Luciole-Bold.woff2", weight: "700", style: "normal" },
    { path: "../fonts/luciole/Luciole-Bold-Italic.woff2", weight: "700", style: "italic" },
  ],
  variable: "--font-luciole",
  display: "swap",
  preload: true,
});
