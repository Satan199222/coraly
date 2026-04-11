# Comparatif Multi-Enseigne — Probes API

> VoixCourses — Testé le 2026-04-11

## Résumé

| Enseigne | Anti-bot | Produits | Prix | Panier | Viabilité MVP |
|----------|---------|----------|------|--------|--------------|
| **Carrefour** | Cloudflare (contournable) | JSON:API complet | Oui, avec magasin | PATCH sans auth | **★★★★★** |
| **Auchan** | Aucun | DOM JS-rendered | Oui (Playwright requis) | JSON API | ★★★☆☆ |
| **Leclerc** | DataDome | Bloqué | Bloqué | Bloqué | ★☆☆☆☆ |
| **Intermarché** | DataDome | Bloqué | Bloqué | Bloqué | ★☆☆☆☆ |
| **Courses U** | Cloudflare (strict) | Bloqué | Bloqué | Bloqué | ★☆☆☆☆ |

---

## Carrefour — ★★★★★ VALIDÉ

**Documentation complète : [CARREFOUR-API.md](./CARREFOUR-API.md)**

### Ce qui fonctionne
- Recherche produits avec prix, dispo, nutriscore, catégories, images
- Autocomplétion
- Géolocalisation magasins
- Ajout panier (PATCH /api/cart) **sans authentification**
- Créneaux livraison
- 36/36 produits testés — 100% succès

### Méthodes d'accès
- **curl-impersonate** (Chrome 116) — léger, 443ms/req
- **Playwright headless** — plus lourd, 287ms/req

### Limites
- Login bloqué par Cloudflare Turnstile (auth page uniquement)
- basketServiceId doit être extrait du HTML produit

---

## Auchan — ★★★☆☆ FAISABLE (Playwright requis)

### Ce qui fonctionne
- **Aucun anti-bot** — pas de Cloudflare, pas de DataDome
- Sélection magasin via Playwright (flow UI : clic "Choisir" → CP → suggestion → "Choisir")
- **Prix visibles** après sélection magasin : prix unitaire, prix/kg, promos, cagnottés
- Cart API JSON fonctionnel (`GET /cart` → JSON avec panier complet)
- Produits dans le DOM avec noms, marques, formats, avis, images

### Sélection magasin
La clé est `POST /journey/update` (form-urlencoded), mais cet endpoint n'est accessible que via le JS frontend (404 en fetch natif). Flow Playwright validé :
```
1. Clic .journey-reminder__initial-choice-button
2. Fill #journey-search → "57360"
3. Clic suggestion "Amnéville 57360"
4. Clic bouton "Choisir" (premier Drive)
→ POST /journey/update avec offeringContext.storeReference=956
```

### Pourquoi Playwright est obligatoire
- Les prix sont **rendus par JavaScript** côté client, pas dans le HTML SSR
- Les cookies de session Playwright transférés en fetch natif → HTML sans prix
- Pas de JSON API pour la recherche (pas de mode XHR/JSON comme Carrefour)
- Pas de JSON-LD ni de données structurées sur les fiches produit

### Architecture
- App SSR + hydratation JS (pas de framework SPA détecté)
- Produits dans `<article class="product-*">` avec `data-id` (UUID)
- URLs produit : `/nom-produit/pr-CXXXXXXX`
- Cart identifié par UUID session
- `api.auchan.fr` existe pour tracking/merchandising

### Comparaison avec Carrefour
| | Carrefour | Auchan |
|-|-----------|--------|
| Données produit | JSON:API structuré | DOM scraping |
| Playwright | Optionnel (curl-impersonate suffit) | Obligatoire |
| RAM proxy | ~5 Mo (curl) | ~120 Mo (Chromium) |
| Fiabilité | Haute (JSON stable) | Moyenne (fragile aux changements CSS) |
| Panier sans auth | Oui | Oui (lecture JSON) |

---

## Leclerc Drive — ★☆☆☆☆ BLOQUÉ

### Protection
- **DataDome** (`captcha-delivery.com`) — anti-bot agressif
- Toute requête XHR retourne un redirect vers le captcha DataDome
- Même Playwright headless ne passe pas

### Note
- URL de recherche : `leclercdrive.fr/magasin-drive/recherche?searchTerm={q}`
- API REST identifiée : `/api/rest/live-search/search?storeId={id}&term={q}` — mais bloquée par DataDome

---

## Intermarché — ★☆☆☆☆ BLOQUÉ

### Protection
- **DataDome** (même fournisseur que Leclerc)
- Comportement identique — redirect captcha sur toute requête XHR

---

## Courses U — ★☆☆☆☆ BLOQUÉ

### Protection
- **Cloudflare** en mode strict
- HTTP 403 sur les requêtes XHR
- Pas de JSON API accessible

---

## Recommandation

**MVP avec Carrefour uniquement.** C'est la seule enseigne qui offre un accès complet et fiable aux données produits et au panier sans authentification.

Pour le multi-enseigne (phase 3+) :
1. **Auchan** en priorité 2 — nécessite plus de reverse engineering sur la sélection magasin
2. **Leclerc/Intermarché** — nécessiterait un service anti-DataDome (BrightData, ZenRows) ou un partenariat
3. **Courses U** — difficile sans partenariat
4. **Partenariats officiels** — l'objectif long terme pour toutes les enseignes
