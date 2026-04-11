# API Carrefour.fr — Documentation Reverse Engineering

> VoixCourses — Avril 2026
> Testé et validé le 2026-04-11

## Prérequis : contournement Cloudflare

Carrefour.fr est protégé par **Cloudflare Turnstile**. Les appels HTTP classiques (curl, fetch Node.js) reçoivent un 403.

### Deux méthodes validées

| Méthode | Usage |
|---------|-------|
| **Playwright headless** | `page.evaluate(() => fetch(...))` — le navigateur passe Cloudflare automatiquement. ~287ms/requête, 118 Mo RAM |
| **curl-impersonate** | Binaire curl modifié qui imite le fingerprint TLS de Chrome. Un appel initial sur `/` récupère les cookies `__cf_bm`, puis les appels suivants passent. ~443ms/requête, ~5 Mo RAM |

### Headers obligatoires

```
x-requested-with: XMLHttpRequest   ← CRITIQUE : sans ça, le serveur renvoie du HTML
accept: application/json
referer: https://www.carrefour.fr/
```

---

## Endpoints

### 1. Géolocalisation — Woosmap (tiers)

```
GET https://api.woosmap.com/localities/autocomplete/
  ?key=woos-26fe76aa-ff24-3255-b25b-e1bde7b7a683
  &input={codePostal}
  &components=country:fr
```

Headers : `origin: https://www.carrefour.fr`, `referer: https://www.carrefour.fr/`

**Réponse** : `localities[].location` → `{ lat, lng }`

### 2. Recherche magasins

```
GET /geoloc
  ?lat={lat}&lng={lng}
  &page=1&limit=5
  &postal_code={cp}
  &array_postal_codes[]={cp}
  &modes[]=delivery
  &modes[]=picking
```

**Réponse** : `data.stores[]` →
```json
{
  "ref": "850055",
  "name": "Mondelange",
  "format": "HYPERMARCHES FRANCE",
  "distance": "0.00"
}
```

### 3. Sélection magasin

```
GET /set-store/{storeRef}
```

Sélectionne le magasin actif via cookie de session. **Ne retourne pas** le `basketServiceId` — celui-ci est extrait d'une fiche produit (voir section Panier).

### 4. Recherche produits ★

```
GET /s?q={query}[&page={n}]
```

**C'est l'endpoint principal.** Retourne du JSON:API quand le header `x-requested-with: XMLHttpRequest` est présent.

**Réponse** :
```json
{
  "data": [Product, ...],   // max 30 par page
  "meta": {
    "total": 435,
    "itemsPerPage": 30,
    "totalPage": 15,
    "currentPage": 1,
    "keyword": "yaourt nature",
    "facets": [...],
    "refinedKeywords": [...]
  },
  "links": { ... }
}
```

**Structure Product** :
```json
{
  "type": "product",
  "id": "product-{ean}",
  "attributes": {
    "ean": "3270190021438",
    "title": "Yaourts Nature nature CARREFOUR CLASSIC'",
    "brand": "CARREFOUR CLASSIC'",
    "slug": "yaourts-nature-nature-carrefour-classic",
    "format": "16 pots",
    "packaging": "les 16 pots de 125g",
    "nutriscore": { "value": "A" },
    "categories": [
      { "label": "Crèmerie et Produits laitiers", "slug": "cremerie" },
      { "label": "Yaourts et Fromages blancs", "slug": "yaourts" }
    ],
    "images": { ... },
    "offers": {
      "{ean}": {
        "{offerServiceId}": {
          "attributes": {
            "price": {
              "price": 2.29,
              "perUnit": 1.14,
              "perUnitLabel": "1.14 € / KG",
              "unitOfMeasure": "KG"
            },
            "availability": {
              "purchasable": true
            },
            "promotions": [...],
            "freshness": { "value": 5, "period": "day" }
          }
        }
      }
    }
  }
}
```

### 5. Autocomplétion

```
GET /autocomplete?q={query}
```

**Réponse** : `data.filteredSuggestions[]` →
```json
{
  "category": "Crèmerie et Produits laitiers",
  "text": "yaourt",
  "highlighted": "<em>yaourt</em>",
  "link": "/s?q=yaourt&filters[product.categories.name]=..."
}
```

