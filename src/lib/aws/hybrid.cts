/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-require-imports */
const { DynamoAdapter } = require("./adapter.cts");

type PrismaClient = any;
type AnyRecord = Record<string, any>;

function withoutSubjects(input: AnyRecord | undefined): AnyRecord | undefined {
  if (!input) return input;
  const rest = { ...input };
  delete rest.subjects;
  return rest;
}

function withSubjectFilter(where: AnyRecord | undefined, tutorIds: string[]): AnyRecord {
  return { ...(where ?? {}), id: { in: tutorIds } };
}

function createHybridClient(real: PrismaClient): PrismaClient {
  const dynamo = new DynamoAdapter();
  const user = new Proxy((real as any).user, {
    get(target, property, receiver) {
      if (property === "findMany") return async (args: AnyRecord) => {
      const nested = args.where?.subjects?.some?.subject?.name;
      let where = args.where;
      if (nested) {
        const subjectIds = await dynamo.subjectsMatching(nested.contains);
        const associations = (await Promise.all([...subjectIds].map((id) => dynamo.tutorsForSubject(id)))).flat();
        const tutorIds = [...new Set(associations.map((association) => association.tutorId))];
        if (!tutorIds.length) return [];
        where = withSubjectFilter(withoutSubjects(args.where), tutorIds);
      }
      const select = args.select;
      const rows = await (real as any).user.findMany({
        ...args,
        where,
        select: withoutSubjects(select),
      });
      if (!select?.subjects) return rows;
      return Promise.all(rows.map(async (row: AnyRecord) => ({
        ...row,
        subjects: await dynamo.enrichTutor(row.id, select.subjects.select?.subject?.select),
      })));
      };
      if (property === "findUnique") return async (args: AnyRecord) => {
      const select = args.select;
      const row = await (real as any).user.findUnique({ ...args, select: withoutSubjects(select) });
      if (!row || !select?.subjects) return row;
      return {
        ...row,
        subjects: await dynamo.enrichTutor(row.id, select.subjects.select?.subject?.select),
      };
      };
      const value = Reflect.get(target, property, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });

  return new Proxy(real, {
    get(target, property, receiver) {
      if (property === "subject") {
        return {
          findMany: (args: AnyRecord) => dynamo.subjectFindMany(args as any),
          upsert: (args: AnyRecord) => dynamo.subjectUpsert(args as any),
        };
      }
      if (property === "tutorSubject") {
        return {
          create: (args: AnyRecord) => dynamo.tutorSubjectCreate(args as any),
          deleteMany: (args: AnyRecord) => dynamo.tutorSubjectDeleteMany(args as any),
        };
      }
      if (property === "user") return user;
      const value = Reflect.get(target, property, receiver);
      if (property === "$transaction" && typeof value === "function") {
        return async (callback: unknown, ...rest: unknown[]) => {
          if (typeof callback !== "function") return value.apply(target, [callback, ...rest]);
          return value.call(target, (tx: PrismaClient) => {
            const wrapped = createHybridClient(tx);
            return callback(wrapped);
          }, ...rest);
        };
      }
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

module.exports = { createHybridClient };
