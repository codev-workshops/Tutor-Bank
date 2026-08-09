/**
 * Hybrid routing sends only Subject and TutorSubject operations to this
 * DynamoDB adapter; every other model and every Prisma `$` method delegates
 * to the real Prisma client.
 *
 * Emulated/native differences: Subject ordering is JavaScript sorting rather
 * than PostgreSQL collation; tutor subject order uses a monotonic `seq`
 * rather than physical relation order; subject contains matching uses
 * JavaScript `toLowerCase()` rather than PostgreSQL collation-aware ILIKE;
 * `%` and `_` remain ordinary characters; locale-specific Unicode casing can
 * differ; cross-store relation filtering resolves IDs in DynamoDB but leaves
 * tutor selection/order in PostgreSQL; Dynamo writes inside PostgreSQL
 * transactions are not rolled back; orphan associations are omitted; IDs
 * are hand-rolled cuid-shaped opaque unique values rather than Prisma cuid v2.
 * A duplicate tutorSubject create raises DynamoDB's
 * ConditionalCheckFailedException rather than Prisma P2002; both become a
 * route-level 500 and are not observable here.
 */
/* eslint-disable @typescript-eslint/no-require-imports */
const {
  BatchWriteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
} = require("@aws-sdk/lib-dynamodb");
const { getDynamoClient, tableName } = require("./client.cts");

type SubjectRecord = { id: string; name: string; createdAt: Date };
type Association = { id: string; tutorId: string; subjectId: string; seq: number };
type SubjectSelect = { id?: boolean; name?: boolean };

let sequence = Date.now() * 1000;
const nextSequence = () => ++sequence;

