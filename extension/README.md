# Extension VoixCourses

Extension navigateur qui transfère les listes de courses depuis voixcourses.fr
vers le panier Carrefour dans la session de l'utilisateur.

## Pourquoi cette extension

La session Carrefour est liée aux cookies du navigateur. Pour remplir le panier
de l'utilisateur (pas celui du serveur VoixCourses), il faut exécuter du code
avec ses cookies Carrefour. L'extension fait exactement ça, sans demander de
connexion ni d'identifiants.

## Architecture

```
voixcourses.fr          extension               carrefour.fr
     |                      |                        |
     |--SET_LIST msg------->|                        |
     |                      |--chrome.storage.set--->|
     |                      |--tabs.create()-------->|
     |                                                |
     |                      |<----content script-----|
     |                      |                        |
     |                   [Bouton "Remplir"]          |
     |                      |                        |
     |                      |--PATCH /api/cart------>|
     |                      |--redirect /mon-panier->|
```

## Fichiers

- `manifest.json` — Manifest V3
- `background.js` — Service worker, reçoit les messages de voixcourses.fr
- `content.js` — Injecté sur carrefour.fr, affiche la bannière et remplit le panier
- `voixcourses-marker.js` — Injecté sur voixcourses.fr, marque la présence de l'extension
- `popup.html` + `popup.js` — UI du clic sur l'icône
- `icons/` — Icônes 16/48/128px

## Installation en mode développement

### Chrome / Edge / Brave

1. Aller sur `chrome://extensions/`
2. Activer le "Mode développeur" (toggle en haut à droite)
3. Cliquer "Charger l'extension non empaquetée"
4. Sélectionner le dossier `extension/` de ce projet

L'icône VoixCourses apparaît dans la barre d'outils. Visiter `localhost:3000`
ou `voixcourses.fr` — le marqueur est injecté automatiquement.

### Firefox

1. Aller sur `about:debugging#/runtime/this-firefox`
2. Cliquer "Load Temporary Add-on"
3. Sélectionner le fichier `manifest.json`

Note : Firefox décharge les extensions temporaires au redémarrage.

## Permissions utilisées

- `storage` — stocker la liste en attente entre l'envoi et le clic sur Carrefour
- `tabs` — ouvrir carrefour.fr dans un nouvel onglet après réception de la liste
- `host_permissions: carrefour.fr` — injecter le content script qui affiche la bannière et fait les appels API
- `externally_connectable: voixcourses.fr + localhost` — accepter les messages depuis notre app web uniquement

Aucun accès à l'historique, aux autres sites, aux cookies non-Carrefour, etc.

## Publication

### Chrome Web Store
- Frais d'inscription développeur : 5$ une fois
- URL : https://chrome.google.com/webstore/devconsole
- Packager : `cd extension && zip -r ../voixcourses-extension.zip .`
- Délai review initial : 1-7 jours

### Firefox Add-ons
- Gratuit
- URL : https://addons.mozilla.org/developers/
- Self-hosting possible (signature AMO)

### Edge Add-ons
- Gratuit
- URL : https://partner.microsoft.com/dashboard/microsoftedge

## Tests manuels

1. Installer l'extension en mode dev
2. Aller sur localhost:3000 — vérifier `data-voixcourses-extension` sur `<html>`
3. Faire une commande complète jusqu'à l'étape "Valider ma liste"
4. Cliquer "Envoyer à Carrefour"
5. Un nouvel onglet carrefour.fr s'ouvre avec une bannière VoixCourses
6. Cliquer "Remplir mon panier" dans la bannière
7. Le panier se remplit, redirection vers /mon-panier

## Limitations

- Aucune façon de bypass Cloudflare Turnstile sur la page de login — l'utilisateur doit toujours se connecter manuellement à Carrefour pour payer
- Le panier utilisateur sur un autre magasin peut être affecté par le changement automatique de magasin
