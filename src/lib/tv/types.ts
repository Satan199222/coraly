/**
 * Types VoixTV — dérivés du schéma Prisma (TvChannel + TvProgram)
 *
 * Utiliser ces types côté client/composants React.
 * Côté serveur (API routes), utiliser directement les types Prisma générés.
 */

export interface TvChannelDto {
  id: string;
  sfrEpgId: number;
  name: string;
  tntNumber: number;
  logoUrl: string | null;
  active: boolean;
}

export interface TvProgramDto {
  id: string;
  channelId: string;
  title: string;
  subtitle: string | null;
  genre: string | null;
  synopsis: string | null;
  startAt: string; // ISO 8601
  endAt: string;   // ISO 8601
  imageUrl: string | null;
  season: number | null;
  episode: number | null;
  fetchedAt: string; // ISO 8601
}

/** Programme enrichi avec les infos de sa chaîne (pour l'affichage) */
export interface TvProgramWithChannel extends TvProgramDto {
  channel: TvChannelDto;
}
