/* eslint-disable @typescript-eslint/no-explicit-any */
/*
 * Only Booking and TimeSlot are on DynamoDB. Every other model and helper is
 * delegated to the real Prisma client. Emulated-vs-native differences include
 * adapter-generated cuid-shaped IDs, ISO date strings at rest, non-atomic
 * slot uniqueness checks, eventual GSI reads with retries, in-memory ordering
 * tie-breaks, cross-store non-atomic transactions, and inner-join filtering
 * for required booking relations. The existing PATCH remains non-transactional.
 */
import { createBookingDelegate } from "./booking";
import { createTimeSlotDelegate } from "./timeSlot";

function withoutTimeSlots(args: any) {
  if (!args?.select?.timeSlots && !args?.include?.timeSlots) return undefined;
  const copy = { ...args };
  if (copy.select) {
    copy.select = { ...copy.select };
    delete copy.select.timeSlots;
  }
  if (copy.include) {
    copy.include = { ...copy.include };
    delete copy.include.timeSlots;
  }
  return copy;
}

export function createHybridClient(real: any) {
  const timeSlot = createTimeSlotDelegate();
  const booking = createBookingDelegate(real, timeSlot);

  const user = {
    ...real.user,
    async findUnique(args: any) {
      const stripped = withoutTimeSlots(args);
      if (!stripped) return real.user.findUnique(args);
      const result = await real.user.findUnique(stripped);
      if (!result) return null;
      const relation = args.select?.timeSlots ?? args.include?.timeSlots;
      const slots = await timeSlot.findMany({
        where: { ...(relation.where ?? {}), tutorId: result.id },
        orderBy: relation.orderBy,
        select: relation.select,
      });
      return { ...result, timeSlots: slots };
    },
  };

  const hybrid: any = new Proxy(real, {
    get(target, property, receiver) {
      if (property === "booking") return booking;
      if (property === "timeSlot") return timeSlot;
      if (property === "user") return user;
      if (property === "$transaction") {
        return async (operation: any) => {
          if (typeof operation === "function") return operation(hybrid);
          return real.$transaction(operation);
        };
      }
      const value = Reflect.get(target, property, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  return hybrid;
}
