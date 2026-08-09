/* eslint-disable @typescript-eslint/no-explicit-any */
import { randomUUID } from "node:crypto";
import { GET as getBookingsHandler, POST as createBookingHandler } from "@/app/api/bookings/route";
import { PATCH as updateBookingHandler } from "@/app/api/bookings/[id]/route";
import { GET as getSlotsHandler, POST as createSlotHandler } from "@/app/api/tutors/[id]/slots/route";
import { GET as getTutorHandler } from "@/app/api/tutors/[id]/route";
import { initializeDatabase, prisma } from "@/lib/prisma";

declare global {
  var __e2eSession: any;
}

const noSession = () => {
  globalThis.__e2eSession = null;
};

const getBookings = getBookingsHandler as any;
const createBooking = createBookingHandler as any;
const updateBooking = updateBookingHandler as any;
const getSlots = getSlotsHandler as any;
const createSlot = createSlotHandler as any;
const getTutor = getTutorHandler as any;

const withSession = (id: string, role: "TUTOR" | "STUDENT") => {
  globalThis.__e2eSession = {
    user: { id, name: role === "TUTOR" ? "Tutor" : "Student", email: `${id}@example.com`, role },
  };
};

async function createUser(role: "TUTOR" | "STUDENT") {
  const id = `c${randomUUID().replaceAll("-", "").slice(0, 24)}`;
  return prisma.user.create({
    data: {
      id,
      email: `${id}@example.com`,
      name: role === "TUTOR" ? "Tutor Name" : "Student Name",
      passwordHash: "not-used",
      role,
    },
  });
}

async function futureSlot(tutorId: string, hours: number) {
  const date = new Date(Date.now() + hours * 60 * 60 * 1000);
  const startTime = new Date(date.getTime() + 60 * 60 * 1000);
  const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);
  withSession(tutorId, "TUTOR");
  const response = await createSlot(
    new Request("http://localhost/api/tutors/slots", {
      method: "POST",
      body: JSON.stringify({ date: date.toISOString(), startTime: startTime.toISOString(), endTime: endTime.toISOString() }),
    }),
    { params: Promise.resolve({ id: tutorId }) } as any,
  );
  expect(response.status).toBe(201);
  return response.json();
}

async function createBookingFor(studentId: string, tutorId: string, slotId: string) {
  withSession(studentId, "STUDENT");
  return createBooking(
    new Request("http://localhost/api/bookings", {
      method: "POST",
      body: JSON.stringify({ studentId, tutorId, slotId }),
    }),
  );
}

const describeE2E = process.env.RUN_E2E === "1" ? describe : describe.skip;