function cuid(): string {
  return `c${Date.now().toString(36)}${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
}

function subjectProjection(item: SubjectRecord, select?: SubjectSelect): Record<string, unknown> {
  if (!select) {
    return {
      id: item.id,
      name: item.name,
      createdAt: item.createdAt instanceof Date
        ? item.createdAt
        : new Date(item.createdAt as unknown as string),
    };
  }
  const result: Record<string, unknown> = {};
  if (select.id) result.id = item.id;
  if (select.name) result.name = item.name;
  return result;
}

class DynamoAdapter {
  private readonly client = getDynamoClient();

  async subjectFindMany(args: { orderBy?: unknown; select?: SubjectSelect }): Promise<Record<string, unknown>[]> {
    const items: SubjectRecord[] = [];
    let ExclusiveStartKey: Record<string, unknown> | undefined;
    do {
      const result = await this.client.send(new ScanCommand({
        TableName: tableName("Subject"),
        ExclusiveStartKey,
      }));
      items.push(...((result.Items ?? []) as SubjectRecord[]));
      ExclusiveStartKey = result.LastEvaluatedKey;
    } while (ExclusiveStartKey);
    items.sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : a.id.localeCompare(b.id));
    return items.map((item) => subjectProjection(item, args.select));
  }

  async subjectUpsert(args: { where: { name: string }; create: { name: string } }): Promise<SubjectRecord> {
    const name = args.where.name;
    const id = cuid();
    const createdAt = new Date();
    try {
      await this.client.send(new PutCommand({
        TableName: tableName("SubjectName"),
        Item: { name, id },
        ConditionExpression: "attribute_not_exists(#name)",
        ExpressionAttributeNames: { "#name": "name" },
      }));
      const item = { id, name, nameLower: name.toLowerCase(), createdAt: createdAt.toISOString() };
      await this.client.send(new PutCommand({ TableName: tableName("Subject"), Item: item }));
      return { id, name, createdAt };
    } catch (error) {
      if ((error as { name?: string }).name !== "ConditionalCheckFailedException") throw error;
      const lock = await this.client.send(new GetCommand({
        TableName: tableName("SubjectName"),
        Key: { name },
        ConsistentRead: true,
      }));
      const existingId = lock.Item?.id as string | undefined;
      if (!existingId) throw error;
      const existing = await this.client.send(new GetCommand({
        TableName: tableName("Subject"),
        Key: { id: existingId },
        ConsistentRead: true,
      }));
      if (!existing.Item) throw new Error(`Subject lock points to missing subject ${existingId}`);
      return this.fromSubjectItem(existing.Item);
    }
  }

  async tutorSubjectCreate(args: { data: { tutorId: string; subjectId: string } }): Promise<Association> {
    const item = {
      id: cuid(),
      tutorId: args.data.tutorId,
      subjectId: args.data.subjectId,
      seq: nextSequence(),
    };
    await this.client.send(new PutCommand({
      TableName: tableName("TutorSubject"),
      Item: item,
      ConditionExpression: "attribute_not_exists(tutorId) AND attribute_not_exists(subjectId)",
    }));
    return item;
  }

  async tutorSubjectDeleteMany(args: { where: { tutorId: string } }): Promise<{ count: number }> {
    const associations = await this.tutorSubjectsForTutor(args.where.tutorId);
    await this.batchDelete(associations.map(({ tutorId, subjectId }) => ({ tutorId, subjectId })));
    return { count: associations.length };
  }

  async tutorSubjectsForTutor(tutorId: string): Promise<Association[]> {
    const result = await this.client.send(new QueryCommand({
      TableName: tableName("TutorSubject"),
      KeyConditionExpression: "tutorId = :tutorId",
      ExpressionAttributeValues: { ":tutorId": tutorId },
      ConsistentRead: true,
    }));
    return (result.Items ?? []) as Association[];
  }

  async tutorsForSubject(subjectId: string): Promise<Association[]> {
    const result = await this.client.send(new QueryCommand({
      TableName: tableName("TutorSubject"),
      IndexName: "subjectId-index",
      KeyConditionExpression: "subjectId = :subjectId",
      ExpressionAttributeValues: { ":subjectId": subjectId },
    }));
    return (result.Items ?? []) as Association[];
  }

  async subjectsMatching(needle: string): Promise<Set<string>> {
    const ids = new Set<string>();
    let ExclusiveStartKey: Record<string, unknown> | undefined;
    do {
      const result = await this.client.send(new ScanCommand({
        TableName: tableName("Subject"),
        FilterExpression: "contains(#nameLower, :needle)",
        ExpressionAttributeNames: { "#nameLower": "nameLower" },
        ExpressionAttributeValues: { ":needle": needle.toLowerCase() },
        ExclusiveStartKey,
      }));
      for (const item of result.Items ?? []) ids.add(item.id as string);
      ExclusiveStartKey = result.LastEvaluatedKey;
    } while (ExclusiveStartKey);
    return ids;
  }

  async enrichTutor(tutorId: string, select?: SubjectSelect): Promise<{ subject: Record<string, unknown> }[]> {
    const associations = (await this.tutorSubjectsForTutor(tutorId))
      .sort((a, b) => a.seq - b.seq || a.id.localeCompare(b.id));
    const subjects = await this.getSubjects(associations.map((association) => association.subjectId));
    return associations.flatMap((association) => {
      const subject = subjects.get(association.subjectId);
      return subject ? [{ subject: subjectProjection(subject, select) }] : [];
    });
  }

  async deleteForTutor(tutorId: string): Promise<{ count: number }> {
    return this.tutorSubjectDeleteMany({ where: { tutorId } });
  }

  async deleteForSubject(subjectId: string): Promise<{ count: number }> {
    const associations = await this.tutorsForSubject(subjectId);
    await this.batchDelete(associations.map(({ tutorId }) => ({ tutorId, subjectId })));
    return { count: associations.length };
  }

  private async getSubjects(ids: string[]): Promise<Map<string, SubjectRecord>> {
    const unique = [...new Set(ids)];
    const records = await Promise.all(unique.map(async (id) => {
      const result = await this.client.send(new GetCommand({
        TableName: tableName("Subject"),
        Key: { id },
        ConsistentRead: true,
      }));
      return result.Item ? [id, this.fromSubjectItem(result.Item)] as const : null;
    }));
    return new Map(records.filter((record): record is readonly [string, SubjectRecord] => !!record));
  }

  private fromSubjectItem(item: Record<string, unknown>): SubjectRecord {
    return { id: item.id as string, name: item.name as string, createdAt: new Date(item.createdAt as string) };
  }

  private async batchDelete(keys: Record<string, string>[]): Promise<void> {
    for (let i = 0; i < keys.length; i += 25) {
      await this.client.send(new BatchWriteCommand({
        RequestItems: {
          [tableName("TutorSubject")]: keys.slice(i, i + 25).map((Key) => ({ DeleteRequest: { Key } })),
        },
      }));
    }
  }
}

module.exports = { DynamoAdapter };
