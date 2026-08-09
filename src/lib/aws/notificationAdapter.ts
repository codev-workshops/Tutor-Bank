import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { getDynamoDocumentClient } from "./dynamo";
import { indexName, notificationTableName } from "./resources";

/**
 * Hybrid routing keeps Notification in DynamoDB while other Prisma models stay
 * in PostgreSQL. Cross-store transaction atomicity is not preserved: writes
 * are not rolled back or commit-gated across the two stores.
 */
type Notification = {
  id: string;
  userId: string;
  message: string;
  read: boolean;
  createdAt: Date;
};

type CreateArgs = { data: { userId: string; message: string; read?: boolean; createdAt?: Date; id?: string } };
type FindManyArgs = { where: { userId: string }; orderBy?: { createdAt: "asc" | "desc" } };
type UpdateArgs = { where: { id: string }; data: { read?: boolean; message?: string } };

function compatibleCuid(): string {
  const random = Math.random().toString(36).slice(2, 10);
  return `c${Date.now().toString(36)}${random}`;
}

function itemToNotification(item: Record<string, unknown>): Notification {
  return {
    id: String(item.id),
    userId: String(item.userId),
    message: String(item.message),
    read: Boolean(item.read),
    createdAt: new Date(Number(item.createdAt)),
  };
}

function p2025(id: string): Error & { code: string } {
  const error = new Error(`No Notification found for the provided identifier \`${id}\`.`) as Error & { code: string };
  error.code = "P2025";
  return error;
}

export class NotificationAdapter {
  constructor(private readonly client: DynamoDBDocumentClient = getDynamoDocumentClient()) {}

  async findMany(args: FindManyArgs): Promise<Notification[]> {
    // Lazy loading keeps the AWS SDK command modules out of PostgreSQL mode.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { QueryCommand } = require("@aws-sdk/lib-dynamodb") as typeof import("@aws-sdk/lib-dynamodb");
    const direction = args.orderBy?.createdAt === "asc" ? false : true;
    let items: Record<string, unknown>[] = [];
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const result = await this.client.send(new QueryCommand({
        TableName: notificationTableName(),
        IndexName: indexName,
        KeyConditionExpression: "userId = :userId",
        ExpressionAttributeValues: { ":userId": args.where.userId },
        ScanIndexForward: !direction,
      }));
      items = (result.Items ?? []) as Record<string, unknown>[];
      if (items.length > 0) break;
      await new Promise((resolve) => setTimeout(resolve, 25 * (attempt + 1)));
    }
    return items.map(itemToNotification).sort((a, b) => {
      const dateOrder = b.createdAt.getTime() - a.createdAt.getTime();
      const tieOrder = a.id.localeCompare(b.id);
      return (direction ? dateOrder : -dateOrder) || (direction ? tieOrder : -tieOrder);
    });
  }

  async create(args: CreateArgs): Promise<Notification> {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PutCommand } = require("@aws-sdk/lib-dynamodb") as typeof import("@aws-sdk/lib-dynamodb");
    const notification: Notification = {
      id: args.data.id ?? compatibleCuid(),
      userId: args.data.userId,
      message: args.data.message,
      read: args.data.read ?? false,
      createdAt: args.data.createdAt ?? new Date(),
    };
    await this.client.send(new PutCommand({
      TableName: notificationTableName(),
      Item: { ...notification, createdAt: notification.createdAt.getTime() },
    }));
    return notification;
  }

  async update(args: UpdateArgs): Promise<Notification> {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { GetCommand, UpdateCommand } = require("@aws-sdk/lib-dynamodb") as typeof import("@aws-sdk/lib-dynamodb");
    const existing = await this.client.send(new GetCommand({
      TableName: notificationTableName(),
      Key: { id: args.where.id },
      ConsistentRead: true,
    }));
    if (!existing.Item) throw p2025(args.where.id);
    const values: Record<string, unknown> = {};
    const names: Record<string, string> = {};
    const updates: string[] = [];
    if (args.data.read !== undefined) { names["#read"] = "read"; values[":read"] = args.data.read; updates.push("#read = :read"); }
    if (args.data.message !== undefined) { names["#message"] = "message"; values[":message"] = args.data.message; updates.push("#message = :message"); }
    if (updates.length) {
      await this.client.send(new UpdateCommand({
        TableName: notificationTableName(), Key: { id: args.where.id },
        UpdateExpression: `SET ${updates.join(", ")}`,
        ExpressionAttributeNames: names, ExpressionAttributeValues: values,
      }));
    }
    return itemToNotification({
      ...existing.Item,
      ...(args.data.read === undefined ? {} : { read: args.data.read }),
      ...(args.data.message === undefined ? {} : { message: args.data.message }),
    });
  }
}

export const notificationAdapter = new NotificationAdapter();
