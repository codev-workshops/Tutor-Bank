/* eslint-disable @typescript-eslint/no-explicit-any */
import { getDocumentClient, loadAwsModule } from "./client";
import { timeSlotTableName } from "./resources";
import { fromStoredDate, project, scalarDates, toStoredDate, cuidShapedId, unsupported, prismaNotFound } from "./common";

function command(name: string, input: Record<string, unknown>) {
  const sdk = loadAwsModule("@aws-sdk/lib-dynamodb") as Record<string, new (value: Record<string, unknown>) => unknown>;
  return new sdk[name](input);
}

export function createTimeSlotDelegate() {
  return {
    async findUnique(args: any) {
      if (!args || Object.keys(args).length !== 1 || !args.where || Object.keys(args.where).length !== 1 || !args.where.id) unsupported("timeSlot", "findUnique");
      const result = await getDocumentClient().send(
        command("GetCommand", { TableName: timeSlotTableName(), Key: { id: args.where.id }, ConsistentRead: true }),
      );
      return result.Item ? project(scalarDates(result.Item), args.select) : null;
    },

    async create(args: any) {
      if (!args?.data || Object.keys(args).length !== 1 || Object.keys(args.data).sort().join(",") !== "date,endTime,startTime,tutorId" || !args.data.tutorId || !args.data.date || !args.data.startTime || !args.data.endTime) unsupported("timeSlot", "create");
      const item = {
        id: cuidShapedId(),
        tutorId: args.data.tutorId,
        date: toStoredDate(args.data.date),
        startTime: toStoredDate(args.data.startTime),
        endTime: toStoredDate(args.data.endTime),
        isBooked: false,
        createdAt: new Date().toISOString(),
      };
      await getDocumentClient().send(command("PutCommand", { TableName: timeSlotTableName(), Item: item, ConditionExpression: "attribute_not_exists(id)" }));
      return project(scalarDates(item), args.select);
    },

    async update(args: any) {
      if (!args || Object.keys(args).sort().join(",") !== "data,where" || !args.where?.id || !args.data || Object.keys(args.data).length !== 1 || typeof args.data.isBooked !== "boolean") unsupported("timeSlot", "update");
      const current = await getDocumentClient().send(
        command("GetCommand", { TableName: timeSlotTableName(), Key: { id: args.where.id }, ConsistentRead: true }),
      );
      if (!current.Item) throw prismaNotFound("TimeSlot");
      const item = { ...current.Item, isBooked: args.data.isBooked };
      await getDocumentClient().send(
        command("PutCommand", { TableName: timeSlotTableName(), Item: item, ConditionExpression: "attribute_exists(id)" }),
      );
      return project(scalarDates(item), args.select);
    },

    async findMany(args: any) {
      const where = args?.where;
      if (!args || Object.keys(args).sort().join(",") !== "orderBy,select,where" || !where || !where.tutorId || !where.date?.gte || JSON.stringify(args.orderBy) !== JSON.stringify({ date: "asc" })) unsupported("timeSlot", "findMany");
      const now = fromStoredDate(toStoredDate(where.date.gte));
      const result = await getDocumentClient().send(
        command("QueryCommand", {
          TableName: timeSlotTableName(),
          IndexName: "tutorId-date-index",
          KeyConditionExpression: "tutorId = :tutorId AND #date >= :date",
          ExpressionAttributeNames: { "#date": "date" },
          ExpressionAttributeValues: { ":tutorId": where.tutorId, ":date": toStoredDate(now) },
        }),
      );
      const items = (result.Items ?? []).map(scalarDates).filter((item: any) => {
        if (where.isBooked === undefined) return true;
        return item.isBooked === where.isBooked;
      });
      items.sort((a: any, b: any) => a.date.getTime() - b.date.getTime() || a.id.localeCompare(b.id));
      return items.map((item: any) => project(item, args.select));
    },
  };
}

export function timeSlotWhereForTutor(id: string, args: any) {
  if (!args?.where || !args.where.date?.gte) return undefined;
  return { ...args.where, tutorId: id };
}
