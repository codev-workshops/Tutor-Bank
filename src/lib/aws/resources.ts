export const notificationTableName = () =>
  `${process.env.DYNAMODB_TABLE_PREFIX ?? ""}Notification`;

const indexName = "userId-createdAt-index";

export async function initializeNotificationResources(): Promise<void> {
  // Lazy loading keeps the AWS SDK out of the PostgreSQL-only path.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { CreateTableCommand, DescribeTableCommand } = require("@aws-sdk/client-dynamodb") as typeof import("@aws-sdk/client-dynamodb");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { getDynamoDocumentClient } = require("./dynamo") as typeof import("./dynamo");
  const client = getDynamoDocumentClient();
  try {
    await client.send(new CreateTableCommand({
      TableName: notificationTableName(),
      BillingMode: "PAY_PER_REQUEST",
      AttributeDefinitions: [
        { AttributeName: "id", AttributeType: "S" },
        { AttributeName: "userId", AttributeType: "S" },
        { AttributeName: "createdAt", AttributeType: "N" },
      ],
      KeySchema: [{ AttributeName: "id", KeyType: "HASH" }],
      GlobalSecondaryIndexes: [{
        IndexName: indexName,
        KeySchema: [
          { AttributeName: "userId", KeyType: "HASH" },
          { AttributeName: "createdAt", KeyType: "RANGE" },
        ],
        Projection: { ProjectionType: "ALL" },
      }],
    }));
  } catch (error) {
    if ((error as { name?: string }).name !== "ResourceInUseException") throw error;
  }
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const result = await client.send(new DescribeTableCommand({ TableName: notificationTableName() }));
    if (result.Table?.TableStatus === "ACTIVE") return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Notification DynamoDB table did not become ACTIVE");
}

export { indexName };
