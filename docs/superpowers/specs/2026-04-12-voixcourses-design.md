# VoixCourses — Design Spec

**Date :** 2026-04-12
**Auteur :** Julien + Claude (brainstorming session)
**Statut :** Direction validée, prêt pour implémentation

## 1. Contexte et objectif

VoixCourses est une application d'assistance vocale pour faire ses courses en ligne, destinée aux personnes déficientes visuelles (non-voyantes, malvoyantes, seniors avec DMLA/glaucome/cataracte) ainsi qu'à tous les utilisateurs préférant la voix. Elle s'intègre aux principales enseignes françaises (Carrefour, Auchan, Monoprix, Franprix, Intermarché).

Cette spec fige la **direction visuelle et structurelle** de la landing page et du produit. Le fonctionnel vocal (Koraly, 3 modes, scraping enseignes) existe déjà ; cette spec guide l'habillage éditorial et le refactor UI qui va suivre.

## 2. Architecture de marque

| Rôle | Nom | Usage |
|---|---|---|
| Produit | **VoixCourses** | URL (`voixcourses.fr`), SEO, pitch B2B, App Store, documentation |
| Assistante vocale | **Koraly** | Personnalité, voix (Jade ElevenLabs), orb, "Bonjour je suis Koraly" |

Modèle Amazon/Alexa : produit et personnage sont distincts. Le naming descriptif protège le SEO (« voix + courses ») jusqu'à ce que la traction permette un éventuel rebrand plateforme.

Accueil audio sur la home : **« Bonjour, je suis Koraly. »** (voix chaleureuse Jade, déclenché au chargement si `voix active` dans préférences).

## 3. Tokens visuels

### 3.1 Couleurs

```css
--bg:        #F4EEE3;  /* cream Cloud Dancer warm — Pantone 2026 */
--bg-alt:    #ECE2D1;  /* sable pour sections alternées */
--bg-card:   #FFFFFF;
--ink:       #0D1B2A;  /* body & titres */
--ink-soft:  #3A4A5C;  /* secondary text */
--ink-mute:  #5E6E78;  /* meta, captions */
--marine:    #1E3A5F;  /* primary CTA, accents forts */
--marine-dk: #0D1B2A;  /* dark surface (hero orb, footer) */
--brass:     #B58842;  /* accent décoratif UNIQUEMENT — interdit sur body */
--focus:     #FFD166;  /* ring focus 3px + offset 3px */
```

**Contrastes AAA vérifiés :**
- `ink / bg` = 14:1 ✓
- `marine / bg` = 8.5:1 ✓
- `ink-soft / bg` = 7.8:1 ✓
- `bg / marine-dk` = 14:1 ✓
- `brass / marine-dk` = 4.9:1 (OK pour icônes/accents non-texte ; jamais body)

### 3.2 Typographie

Police unique **Luciole** (CTRDV, Open Font License, conçue pour les malvoyants). Chargée en self-hosted via `next/font/local` pour performance et confidentialité.

Échelle stricte :

| Élément | Taille | Line-height | Letter-spacing | Poids |
|---|---|---|---|---|
| h1 display | 64px | 1.02 | -2px | 700 |
| h2 section | 40px | 1.1 | -1.2px | 700 |
| h3 card | 22px | 1.25 | -0.2px | 700 |
| body | **18px** | 1.65 | 0.005em | 400 |
| meta | 15px | 1.55 | 0.005em | 400 |
| micro / eyebrow | 13px | 1.5 | 0.15em uppercase | 700 |
| kbd | 14px | 1 | 0 | 700 (monospace) |

**Base 18px** (pas 16) suit les recommandations WCAG 2.2 low vision + ACB Large Print Guidelines (18pt pour impression large). L'AccessibilityBar permet Aa−/Aa+ pour 16/20/24/28px.

### 3.3 Rythme vertical

Échelle de spacing : 8 / 16 / 24 / 32 / 48 / 64 / 80 / 96 / 120 px. Sections standard : padding vertical 80-120px, container max-width 1200px, gutter 40px.

### 3.4 Radii, borders, shadows

- Radii : 4px (tags/kbd) / 6px (boutons, inputs) / 8px (cartes produit) / 12px (cartes section) / 16px (hero orb)
- Borders : `1px solid rgba(13,27,42,0.10)` par défaut, `0.20` sur hover
- Shadows : `0 10px 28px rgba(13,27,42,0.08)` pour hover cards, `0 30px 60px rgba(0,0,0,0.6)` pour hero modals

### 3.5 Profils visuels (AccessibilityBar)

4 profils commutables + Aa−/Aa+ + toggle voix :

