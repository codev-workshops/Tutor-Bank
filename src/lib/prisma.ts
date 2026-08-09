import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { createRequire } from "node:module";

const loadModule = typeof require === "function"
  ? require
  : createRequire(`${process.cwd()}/src/lib/prisma.ts`);
const connectionString = process.env.DATABASE_URL!;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const adapter = new PrismaPg(connectionString);
  return new PrismaClient({ adapter });
}

const realPrisma = globalForPrisma.prisma ?? createPrismaClient();
const prisma = process.env.DB_MODE === "aws"
  ? (loadModule("./aws/hybrid.cts") as {
      createHybridClient: (client: PrismaClient) => PrismaClient;
    }).createHybridClient(realPrisma)
  : realPrisma;
export { prisma };

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export async function initializeDatabase(): Promise<void> {
  if (process.env.DB_MODE !== "aws") return;
  const { initializeResources } = loadModule("./aws/resources.cts") as {
    initializeResources: () => Promise<void>;
  };
  await initializeResources();
}

if (process.env.DB_MODE === "aws") {
  // The adapter module (and AWS SDK) is loaded only in AWS mode.
}
