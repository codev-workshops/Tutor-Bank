/**
 * @jest-environment node
 */
import { GET } from "@/app/api/calendar/route";
import { prisma } from "@/lib/prisma";

const mockBooking = {
  id: "booking-1",
  status: "CONFIRMED",
  student: { id: "student-1", name: "Alice", email: "alice@test.com" },
  tutor: { id: "tutor-1", name: "Bob", email: "bob@test.com" },
  slot: {
    id: "slot-1",
    date: new Date("2026-07-09T00:00:00.000Z"),
    startTime: new Date("2026-07-09T14:30:00.000Z"),
    endTime: new Date("2026-07-09T15:30:00.000Z"),
  },
};

describe("GET /api/calendar", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns an ics attachment for a student", async () => {
    (prisma.booking.findMany as jest.Mock).mockResolvedValue([mockBooking]);

    const request = new Request(
      "http://localhost/api/calendar?userId=student-1&role=STUDENT"
    );
    const response = await GET(request);
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe(
      "text/calendar; charset=utf-8"
    );
    expect(response.headers.get("Content-Disposition")).toBe(
      'attachment; filename="tutor-bank.ics"'
    );
    expect(body).toContain("BEGIN:VCALENDAR");
    expect(body).toContain("UID:booking-1@tutor-bank");
  });

  it("includes tutor time slots when role is TUTOR", async () => {
    (prisma.booking.findMany as jest.Mock).mockResolvedValue([mockBooking]);
    (prisma.timeSlot.findMany as jest.Mock).mockResolvedValue([
      {
        id: "slot-free",
        date: new Date("2026-07-10T00:00:00.000Z"),
        startTime: new Date("2026-07-10T09:00:00.000Z"),
        endTime: new Date("2026-07-10T10:00:00.000Z"),
        isBooked: false,
      },
    ]);

    const request = new Request(
      "http://localhost/api/calendar?userId=tutor-1&role=TUTOR"
    );
    const response = await GET(request);
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(prisma.timeSlot.findMany).toHaveBeenCalled();
    expect(body).toContain("UID:slot-slot-free@tutor-bank");
  });

  it("returns 400 when userId is missing", async () => {
    const request = new Request("http://localhost/api/calendar");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("userId is required");
  });

  it("returns 500 when the query fails", async () => {
    (prisma.booking.findMany as jest.Mock).mockRejectedValue(
      new Error("db error")
    );

    const request = new Request(
      "http://localhost/api/calendar?userId=student-1&role=STUDENT"
    );
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Internal server error");
  });
});
