/**
 * Active la voix VoixCourses sur voixcourses.fr et localhost (dev).
 *
 * Même comportement que sur carrefour.fr :
 * - Message de bienvenue "Appuyez Entrée pour désactiver, Tab pour continuer"
 * - Lecture au focus de chaque élément (bouton, lien, input, etc.)
 * - Raccourci V pour réactiver si désactivée
 * - Préférence user partagée avec carrefour.fr (même clé storage)
 */
(async function () {
  const api = window.__voixcoursesTTS;
  if (!api) return;

  api.installFocusSpeaker();
  api.installVoiceToggleShortcut();
  await api.greetIfNeeded("VoixCourses");
})();
