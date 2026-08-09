import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL!;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const adapter = new PrismaPg(connectionString);
  return new PrismaClient({ adapter });
}

const realPrisma = globalForPrisma.prisma ?? createPrismaClient();
const hybridFactory =
  process.env.DB_MODE === "aws"
    ? (await import("./aws/hybrid")).createHybridClient
    : undefined;

export const prisma: PrismaClient =
  process.env.DB_MODE === "aws"
    ? (hybridFactory!(realPrisma) as PrismaClient)
    : realPrisma;

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = realPrisma;

export async function initializeDatabase() {
  if (process.env.DB_MODE === "aws") {
    await (await import("./aws/resources")).initializeResources();
  }
}
