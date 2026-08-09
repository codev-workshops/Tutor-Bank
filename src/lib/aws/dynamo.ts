import type { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

let client: DynamoDBDocumentClient | undefined;

export function getDynamoDocumentClient(): DynamoDBDocumentClient {
  if (!client) {
    // Lazy loading keeps the AWS SDK out of the PostgreSQL-only path.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { DynamoDBClient: Client } = require("@aws-sdk/client-dynamodb") as {
      DynamoDBClient: new (options: Record<string, unknown>) => DynamoDBClient;
    };
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { DynamoDBDocumentClient: DocumentClient } = require("@aws-sdk/lib-dynamodb") as {
      DynamoDBDocumentClient: { from: (client: DynamoDBClient) => DynamoDBDocumentClient };
    };
    client = DocumentClient.from(new Client({}));
  }
  return client;
}
