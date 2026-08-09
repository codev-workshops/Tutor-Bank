import { getServerSession } from "next-auth";
import { NextRequest } from "next/server";
import { POST as createBooking } from "@/app/api/bookings/route";
import { PATCH as updateBooking } from "@/app/api/bookings/[id]/route";
import { GET as getNotifications, PATCH as updateNotification } from "@/app/api/notifications/route";
import { initializeDatabase, prisma } from "@/lib/prisma";

const sessionMock = getServerSession as jest.MockedFunction<typeof getServerSession>;

function id(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function user(role: "TUTOR" | "STUDENT") {
  return prisma.user.create({
    data: { id: id(role.toLowerCase()), email: `${id("mail")}@example.com`, name: role, passwordHash: "test", role },
  });
}

describe("Notification parity", () => {
  beforeAll(async () => {
    await initializeDatabase();
    if (process.env.DB_MODE === "aws") await initializeDatabase();
  });

  it("creates the tutor notification from booking POST and returns it through GET", async () => {
    const tutor = await user("TUTOR");
    const student = await user("STUDENT");
    const slot = await prisma.timeSlot.create({
      data: { tutorId: tutor.id, date: new Date("2030-01-01T10:00:00Z"), startTime: new Date("2030-01-01T10:00:00Z"), endTime: new Date("2030-01-01T11:00:00Z") },
    });
    const response = await createBooking(new Request("http://localhost/api/bookings", {
      method: "POST", body: JSON.stringify({ studentId: student.id, tutorId: tutor.id, slotId: slot.id }),
    }));
    expect(response.status).toBe(201);
    const notifications = await getNotifications(new Request(`http://localhost/api/notifications?userId=${tutor.id}`));
    expect(notifications.status).toBe(200);
    expect((await notifications.json())[0]).toMatchObject({ userId: tutor.id, read: false });
  });

  it("orders notifications descending and filters by user", async () => {
    const target = await user("STUDENT");
    const other = await user("STUDENT");
    await prisma.notification.create({ data: { userId: target.id, message: "old", createdAt: new Date("2020-01-01T00:00:00Z") } });
    await prisma.notification.create({ data: { userId: target.id, message: "new", createdAt: new Date("2021-01-01T00:00:00Z") } });
    await prisma.notification.create({ data: { userId: other.id, message: "other", createdAt: new Date("2022-01-01T00:00:00Z") } });
    const response = await getNotifications(new Request(`http://localhost/api/notifications?userId=${target.id}`));
    expect(response.status).toBe(200);
    expect((await response.json()).map((item: { message: string }) => item.message)).toEqual(["new", "old"]);
  });

  it("marks a notification read", async () => {
    const target = await user("STUDENT");
    const notification = await prisma.notification.create({ data: { userId: target.id, message: "read me" } });
    const response = await updateNotification(new Request("http://localhost/api/notifications", {
      method: "PATCH", body: JSON.stringify({ notificationId: notification.id }),
    }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ id: notification.id, read: true });
  });

  it("creates a student notification from booking PATCH", async () => {
    const tutor = await user("TUTOR");
    const student = await user("STUDENT");
    const slot = await prisma.timeSlot.create({
      data: { tutorId: tutor.id, date: new Date("2031-01-01T10:00:00Z"), startTime: new Date("2031-01-01T10:00:00Z"), endTime: new Date("2031-01-01T11:00:00Z") },
    });
    const booking = await prisma.booking.create({ data: { studentId: student.id, tutorId: tutor.id, slotId: slot.id } });
    const response = await updateBooking(new NextRequest("http://localhost/api/bookings/x", {
      method: "PATCH", body: JSON.stringify({ status: "CONFIRMED" }),
    }), { params: Promise.resolve({ id: booking.id }) });
    expect(response.status).toBe(200);
    const notifications = await getNotifications(new Request(`http://localhost/api/notifications?userId=${student.id}`));
    expect((await notifications.json())[0]).toMatchObject({ userId: student.id, message: "Your booking has been confirmed" });
  });

  it("returns exact validation and swallowed-error behavior", async () => {
    expect((await getNotifications(new Request("http://localhost/api/notifications"))).status).toBe(400);
    expect(await (await getNotifications(new Request("http://localhost/api/notifications"))).json()).toEqual({ error: "userId is required" });
    const missing = await updateNotification(new Request("http://localhost/api/notifications", { method: "PATCH", body: "{}" }));
    expect(missing.status).toBe(400);
    expect(await missing.json()).toEqual({ error: "notificationId is required" });
    sessionMock.mockResolvedValueOnce(null as never);
    const unauthenticated = await getNotifications(new Request("http://localhost/api/notifications?userId=missing"));
    expect(unauthenticated.status).toBe(500);
    expect(await unauthenticated.json()).toEqual({ error: "Internal server error" });
    const unknown = await updateNotification(new Request("http://localhost/api/notifications", { method: "PATCH", body: JSON.stringify({ notificationId: id("missing") }) }));
    expect(unknown.status).toBe(500);
    expect(await unknown.json()).toEqual({ error: "Internal server error" });
  });
});
