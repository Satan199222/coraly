/**
 * Seed VoixTV — insère les 18 chaînes TNT françaises
 *
 * Usage : npx prisma db seed
 * (configuré dans package.json → "prisma.seed")
 */
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "../src/generated/prisma/client";
import { TNT_CHANNELS } from "../src/lib/tv/tnt-mapping";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("[seed] DATABASE_URL est manquant dans les variables d'environnement");
}

const adapter = new PrismaNeon({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding TV channels (TNT)…");

  for (const ch of TNT_CHANNELS) {
    await prisma.tvChannel.upsert({
      where: { sfrEpgId: ch.sfrEpgId },
      update: { name: ch.name, tntNumber: ch.tntNumber },
      create: {
        sfrEpgId: ch.sfrEpgId,
        name: ch.name,
        tntNumber: ch.tntNumber,
        active: true,
      },
    });
  }

  console.log(`✓ ${TNT_CHANNELS.length} chaînes insérées / mises à jour.`);
}

main()
  .catch((err) => {
    console.error("[seed] Erreur :", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
