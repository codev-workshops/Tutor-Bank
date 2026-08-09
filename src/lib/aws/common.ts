import { randomBytes } from "node:crypto";

export function cuidShapedId() {
  return `c${Date.now().toString(36)}${randomBytes(12).toString("hex")}`;
}

export function toStoredDate(value: Date | string) {
  return (value instanceof Date ? value : new Date(value)).toISOString();
}

export function fromStoredDate(value: unknown) {
  return value instanceof Date ? value : new Date(value as string);
}

export function scalarDates<T extends Record<string, any>>(item: T): T {
  const result = { ...item };
  for (const key of ["date", "startTime", "endTime", "createdAt", "updatedAt"]) {
    if ((result as any)[key] !== undefined) (result as any)[key] = fromStoredDate((result as any)[key]);
  }
  return result;
}

export function project<T extends Record<string, any>>(value: T, select?: Record<string, boolean>): any {
  if (!select) return value;
  const result: Record<string, unknown> = {};
  for (const [key, enabled] of Object.entries(select)) {
    if (enabled) result[key] = value[key];
  }
  return result;
}

export function unsupported(model: string, operation: string): never {
  throw new Error(`Unsupported in AWS mode: ${model}.${operation} argument shape`);
}

export function prismaNotFound(model: string): Error & { code: string } {
  const error = new Error(`No ${model} record was found for the provided identifier.`);
  Object.assign(error, { code: "P2025", meta: { modelName: model } });
  return error as Error & { code: string };
}

export function prismaUnique(model: string, target: string[]): Error & { code: string } {
  const error = new Error(`Unique constraint failed on the fields: (${target.join(", ")})`);
  Object.assign(error, { code: "P2002", meta: { modelName: model, target } });
  return error as Error & { code: string };
}

export function strictlyAfter(value: string, previous?: string) {
  const next = Date.now();
  const prior = previous ? new Date(previous).getTime() : 0;
  return new Date(Math.max(next, prior + 1)).toISOString();
}
