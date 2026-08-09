/* eslint-disable @typescript-eslint/no-require-imports */
const {
  CreateTableCommand,
  DescribeTableCommand,
  ResourceInUseException,
  waitUntilTableExists,
} = require("@aws-sdk/client-dynamodb");
const { getDynamoClient, tableName } = require("./client.cts");

async function createTable(input: ConstructorParameters<typeof CreateTableCommand>[0]) {
  const client = getDynamoClient();
  try {
    await client.send(new CreateTableCommand(input));
  } catch (error) {
    if (!(error instanceof ResourceInUseException) && (error as { name?: string }).name !== "ResourceInUseException") {
      throw error;
    }
  }
  await waitUntilTableExists({ client, maxWaitTime: 60 }, { TableName: input.TableName });
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const description = await client.send(new DescribeTableCommand({ TableName: input.TableName }));
    if (description.Table?.TableStatus === "ACTIVE") return;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`Timed out waiting for ${input.TableName} to become ACTIVE`);
}

async function initializeResources(): Promise<void> {
  await createTable({
    TableName: tableName("Subject"),
    BillingMode: "PAY_PER_REQUEST",
    AttributeDefinitions: [{ AttributeName: "id", AttributeType: "S" }],
    KeySchema: [{ AttributeName: "id", KeyType: "HASH" }],
  });
  await createTable({
    TableName: tableName("SubjectName"),
    BillingMode: "PAY_PER_REQUEST",
    AttributeDefinitions: [{ AttributeName: "name", AttributeType: "S" }],
    KeySchema: [{ AttributeName: "name", KeyType: "HASH" }],
  });
  await createTable({
    TableName: tableName("TutorSubject"),
    BillingMode: "PAY_PER_REQUEST",
    AttributeDefinitions: [
      { AttributeName: "tutorId", AttributeType: "S" },
      { AttributeName: "subjectId", AttributeType: "S" },
    ],
    KeySchema: [
      { AttributeName: "tutorId", KeyType: "HASH" },
      { AttributeName: "subjectId", KeyType: "RANGE" },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: "subjectId-index",
        KeySchema: [{ AttributeName: "subjectId", KeyType: "HASH" }],
        Projection: { ProjectionType: "ALL" },
      },
    ],
  });
}

module.exports = { initializeResources };
