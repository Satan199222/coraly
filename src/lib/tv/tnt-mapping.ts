/**
 * Mapping TNT — 18 chaînes de la TNT française
 *
 * Clé  : sfrEpgId  (identifiant chaîne dans l'API SFR EPG)
 * Valeur : { name, tntNumber }
 *
 * Source : spécification GROA-221
 */
export interface TntChannelSeed {
  sfrEpgId: number;
  name: string;
  tntNumber: number;
}

export const TNT_CHANNELS: TntChannelSeed[] = [
  { sfrEpgId: 192,  name: "TF1",              tntNumber: 1  },
  { sfrEpgId: 4,    name: "France 2",          tntNumber: 2  },
  { sfrEpgId: 80,   name: "France 3",          tntNumber: 3  },
  { sfrEpgId: 47,   name: "France 5",          tntNumber: 5  },
  { sfrEpgId: 118,  name: "M6",                tntNumber: 6  },
  { sfrEpgId: 111,  name: "Arte",              tntNumber: 7  },
  { sfrEpgId: 78,   name: "France 4",          tntNumber: 14 },
  { sfrEpgId: 234,  name: "LCP",               tntNumber: 13 },
  { sfrEpgId: 119,  name: "W9",                tntNumber: 11 },
  { sfrEpgId: 195,  name: "TMC",               tntNumber: 10 },
  { sfrEpgId: 446,  name: "TFX",               tntNumber: 12 },
  { sfrEpgId: 482,  name: "Gulli",             tntNumber: 18 },
  { sfrEpgId: 481,  name: "BFM TV",            tntNumber: 15 },
  { sfrEpgId: 226,  name: "CNews",             tntNumber: 16 },
  { sfrEpgId: 112,  name: "LCI",               tntNumber: 26 },
  { sfrEpgId: 2111, name: "franceinfo:",       tntNumber: 27 },
  { sfrEpgId: 458,  name: "CStar",             tntNumber: 17 },
  { sfrEpgId: 1404, name: "TF1 Séries-Films",  tntNumber: 20 },
] as const;

/** Accès rapide par sfrEpgId */
export const TNT_BY_SFR_ID = new Map(
  TNT_CHANNELS.map((ch) => [ch.sfrEpgId, ch]),
);
