import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { initializeNotificationResources } from "@/lib/aws/resources";

const connectionString = process.env.DATABASE_URL!;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const adapter = new PrismaPg(connectionString);
  return new PrismaClient({ adapter });
}

const realPrisma = globalForPrisma.prisma ?? createPrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = realPrisma;
const hybridPrisma = process.env.DB_MODE === "aws" ? new Proxy(realPrisma as object, {
  get(target, property, receiver) {
    if (property === "notification") {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { notificationAdapter } = require("@/lib/aws/notificationAdapter") as typeof import("@/lib/aws/notificationAdapter");
      return notificationAdapter;
    }
    if (property === "$transaction") {
      return async (callback: (tx: unknown) => unknown) => (target as { $transaction: (cb: (tx: unknown) => unknown) => unknown }).$transaction(async (tx) => {
        const txProxy = new Proxy(tx as object, {
          get(transactionTarget, transactionProperty, transactionReceiver) {
            if (transactionProperty === "notification") {
              // eslint-disable-next-line @typescript-eslint/no-require-imports
              const { notificationAdapter } = require("@/lib/aws/notificationAdapter") as typeof import("@/lib/aws/notificationAdapter");
              return notificationAdapter;
            }
            return Reflect.get(transactionTarget, transactionProperty, transactionReceiver);
          },
        });
        return callback(txProxy);
      });
    }
    const value = Reflect.get(target, property, receiver);
    return typeof value === "function" ? value.bind(target) : value;
  },
}) : realPrisma;

export const prisma: PrismaClient = hybridPrisma as PrismaClient;

export async function initializeDatabase(): Promise<void> {
  if (process.env.DB_MODE === "aws") {
    await initializeNotificationResources();
    return;
  }
  return;
}