| Profil | Usage | Couleurs |
|---|---|---|
| Clair (défaut) | Utilisateurs sighted, malvoyants légers | `#F4EEE3 / #0D1B2A` |
| Sombre | Fatigue oculaire, environnements peu éclairés | `#0D1B2A / #F4EEE3` |
| Jaune/Noir | DMLA, dégénérescence maculaire | `#000000 / #FFEB00` |
| Blanc/Bleu | Glaucome (préférence longueurs d'onde) | `#003366 / #FFFFFF` |

Chaque profil garantit contraste AAA sur tous les éléments.

## 4. Structure de la home

Ordre validé des sections :

1. **AccessibilityBar (sticky top)** — Label "Confort de lecture", Aa−/Aa+, 4 profils, toggle voix, états `aria-pressed`
2. **Header site** — Logo `VoixCourses.` + sous-titre `par Koraly`, nav principale, bouton Se connecter
3. **Hero** — eyebrow "Accessibilité première · Conforme AAA", h1 "Vos courses, par la voix.", lede, CTA primaire + démo audio, raccourcis clavier visibles, Koraly orb animée (pulse + 2 ripples) avec transcript live et bouton "Écouter la voix"
4. **Trust strip** — Enseignes partenaires (Carrefour, Auchan, Monoprix, Franprix, Intermarché, + bientôt)
5. **Section 3 modes** — "Choisissez votre manière de faire les courses", 3 cartes avec touche clavier affichée (1/2/3), carte centrale featured (sombre), features listées en puces, mention "idéal pour"
6. **Manifesto accessibilité** — Titre "L'accessibilité, c'est le produit. Pas une case cochée.", 4 engagements (Luciole, AAA, clavier/SR, voix/motion), stat "1,7 M personnes déficientes visuelles en France"
7. **Walk-through** — Dialogue en bulles (Koraly ink sombre / Vous sable clair / bulle produit avec carte Nutriscore inline)
8. **Témoignage** — Citation utilisateur déficient visuel, avatar photo authentique (pas illustration)
9. **FAQ** — 5 questions accessibilité/technique/prix/RGPD, accordéon sans bibliothèque JS (ou `<details>`)
10. **Final CTA** — Bloc plein largeur "Faites vos courses en trois minutes", double CTA
11. **Footer** — 4 colonnes (Brand tagline · Produit · Accessibilité · Entreprise) + legal avec badges RGAA AAA / EAA 2025

## 5. Animations et sons

- **Orb Koraly** : respiration `scale(1) → scale(1.05)` en 2.4s, 2 ripples concentriques décalés de 0.8s
- **Live dot** : pulse opacité 2s
- **Bip sonore** : aigu 880Hz 80ms (début d'écoute), grave 520Hz 80ms (fin d'écoute) via Web Audio API
- **Réduction motion** : `@media (prefers-reduced-motion: reduce)` coupe toutes les animations, garde états statiques

## 6. Accessibilité (non-négociable)

- **WCAG 2.2 AAA** sur tout le contenu textuel
- **RGAA 4.1** conforme, déclaration publiée
- **EAA 2025** anticipée
- Focus visible doublé (outline 3px `--focus` + offset 3px)
- ARIA live regions pour annonces Koraly (`aria-live="polite"` par défaut, `assertive` pour erreurs)
- Tests : NVDA (Windows), JAWS (Windows), VoiceOver (macOS/iOS), TalkBack (Android)
- `forced-colors: active` supporté (Windows High-Contrast)
- `prefers-reduced-motion` respecté partout

## 7. Éléments hors home (à déduire des tokens)

Les pages `/courses/clavier`, `/courses/vocal`, `/courses/conversation`, `/installer`, `/a-propos` héritent de la même palette, typo, rythme. Cette spec fige uniquement la home ; les autres pages seront spécifiées si nécessaire lors de l'implémentation.

## 8. Mockup de référence

Mockup HTML complet produit pendant la session brainstorming :

- `.superpowers/brainstorm/2955-1776017807/content/home-marine-v2.html`

Ce fichier est la source de vérité pour la couleur exacte, les proportions et les détails visuels lors de l'implémentation.

## 9. Hors périmètre de cette spec

- Refactor de l'UI des modes existants (sera couvert par le plan d'implémentation)
- Contenu FAQ/témoignages définitif (à rédiger avec utilisateurs réels)
- Logos enseignes en vectoriel (à obtenir des enseignes ou marque générique en attendant)
- Internationalisation (FR only pour l'instant)
- Mode mobile détaillé (breakpoints à spécifier lors de l'impl, structure identique)
