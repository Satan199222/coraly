/**
 * Cron — Ingestion EPG SFR quotidienne (VoixTV)
 *
 * Schedule Vercel : 0 5 * * * (05:00 UTC ≈ 06:00 Europe/Paris heure d'hiver)
 * Déclenchement manuel : GET /api/cron/ingest-epg
 *   avec header Authorization: Bearer <CRON_SECRET>
 *
 * Flux :
 *  1. Vérification du secret Vercel Cron
 *  2. Pour J+0 à J+6 : fetch + parse l'EPG SFR
 *  3. Récupère les TvChannel en DB (indexed par sfrEpgId)
 *  4. Upsert des TvProgram en DB (par channelId + startAt)
 *  5. Retourne un rapport JSON (chaînes traitées, programmes upsertés, erreurs)
 *
 * GROA-222 — Phase 1b VoixTV
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchSfrEpg } from "@/lib/epg/sfr";
import { TNT_CHANNELS } from "@/lib/tv/tnt-mapping";

/** Ensemble des sfrEpgId TNT à ingérer */
const VALID_SFR_IDS = new Set(TNT_CHANNELS.map((ch) => ch.sfrEpgId));

/** Nombre de jours à stocker (J+0 … J+6) */
const DAYS_AHEAD = 7;

/** Sécurisation du cron : Vercel injecte Authorization: Bearer <CRON_SECRET> */
function isAuthorized(req: NextRequest): boolean {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("[cron/ingest-epg] CRON_SECRET non défini — requête rejetée");
    return false;
  }
  return authHeader === `Bearer ${cronSecret}`;
}

/** Ajoute `n` jours à une date (UTC) */
function addDays(base: Date, n: number): Date {
  const d = new Date(base);
  d.setUTCDate(d.getUTCDate() + n);
  return d;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const runAt = new Date();
  console.info("[cron/ingest-epg] Démarrage ingestion EPG — %s", runAt.toISOString());

  // -- Récupère les TvChannel en DB pour mapper sfrEpgId → channelId ----------
  let dbChannels: { id: string; sfrEpgId: number }[];
  try {
    dbChannels = await prisma.tvChannel.findMany({
      select: { id: true, sfrEpgId: true },
    });
  } catch (err) {
    console.error("[cron/ingest-epg] Impossible de charger les chaînes en DB :", err);
    return NextResponse.json(
      { error: "DB unavailable", detail: String(err) },
      { status: 503 }
    );
  }

  const channelIdBySfrId = new Map(dbChannels.map((ch) => [ch.sfrEpgId, ch.id]));
  console.info("[cron/ingest-epg] %d chaîne(s) TNT trouvée(s) en DB", channelIdBySfrId.size);

  if (channelIdBySfrId.size === 0) {
    console.warn("[cron/ingest-epg] Aucune chaîne en DB — seed manquant ? Abandon.");
    return NextResponse.json(
      { error: "No channels in DB — run seed first" },
      { status: 500 }
    );
  }

  // -- Ingestion pour J+0 … J+6 -----------------------------------------------
  const report: {
    date: string;
    channelsProcessed: number;
    programsUpserted: number;
    errors: string[];
  }[] = [];

  for (let i = 0; i < DAYS_AHEAD; i++) {
    const targetDate = addDays(runAt, i);
    const dateLabel = targetDate.toISOString().substring(0, 10);
    const dayReport = { date: dateLabel, channelsProcessed: 0, programsUpserted: 0, errors: [] as string[] };

    let channelPrograms;
    try {
      channelPrograms = await fetchSfrEpg(targetDate, VALID_SFR_IDS);
    } catch (err) {
      const msg = `Fetch EPG échoué pour ${dateLabel} : ${String(err)}`;
      console.error("[cron/ingest-epg]", msg);
      dayReport.errors.push(msg);
      report.push(dayReport);
      continue;
    }

    for (const { sfrEpgId, programs } of channelPrograms) {
      const channelId = channelIdBySfrId.get(sfrEpgId);
      if (!channelId) {
        console.warn("[cron/ingest-epg] sfrEpgId=%d absent de la DB — ignoré", sfrEpgId);
        continue;
      }

      // Upsert par lots de 50 pour limiter la charge DB.
      // On utilise findFirst + create/update car le client Prisma généré
      // ne connaît pas encore le nouveau @@unique (channelId, startAt)
      // avant la prochaine migration + prisma generate.
      const BATCH = 50;
      for (let offset = 0; offset < programs.length; offset += BATCH) {
        const batch = programs.slice(offset, offset + BATCH);
        try {
          await Promise.all(
            batch.map(async (prog) => {
              const existing = await prisma.tvProgram.findFirst({
                where: { channelId, startAt: prog.startAt },
                select: { id: true },
              });
              if (existing) {
                await prisma.tvProgram.update({
                  where: { id: existing.id },
                  data: {
                    title: prog.title,
                    subtitle: prog.subtitle,
                    genre: prog.genre,
                    synopsis: prog.synopsis,
                    endAt: prog.endAt,
                    imageUrl: prog.imageUrl,
                    season: prog.season,
                    episode: prog.episode,
                    fetchedAt: runAt,
                  },
                });
              } else {
                await prisma.tvProgram.create({
                  data: {
                    channelId,
                    title: prog.title,
                    subtitle: prog.subtitle,
                    genre: prog.genre,
                    synopsis: prog.synopsis,
                    startAt: prog.startAt,
                    endAt: prog.endAt,
                    imageUrl: prog.imageUrl,
                    season: prog.season,
                    episode: prog.episode,
                    fetchedAt: runAt,
                  },
                });
              }
            })
          );
          dayReport.programsUpserted += batch.length;
        } catch (err) {
          const msg = `Upsert batch échoué (channelId=${channelId}, offset=${offset}) : ${String(err)}`;
          console.error("[cron/ingest-epg]", msg);
          dayReport.errors.push(msg);
        }
      }

      dayReport.channelsProcessed++;
    }

    console.info(
      "[cron/ingest-epg] %s — %d chaîne(s), %d programme(s) upsertés, %d erreur(s)",
      dateLabel,
      dayReport.channelsProcessed,
      dayReport.programsUpserted,
      dayReport.errors.length
    );
    report.push(dayReport);
  }

  const totalPrograms = report.reduce((a, d) => a + d.programsUpserted, 0);
  const totalErrors = report.reduce((a, d) => a + d.errors.length, 0);

  console.info(
    "[cron/ingest-epg] Terminé — %d programmes upsertés, %d erreur(s)",
    totalPrograms,
    totalErrors
  );

  return NextResponse.json({
    ok: true,
    ranAt: runAt.toISOString(),
    daysIngested: DAYS_AHEAD,
    totalProgramsUpserted: totalPrograms,
    totalErrors,
    report,
  });
}
