/**
 * Générateur de bookmarklet pour remplir le panier Carrefour dans la session
 * de l'utilisateur.
 *
 * Le bookmarklet s'exécute sur carrefour.fr (clic depuis la barre de favoris),
 * utilise les cookies de session de l'utilisateur, et appelle PATCH /api/cart
 * pour chaque produit. Résultat : le panier est rempli pour l'utilisateur,
 * pas pour notre serveur.
 *
 * Validé par probes/09-bookmarklet-test.mjs.
 */

export interface BookmarkletPayload {
  storeRef: string;
  basketServiceId: string;
  /** Items avec quantité par EAN. Rétrocompat : si eans[] est fourni, quantity=1. */
  items?: Array<{ ean: string; quantity: number }>;
  eans?: string[];
}

/**
 * Génère le code JavaScript du bookmarklet.
 * Note : pageType DOIT être "productdetail" — l'API Carrefour valide cette valeur.
 */
export function generateBookmarklet(payload: BookmarkletPayload): string {
  // Normalise: toujours envoyer `items` au runtime, même si l'appelant donne eans[]
  const items =
    payload.items ??
    (payload.eans ?? []).map((ean) => ({ ean, quantity: 1 }));

  const data = JSON.stringify({
    storeRef: payload.storeRef,
    basketServiceId: payload.basketServiceId,
    items,
  });

  const code = `(async()=>{const D=${data};try{await fetch('/set-store/'+D.storeRef,{headers:{'x-requested-with':'XMLHttpRequest'}});for(const it of D.items){await fetch('/api/cart',{method:'PATCH',headers:{'x-requested-with':'XMLHttpRequest','content-type':'application/json'},body:JSON.stringify({trackingRequest:{pageType:'productdetail',pageId:'productdetail'},items:[{basketServiceId:D.basketServiceId,counter:it.quantity||1,ean:it.ean,subBasketType:'drive_clcv'}]})})}location.href='/cart/driveclcv'}catch(err){alert('Erreur VoixCourses: '+err.message)}})();`;

  return `javascript:${encodeURIComponent(code)}`;
}

/**
 * Version lisible du script — utile pour debug ou afficher à l'utilisateur
 * ce que le bookmarklet va faire.
 */
export function generateReadableScript(payload: BookmarkletPayload): string {
  const items =
    payload.items ??
    (payload.eans ?? []).map((ean) => ({ ean, quantity: 1 }));
  const dataForDisplay = {
    storeRef: payload.storeRef,
    basketServiceId: payload.basketServiceId,
    items,
  };
  return `(async () => {
  const DATA = ${JSON.stringify(dataForDisplay, null, 2)};
  // 1. Sélectionner le même magasin que VoixCourses
  await fetch('/set-store/' + DATA.storeRef, {
    headers: { 'x-requested-with': 'XMLHttpRequest' }
  });
  // 2. Ajouter chaque produit avec sa quantité
  for (const it of DATA.items) {
    await fetch('/api/cart', {
      method: 'PATCH',
      headers: {
        'x-requested-with': 'XMLHttpRequest',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        trackingRequest: { pageType: 'productdetail', pageId: 'productdetail' },
        items: [{
          basketServiceId: DATA.basketServiceId,
          counter: it.quantity || 1,
          ean: it.ean,
          subBasketType: 'drive_clcv'
        }]
      })
    });
  }
  // 3. Rediriger vers le panier Drive
  location.href = '/cart/driveclcv';
})();`;
}
