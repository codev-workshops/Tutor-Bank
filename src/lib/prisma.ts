/* eslint-disable @typescript-eslint/no-explicit-any */
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

let hybridPromise: Promise<any> | undefined;
function loadHybrid() {
  hybridPromise ??= import("./aws/hybrid").then(({ createHybridClient }) => createHybridClient(realPrisma));
  return hybridPromise;
}

function createLazyHybrid() {
  const modelProxy = (model: string) =>
    new Proxy(
      {},
      {
        get(_target, operation) {
          return (...args: unknown[]) => loadHybrid().then((hybrid) => hybrid[model][operation](...args));
        },
      },
    );
  return new Proxy(realPrisma as any, {
    get(target, property, receiver) {
      if (["booking", "timeSlot", "user", "notification", "subject", "tutorSubject", "account", "session", "verificationToken"].includes(String(property))) {
        return modelProxy(String(property));
      }
      if (property === "$transaction") {
        return (operation: unknown) => loadHybrid().then((hybrid) => hybrid.$transaction(operation));
      }
      const value = Reflect.get(target, property, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

export const prisma: PrismaClient =
  process.env.DB_MODE === "aws"
    ? (createLazyHybrid() as PrismaClient)
    : realPrisma;

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = realPrisma;

export async function initializeDatabase() {
  if (process.env.DB_MODE === "aws") {
    await (await import("./aws/resources")).initializeResources();
  }
}
