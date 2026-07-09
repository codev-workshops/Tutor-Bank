/**
 * @jest-environment node
 */
import {
  buildCalendar,
  formatIcsDate,
  escapeIcsText,
  type IcsBooking,
  type IcsSlot,
} from "@/lib/ical";

const booking: IcsBooking = {
  id: "booking-1",
  status: "CONFIRMED",
  student: { id: "student-1", name: "Alice Student", email: "alice@test.com" },
  tutor: { id: "tutor-1", name: "Bob Tutor", email: "bob@test.com" },
  slot: {
    id: "slot-1",
    date: "2026-07-09T00:00:00.000Z",
    startTime: "2026-07-09T14:30:00.000Z",
    endTime: "2026-07-09T15:30:00.000Z",
  },
};

describe("formatIcsDate", () => {
  it("formats a date as a UTC iCalendar timestamp", () => {
    expect(formatIcsDate("2026-07-09T14:30:00.000Z")).toBe("20260709T143000Z");
  });

  it("zero-pads month, day and time components", () => {
    expect(formatIcsDate("2026-01-05T04:03:02.000Z")).toBe("20260105T040302Z");
  });
});

describe("escapeIcsText", () => {
  it("escapes commas, semicolons, backslashes and newlines", () => {
    expect(escapeIcsText("a, b; c\\d\ne")).toBe("a\\, b\\; c\\\\d\\ne");
  });
});

describe("buildCalendar", () => {
  it("wraps events in a valid VCALENDAR envelope", () => {
    const ics = buildCalendar({
      userId: "student-1",
      role: "STUDENT",
      bookings: [booking],
    });

    expect(ics.startsWith("BEGIN:VCALENDAR")).toBe(true);
    expect(ics.trimEnd().endsWith("END:VCALENDAR")).toBe(true);
    expect(ics).toContain("VERSION:2.0");
    expect(ics).toContain("PRODID:-//Tutor-Bank//Calendar//EN");
    // CRLF line endings per RFC 5545.
    expect(ics).toContain("\r\n");
  });

  it("produces one VEVENT per booking with correct DTSTART/DTEND", () => {
    const ics = buildCalendar({
      userId: "student-1",
      role: "STUDENT",
      bookings: [booking],
    });

    const eventCount = (ics.match(/BEGIN:VEVENT/g) ?? []).length;
    expect(eventCount).toBe(1);
    expect(ics).toContain("UID:booking-1@tutor-bank");
    expect(ics).toContain("DTSTART:20260709T143000Z");
    expect(ics).toContain("DTEND:20260709T153000Z");
    expect(ics).toContain("STATUS:CONFIRMED");
  });

  it("uses the tutor name in the summary for a student", () => {
    const ics = buildCalendar({
      userId: "student-1",
      role: "STUDENT",
      bookings: [booking],
    });
    expect(ics).toContain("SUMMARY:Tutoring with Bob Tutor");
  });

  it("uses the student name in the summary for a tutor", () => {
    const ics = buildCalendar({
      userId: "tutor-1",
      role: "TUTOR",
      bookings: [booking],
    });
    expect(ics).toContain("SUMMARY:Tutoring with Alice Student");
  });

  it("maps PENDING to TENTATIVE and CANCELLED/REJECTED to CANCELLED", () => {
    const pending = buildCalendar({
      userId: "student-1",
      role: "STUDENT",
      bookings: [{ ...booking, status: "PENDING" }],
    });
    expect(pending).toContain("STATUS:TENTATIVE");

    const rejected = buildCalendar({
      userId: "student-1",
      role: "STUDENT",
      bookings: [{ ...booking, status: "REJECTED" }],
    });
    expect(rejected).toContain("STATUS:CANCELLED");
  });

  it("emits one VEVENT per booking for multiple bookings", () => {
    const ics = buildCalendar({
      userId: "student-1",
      role: "STUDENT",
      bookings: [booking, { ...booking, id: "booking-2" }],
    });
    const eventCount = (ics.match(/BEGIN:VEVENT/g) ?? []).length;
    expect(eventCount).toBe(2);
    expect(ics).toContain("UID:booking-2@tutor-bank");
  });

  it("includes only available (not booked) slots as extra events for tutors", () => {
    const slots: IcsSlot[] = [
      {
        id: "slot-free",
        date: "2026-07-10T00:00:00.000Z",
        startTime: "2026-07-10T09:00:00.000Z",
        endTime: "2026-07-10T10:00:00.000Z",
        isBooked: false,
      },
      {
        id: "slot-booked",
        date: "2026-07-11T00:00:00.000Z",
        startTime: "2026-07-11T09:00:00.000Z",
        endTime: "2026-07-11T10:00:00.000Z",
        isBooked: true,
      },
    ];
    const ics = buildCalendar({
      userId: "tutor-1",
      role: "TUTOR",
      bookings: [booking],
      slots,
    });
    expect(ics).toContain("UID:slot-slot-free@tutor-bank");
    expect(ics).not.toContain("UID:slot-slot-booked@tutor-bank");
    expect(ics).toContain("SUMMARY:Available time slot");
  });

  it("folds long content lines to 75 octets", () => {
    const longName = "X".repeat(120);
    const ics = buildCalendar({
      userId: "student-1",
      role: "STUDENT",
      bookings: [
        { ...booking, tutor: { ...booking.tutor, name: longName } },
      ],
    });
    for (const line of ics.split("\r\n")) {
      expect(line.length).toBeLessThanOrEqual(75);
    }
  });
});