describeE2E("Booking and TimeSlot parity", () => {
  beforeAll(async () => {
    await initializeDatabase();
    await initializeDatabase();
  });

  beforeEach(() => {
    withSession("e2e-session-user", "STUDENT");
  });

  it("creates and lists future slots with the exact projection", async () => {
    const tutor = await createUser("TUTOR");
    const slot = await futureSlot(tutor.id, 48);
    const response = await getSlots(new Request("http://localhost"), { params: Promise.resolve({ id: tutor.id }) } as any);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toContainEqual({
      id: slot.id,
      date: slot.date,
      startTime: slot.startTime,
      endTime: slot.endTime,
      isBooked: false,
    });
    expect(Object.keys(body[0]).sort()).toEqual(["date", "endTime", "id", "isBooked", "startTime"]);
    expect(body).toEqual([...body].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id)));
  });

  it("books a slot, prevents double booking, and exposes booked state in both reads", async () => {
    const tutor = await createUser("TUTOR");
    const student = await createUser("STUDENT");
    const slot = await futureSlot(tutor.id, 72);
    const response = await createBookingFor(student.id, tutor.id, slot.id);
    expect(response.status).toBe(201);
    const booking = await response.json();
    expect(booking).toMatchObject({ studentId: student.id, tutorId: tutor.id, slotId: slot.id, status: "PENDING" });
    expect(booking.id).toMatch(/^c[a-z0-9]+$/);
    expect(new Date(booking.createdAt).toString()).not.toBe("Invalid Date");

    const duplicate = await createBookingFor(student.id, tutor.id, slot.id);
    expect(duplicate.status).toBe(400);
    expect(await duplicate.json()).toEqual({ error: "Slot is not available" });

    const slots = await (await getSlots(new Request("http://localhost"), { params: Promise.resolve({ id: tutor.id }) } as any)).json();
    expect(slots.find((item: any) => item.id === slot.id).isBooked).toBe(true);
    const tutorResponse = await getTutor(new Request("http://localhost"), { params: Promise.resolve({ id: tutor.id }) } as any);
    expect((await tutorResponse.json()).timeSlots.find((item: any) => item.id === slot.id)).toBeUndefined();
  });

  it("returns exact joined booking payloads for tutor and student, newest first", async () => {
    const tutor = await createUser("TUTOR");
    const student = await createUser("STUDENT");
    const firstSlot = await futureSlot(tutor.id, 96);
    const secondSlot = await futureSlot(tutor.id, 120);
    const first = await createBookingFor(student.id, tutor.id, firstSlot.id);
    const second = await createBookingFor(student.id, tutor.id, secondSlot.id);
    const firstBody = await first.json();
    const secondBody = await second.json();
    for (const role of ["TUTOR", "STUDENT"]) {
      const response = await getBookings(new Request(`http://localhost/api/bookings?userId=${role === "TUTOR" ? tutor.id : student.id}&role=${role}`));
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.map((item: any) => item.id)).toEqual([secondBody.id, firstBody.id]);
      expect(body[0]).toMatchObject({
        id: secondBody.id,
        student: { id: student.id, name: "Student Name", email: `${student.id}@example.com` },
        tutor: { id: tutor.id, name: "Tutor Name", email: `${tutor.id}@example.com` },
        slot: { id: secondSlot.id, date: secondSlot.date, startTime: secondSlot.startTime, endTime: secondSlot.endTime },
      });
    }
  });

  it("patches every status and frees only rejected/cancelled slots", async () => {
    const tutor = await createUser("TUTOR");
    const student = await createUser("STUDENT");
    for (const [status, shouldBeBooked] of [["CONFIRMED", true], ["REJECTED", false], ["CANCELLED", false]] as const) {
      const slot = await futureSlot(tutor.id, 144 + Math.random());
      const bookingResponse = await createBookingFor(student.id, tutor.id, slot.id);
      const booking = await bookingResponse.json();
      withSession(tutor.id, "TUTOR");
      const patched = await updateBooking(
        new Request("http://localhost", { method: "PATCH", body: JSON.stringify({ status }) }),
        { params: Promise.resolve({ id: booking.id }) },
      );
      expect(patched.status).toBe(200);
      expect((await patched.json()).status).toBe(status);
      const slots = await (await getSlots(new Request("http://localhost"), { params: Promise.resolve({ id: tutor.id }) } as any)).json();
      expect(slots.find((item: any) => item.id === slot.id).isBooked).toBe(shouldBeBooked);
    }
    const invalid = await updateBooking(new Request("http://localhost", { method: "PATCH", body: JSON.stringify({ status: "PENDING" }) }), { params: Promise.resolve({ id: "missing" }) });
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toEqual({ error: "Invalid status. Must be CONFIRMED, REJECTED, or CANCELLED" });
    const missing = await updateBooking(new Request("http://localhost", { method: "PATCH", body: JSON.stringify({ status: "CONFIRMED" }) }), { params: Promise.resolve({ id: "missing" }) });
    expect(missing.status).toBe(500);
  });

  it("preserves tutor 404, nested future unbooked slots, validation, and auth behavior", async () => {
    const unknown = await getTutor(new Request("http://localhost"), { params: Promise.resolve({ id: "missing" }) } as any);
    expect(unknown.status).toBe(404);
    expect(await unknown.json()).toEqual({ error: "Tutor not found" });
    const tutor = await createUser("TUTOR");
    const future = await futureSlot(tutor.id, 240);
    const response = await getTutor(new Request("http://localhost"), { params: Promise.resolve({ id: tutor.id }) } as any);
    expect((await response.json()).timeSlots).toContainEqual({ id: future.id, date: future.date, startTime: future.startTime, endTime: future.endTime });
    const missingFields = await createBooking(new Request("http://localhost", { method: "POST", body: JSON.stringify({}) }));
    expect(missingFields.status).toBe(400);
    expect(await missingFields.json()).toEqual({ error: "Missing required fields: studentId, tutorId, slotId" });
    noSession();
    const unauthenticated = await createBooking(new Request("http://localhost", { method: "POST", body: JSON.stringify({ studentId: "s", tutorId: "t", slotId: "x" }) }));
    expect(unauthenticated.status).toBe(500);
    expect(await unauthenticated.json()).toEqual({ error: "Internal server error" });
  });
});
