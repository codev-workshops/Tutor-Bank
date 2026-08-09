/* eslint-disable @typescript-eslint/no-explicit-any */
import { getDynamoClient, loadAwsModule } from "./client";

const ACTIVE = "ACTIVE";

function tablePrefix() {
  return process.env.DYNAMODB_TABLE_PREFIX ?? "";
}

export function timeSlotTableName() {
  return `${tablePrefix()}TimeSlot`;
}

export function bookingTableName() {
  return `${tablePrefix()}Booking`;
}

function command(name: string, input: Record<string, unknown>) {
  const sdk = loadAwsModule("@aws-sdk/client-dynamodb") as Record<string, new (value: Record<string, unknown>) => unknown>;
  return new sdk[name](input);
}

async function describe(name: string): Promise<any | undefined> {
  try {
    return await getDynamoClient().send(command("DescribeTableCommand", { TableName: name }));
  } catch (error: any) {
    if (error?.name === "ResourceNotFoundException") return undefined;
    throw error;
  }
}

async function waitForActive(name: string) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const result = await describe(name);
    if (result?.Table?.TableStatus === ACTIVE) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`DynamoDB table did not become ACTIVE: ${name}`);
}

async function ensureTable(name: string, attributes: Array<Record<string, string>>, keySchema: Array<Record<string, string>>, gsis: Array<Record<string, unknown>>) {
  const current = await describe(name);
  if (!current) {
    try {
      await getDynamoClient().send(
        command("CreateTableCommand", {
          TableName: name,
          AttributeDefinitions: attributes,
          KeySchema: keySchema,
          BillingMode: "PAY_PER_REQUEST",
          GlobalSecondaryIndexes: gsis,
        }),
      );
    } catch (error: any) {
      if (error?.name !== "ResourceInUseException") throw error;
    }
  } else {
    const existing = new Set(
      (current.Table?.GlobalSecondaryIndexes ?? []).map((index: { IndexName?: string }) => index.IndexName),
    );
    const missing = gsis.filter((index) => !existing.has(index.IndexName));
    if (missing.length) {
      await getDynamoClient().send(
        command("UpdateTableCommand", {
          TableName: name,
          AttributeDefinitions: attributes,
          BillingMode: "PAY_PER_REQUEST",
          GlobalSecondaryIndexUpdates: missing.map((GlobalSecondaryIndex) => ({
            Create: GlobalSecondaryIndex,
          })),
        }),
      );
    }
  }
  await waitForActive(name);
}

export async function initializeResources() {
  await ensureTable(
    timeSlotTableName(),
    [
      { AttributeName: "id", AttributeType: "S" },
      { AttributeName: "tutorId", AttributeType: "S" },
      { AttributeName: "date", AttributeType: "S" },
    ],
    [{ AttributeName: "id", KeyType: "HASH" }],
    [
      {
        IndexName: "tutorId-date-index",
        KeySchema: [
          { AttributeName: "tutorId", KeyType: "HASH" },
          { AttributeName: "date", KeyType: "RANGE" },
        ],
        Projection: { ProjectionType: "ALL" },
      },
    ],
  );
  await ensureTable(
    bookingTableName(),
    [
      { AttributeName: "id", AttributeType: "S" },
      { AttributeName: "tutorId", AttributeType: "S" },
      { AttributeName: "studentId", AttributeType: "S" },
      { AttributeName: "createdAt", AttributeType: "S" },
      { AttributeName: "slotId", AttributeType: "S" },
    ],
    [{ AttributeName: "id", KeyType: "HASH" }],
    [
      {
        IndexName: "tutorId-createdAt-index",
        KeySchema: [
          { AttributeName: "tutorId", KeyType: "HASH" },
          { AttributeName: "createdAt", KeyType: "RANGE" },
        ],
        Projection: { ProjectionType: "ALL" },
      },
      {
        IndexName: "studentId-createdAt-index",
        KeySchema: [
          { AttributeName: "studentId", KeyType: "HASH" },
          { AttributeName: "createdAt", KeyType: "RANGE" },
        ],
        Projection: { ProjectionType: "ALL" },
      },
      {
        IndexName: "slotId-index",
        KeySchema: [{ AttributeName: "slotId", KeyType: "HASH" }],
        Projection: { ProjectionType: "ALL" },
      },
    ],
  );
}
