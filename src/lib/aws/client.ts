import { createRequire } from "node:module";

/* eslint-disable @typescript-eslint/no-explicit-any */
type DynamoClient = { send(command: unknown): Promise<any> };
type DocumentClient = { send(command: unknown): Promise<any> };

const requireAws = typeof require === "function" ? require : createRequire(import.meta.url);
let dynamoClient: DynamoClient | undefined;
let documentClient: DocumentClient | undefined;

export function loadAwsModule(name: string) {
  return requireAws(name);
}

export function getDynamoClient(): DynamoClient {
  if (!dynamoClient) {
    const { DynamoDBClient } = loadAwsModule("@aws-sdk/client-dynamodb") as {
      DynamoDBClient: new (options: Record<string, never>) => DynamoClient;
    };
    dynamoClient = new DynamoDBClient({});
  }
  return dynamoClient;
}

export function getDocumentClient(): DocumentClient {
  if (!documentClient) {
    const { DynamoDBDocumentClient } = loadAwsModule("@aws-sdk/lib-dynamodb") as {
      DynamoDBDocumentClient: {
        from(client: DynamoClient): DocumentClient;
      };
    };
    documentClient = DynamoDBDocumentClient.from(getDynamoClient());
  }
  return documentClient;
}
