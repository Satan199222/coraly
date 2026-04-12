# VoixCourses — TODO post-MVP

## 🚀 Extensions produit (à concevoir séparément)

### TODO-1 : Visual Companion (extension dédiée, pas VoixCourses)
Application séparée de VoixCourses — assistant visuel généraliste pour non-voyants.
- Screenshot navigateur / photo smartphone → description par GPT-4o Vision
- Mode "assistant visuel" pour tout site / contexte (pas que Carrefour)
- Positionnement : concurrent direct de Be My AI / Seeing AI / Envision
- Business : freemium (10 descriptions/jour free, illimité 5€/mois)
- Compat WebExtension (Chrome/Firefox) + mobile PWA

### TODO-2 : Call-a-friend pour finaliser commande
Dans VoixCourses : bouton "appeler un proche" en fin de flow pour qu'un humain sighted
gère auth + paiement Carrefour.
- Vidéo 1-to-1 via LiveKit (déjà dispo car ElevenLabs l'utilise)
- Le proche voit le partage d'écran du non-voyant
- Parle via LiveKit room, guide au clavier
- Stack : LiveKit room + agent + panier persisté
- UX : bouton final étape 4 "Je préfère qu'un proche finalise pour moi"

