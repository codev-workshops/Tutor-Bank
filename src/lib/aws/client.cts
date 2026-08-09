/* eslint-disable @typescript-eslint/no-require-imports */
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient } = require("@aws-sdk/lib-dynamodb");

let client: DynamoDBDocumentClient | undefined;

function getDynamoClient(): DynamoDBDocumentClient {
  if (client) return client;

  const base = new DynamoDBClient({});
  // moto can emit duplicate Date headers; never allow NaN into the signer.
  const config = base.config as { systemClockOffset?: number };
  const originalOffset = config.systemClockOffset;
  Object.defineProperty(config, "systemClockOffset", {
    configurable: true,
    get: () => originalOffset,
    set: (value: number) => {
      if (Number.isFinite(value)) {
        Object.defineProperty(config, "systemClockOffset", {
          configurable: true,
          writable: true,
          value,
        });
      }
    },
  });
  client = DynamoDBDocumentClient.from(base);
  return client;
}

const tablePrefix = () => process.env.DYNAMODB_TABLE_PREFIX ?? "";
const tableName = (name: string) => `${tablePrefix()}${name}`;

module.exports = { getDynamoClient, tablePrefix, tableName };
