/* eslint-disable @typescript-eslint/no-explicit-any */
import { getDocumentClient, loadAwsModule } from "./client";
import { bookingTableName } from "./resources";
import { cuidShapedId, prismaNotFound, prismaUnique, project, scalarDates, strictlyAfter, toStoredDate, unsupported } from "./common";

function command(name: string, input: Record<string, unknown>) {
  const sdk = loadAwsModule("@aws-sdk/lib-dynamodb") as Record<string, new (value: Record<string, unknown>) => unknown>;
  return new sdk[name](input);
}

const bookingInclude = {
  student: { select: { id: true, name: true, email: true } },
  tutor: { select: { id: true, name: true, email: true } },
  slot: { select: { id: true, date: true, startTime: true, endTime: true } },
};

async function getById(id: string) {
  const result = await getDocumentClient().send(
    command("GetCommand", { TableName: bookingTableName(), Key: { id }, ConsistentRead: true }),
  );
  return result.Item ? scalarDates(result.Item) : null;
}

async function queryByIndex(indexName: string, keyName: string, keyValue: string) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const result = await getDocumentClient().send(
      command("QueryCommand", {
        TableName: bookingTableName(),
        IndexName: indexName,
        KeyConditionExpression: "#key = :value",
        ExpressionAttributeNames: { "#key": keyName },
        ExpressionAttributeValues: { ":value": keyValue },
      }),
    );
    const items = [];
    for (const item of result.Items ?? []) {
      const current = await getById(item.id);
      if (current) items.push(current);
    }
    if (items.length || attempt === 2) return items;
  }
  return [];
}

export function createBookingDelegate(real: any, timeSlot: any) {
  return {
    async create(args: any) {
      if (!args?.data || Object.keys(args).length !== 1 || Object.keys(args.data).sort().join(",") !== "slotId,studentId,tutorId") unsupported("booking", "create");
      const duplicate = await queryByIndex("slotId-index", "slotId", args.data.slotId);
      if (duplicate.length) throw prismaUnique("Booking", ["slotId"]);
      const now = new Date().toISOString();
      const item = {
        id: cuidShapedId(),
        studentId: args.data.studentId,
        tutorId: args.data.tutorId,
        slotId: args.data.slotId,
        status: "PENDING",
        createdAt: now,
        updatedAt: now,
      };
      await getDocumentClient().send(command("PutCommand", { TableName: bookingTableName(), Item: item, ConditionExpression: "attribute_not_exists(id)" }));
      return scalarDates(item);
    },

    async update(args: any) {
      if (!args || Object.keys(args).sort().join(",") !== "data,where" || !args.where?.id || !args.data || Object.keys(args.data).length !== 1 || !["CONFIRMED", "REJECTED", "CANCELLED"].includes(args.data.status)) unsupported("booking", "update");
      const current = await getById(args.where.id);
      if (!current) throw prismaNotFound("Booking");
      const updatedAt = strictlyAfter(toStoredDate(current.updatedAt));
      const item = { ...current, status: args.data.status, updatedAt };
      const storedItem = { ...item };
      for (const key of ["createdAt", "updatedAt"]) {
        storedItem[key] = toStoredDate(item[key]);
      }
      await getDocumentClient().send(command("PutCommand", { TableName: bookingTableName(), Item: storedItem, ConditionExpression: "attribute_exists(id)" }));
      return scalarDates(item);
    },

    async findMany(args: any) {
      if (!args || Object.keys(args).sort().join(",") !== "include,orderBy,where" || !args.where || !args.include || JSON.stringify(args.include) !== JSON.stringify(bookingInclude) || JSON.stringify(args.orderBy) !== JSON.stringify({ createdAt: "desc" })) unsupported("booking", "findMany");
      const key = args.where.tutorId ? ["tutorId-createdAt-index", "tutorId", args.where.tutorId] : args.where.studentId ? ["studentId-createdAt-index", "studentId", args.where.studentId] : undefined;
      if (!key) unsupported("booking", "findMany");
      const rows = await queryByIndex(key[0], key[1], key[2]);
      rows.sort((a: any, b: any) => b.createdAt.getTime() - a.createdAt.getTime() || a.id.localeCompare(b.id));
      const ids = [...new Set(rows.flatMap((row: any) => [row.studentId, row.tutorId]))];
      const users = ids.length
        ? await real.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, email: true } })
        : [];
      const byId = new Map(users.map((user: any) => [user.id, user]));
      const output = [];
      for (const row of rows) {
        const student = byId.get(row.studentId);
        const tutor = byId.get(row.tutorId);
        const slot = await timeSlot.findUnique({ where: { id: row.slotId } });
        if (!student || !tutor || !slot) continue;
        output.push({
          ...row,
          student,
          tutor,
          slot: project(slot, bookingInclude.slot.select),
        });
      }
      return output;
    },
  };
}
