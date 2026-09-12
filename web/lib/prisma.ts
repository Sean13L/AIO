import { PrismaClient } from "@prisma/client";

// Standard Next.js dev-mode singleton: without this, every hot-reload of a
// module that imports this file would open a fresh PrismaClient (and a
// fresh pool of DB connections) on top of the last one.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
