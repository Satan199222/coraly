/**
 * Script inline appliqué AVANT le premier paint pour éviter le FOWT
 * (Flash of Wrong Theme) et le FOUT sur la taille de police.
 *
 * Thème par défaut : clair (palette Marine éditorial, cream #F4EEE3).
 * Taille par défaut : 18px (base accessible low vision, recommandation WCAG 2.2).
 *
 * Thèmes supportés : sombre, jaune-noir (DMLA), blanc-bleu (glaucome).
 * Le thème "clair" est l'absence de classe.
 *
 * Migration des anciennes clés (dark, light, high-contrast, 1.3rem, 1.125rem)
 * vers les nouveaux noms pour préserver le choix d'un utilisateur existant.
 */
export const THEME_INIT_SCRIPT = `
(function() {
  try {
    var t = localStorage.getItem('voixcourses-theme');
    var migration = { 'dark': 'sombre', 'high-contrast': 'jaune-noir', 'light': 'clair' };
    if (migration[t]) { t = migration[t]; localStorage.setItem('voixcourses-theme', t); }
    if (t === 'sombre' || t === 'jaune-noir' || t === 'blanc-bleu') {
      document.documentElement.classList.add('theme-' + t);
    }
    var s = localStorage.getItem('voixcourses-font-size') || '18px';
    if (s === '1.3rem' || s === '1.125rem') { s = '18px'; localStorage.setItem('voixcourses-font-size', s); }
    document.documentElement.style.setProperty('--font-size-base', s);
    if (!localStorage.getItem('voixcourses-font-size')) {
      localStorage.setItem('voixcourses-font-size', '18px');
    }
  } catch (e) {}
})();
`.trim();
