# VoixCourses — Patterns d'accessibilité

> Basé sur WAI-ARIA APG, WebAIM Screen Reader Survey #10, W3C Low Vision Needs, GOV.UK Design System

## Principes

1. **Le screen reader est le premier navigateur.** Tout doit fonctionner sans écran.
2. **La synthèse vocale est opt-in.** OFF par défaut — les utilisateurs de lecteurs d'écran ont déjà leur TTS.
3. **Une action claire par écran.** Pas de choix multiples en compétition.
4. **Headings = navigation.** 71.6% des utilisateurs naviguent par headings (WebAIM #10).

## Structure HTML

- Un `<h1>` par écran, hiérarchie h1→h2→h3 sans saut
- Landmarks : `<main>`, `<nav>`, `<header>` avec `aria-label` si multiples
- Skip link comme premier élément focusable
- `<html lang="fr">`
- Produits dans `<ul role="list">` → `<li>` → `<article aria-labelledby>`

## aria-live

- La zone `aria-live="polite"` est **pré-rendue dans le DOM** au chargement, jamais insérée dynamiquement
- `polite` pour : résultats de recherche, ajout panier, changements d'étape
- `assertive` (ou `role="alert"`) uniquement pour : erreurs, échecs réseau
- Debounce les annonces rapides (1s minimum entre deux annonces)
- `aria-atomic="true"` pour que le message entier soit lu à chaque mise à jour

## Focus management

- `tabindex="-1"` sur `<main>` et les panels pour recevoir le focus programmatique
- À chaque changement d'écran : `panel.focus()` + annonce via aria-live
- Retour du focus au déclencheur quand un dialog se ferme
- Après suppression d'un item : focus sur l'item suivant (pas sur le vide)
- Jamais de `tabindex` > 0

## Formulaires

- Chaque input a un `<label for>` visible
- Texte d'aide lié par `aria-describedby`
- Erreurs dans `role="alert"` avec `aria-invalid="true"` sur le champ
- `aria-disabled` au lieu de `disabled` quand le screen reader doit encore annoncer l'élément

## Boutons

- Natifs `<button>` — jamais de `<div role="button">`
- `aria-label` avec le nom du produit : "Confirmer Lait Lactel" pas "Confirmer"
- `aria-pressed` sur les toggles (micro on/off)
- Prix dans les aria-label : "Ajouter au panier, total estimé 8 euros 10"

## Speech API

- **SpeechRecognition** : toggle explicite (bouton Dicter avec `aria-pressed`)
- **SpeechSynthesis** : OFF par défaut, activable via checkbox "Retour vocal"
- Pause SpeechSynthesis quand SpeechRecognition est actif (conflit audio)
- Toujours fournir l'alternative texte

## Thèmes et vision basse

- 3 thèmes : sombre (défaut), clair, contraste élevé (noir/jaune)
- Contraste minimum 7:1 (AAA) sur tous les thèmes
- Focus ring : 3px solid, couleur distincte du texte
- Tailles en `rem`, base 18px, agrandissable jusqu'à 200%+ sans scroll horizontal
- Pas de sticky headers/footers qui masquent du contenu au zoom
- Pas de timeout sur les actions

## Anti-patterns à éviter

- `aria-label` sur des `<div>` ou `<span>` non-interactifs
- `role="navigation"` sur `<nav>` (redondant)
- `placeholder` comme seul label
- `title` pour des infos essentielles
- CSS `content` pour du texte significatif
- Images de texte
- Auto-play audio
- `autofocus` (timing avant lecteur d'écran)
- Scroll infini (préférer la pagination)

## Tests requis

- [ ] NVDA + Firefox (Windows)
- [ ] VoiceOver + Safari (macOS/iOS)
- [ ] Navigation clavier seule (Tab, Enter, Espace, Échap)
- [ ] Zoom 200% sans scroll horizontal
- [ ] axe-core / Lighthouse audit accessibilité
- [ ] Windows High Contrast Mode
