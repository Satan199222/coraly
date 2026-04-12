/**
 * Script inline pour appliquer le thème AVANT le premier paint.
 * Évite le FOWT (Flash of Wrong Theme).
 *
 * Ce fichier est uniquement utilisé pour générer le contenu du <script> inline
 * dans layout.tsx. Le contenu est une constante, pas du contenu utilisateur.
 */
export const THEME_INIT_SCRIPT = `
(function() {
  try {
    var t = localStorage.getItem('voixcourses-theme');
    if (t === 'light' || t === 'high-contrast') {
      document.documentElement.classList.add('theme-' + t);
    }
    var s = localStorage.getItem('voixcourses-font-size');
    if (s) {
      document.documentElement.style.setProperty('--font-size-base', s);
    }
  } catch (e) {}
})();
`.trim();