### 6. Premier créneau disponible

```
GET /api/firstslot?storeId={storeRef}
```

**Réponse** (si créneau dispo) :
```json
{
  "data": {
    "type": "first_slot",
    "attributes": {
      "begDate": "2026-04-13T08:00:00+0200",
      "endDate": "2026-04-13T10:00:00+0200"
    }
  }
}
```

**Pas de créneau** : `[]`

### 7. Panier — Lecture

```
GET /api/cart
```

Pas d'auth requise — lié à la session (cookies `FRONTONE_*`).

**Réponse** :
```json
{
  "cart": {
    "totalAmount": 18.83,
    "totalAmountWithFees": 18.83,
    "totalFees": 8.90,
    "items": [
      {
        "category": "Crèmerie et Produits laitiers",
        "products": [
          {
            "counter": 1,
            "totalItemPrice": 1.91,
            "available": true,
            "product": {
              "type": "product",
              "id": "product-3428273980046",
              "attributes": {
                "ean": "3428273980046",
                "title": "Lait Demi-Ecrémé ... LACTEL",
                "brand": "LACTEL",
                "slug": "...",
                "offerServiceId": "A4CA-151-850055",
                "categories": [...]
              }
            }
          }
        ]
      }
    ]
  },
  "marketplace": { ... },
  "meta": { ... }
}
```

### 8. Panier — Ajout / Modification ★

```
PATCH /api/cart
Content-Type: application/json
```

**Body** :
```json
{
  "trackingRequest": {
    "pageType": "search",
    "pageId": "search"
  },
  "items": [
    {
      "basketServiceId": "A4CA-151-850055",
      "counter": 1,
      "ean": "3252210390014",
      "subBasketType": "drive_clcv"
    }
  ]
}
```

**Champs clés** :
- `basketServiceId` — Identifiant du service panier pour le magasin. Format: `XXXX-NNN-{storeRef}`. Extrait du HTML d'une fiche produit (regex: `/[A-Z0-9]{4}-\d{3}-{storeRef}/`).
- `counter` — Quantité (1 pour ajouter, 0 pour supprimer)
- `ean` — Code-barres EAN13 du produit
- `subBasketType` — Toujours `"drive_clcv"` pour le Drive

**Réponse** : même format que GET /api/cart (le panier complet mis à jour).

---

## Flow complet validé

```
1. Woosmap: code postal → lat/lng
2. GET /geoloc → liste de magasins proches
3. GET /set-store/{ref} → sélectionne le magasin (cookie session)
4. Fiche produit → extraire basketServiceId (regex HTML)
5. GET /s?q={query} → recherche produits (JSON:API avec prix)
6. PATCH /api/cart → ajouter au panier (sans auth!)
7. GET /api/cart → lire le panier complet
8. GET /api/firstslot → premier créneau dispo
9. Redirect vers carrefour.fr/cart → paiement par l'utilisateur
```

**Toutes les étapes 1-8 fonctionnent SANS authentification.**
L'utilisateur ne se connecte qu'au moment du paiement (étape 9) sur le site Carrefour.

## Identifiants et correspondances

| ID | Format | Source | Usage |
|----|--------|--------|-------|
| storeRef | `850055` | GET /geoloc | Identifier un magasin |
| offerServiceId | `0261-150-6` | Réponse search (offers) | Identifier une offre produit |
| basketServiceId | `A4CA-151-850055` | HTML fiche produit | PATCH /api/cart |
| ean | `3252210390014` | Réponse search | Identifier un produit |

## Rate limiting

- Délai recommandé entre requêtes : 300-500ms
- Cookie `__cf_bm` expire en ~30 minutes → refresh via page d'accueil
- ~443ms/requête en moyenne (curl-impersonate)
- Pas de rate limiting agressif observé sur 36 requêtes consécutives

## Limites connues

- **Authentification** : Cloudflare Turnstile explicite sur `moncompte.carrefour.fr` bloque le login automatisé (headless et headed+Xvfb)
- **basketServiceId** : doit être extrait du HTML d'une fiche produit — pas d'API directe
- **Le portail développeur** `developer.fr.carrefour.io` est hors-ligne. `developers.carrefour.it` existe (Italie) mais nécessite un compte
