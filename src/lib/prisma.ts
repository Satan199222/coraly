/**
 * Singleton Prisma Client — Neon serverless driver adapter
 *
 * Prisma 7 requiert un Driver Adapter explicite (plus de query engine binaire).
 * On utilise @prisma/adapter-neon + @neondatabase/serverless pour Neon PostgreSQL.
 *
 * - En dev : pool direct via DATABASE_URL
 * - En prod (Vercel) : même pool, Neon gère le pooling via Hyperdrive si activé
 */
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "../generated/prisma/client";

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("[prisma] DATABASE_URL est manquant dans les variables d'environnement");
  }
  // PrismaNeon prend un PoolConfig (pas une instance Pool)
  const adapter = new PrismaNeon({ connectionString });
  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
