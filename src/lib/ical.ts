// Minimal RFC 5545 (iCalendar) generator. No external dependencies.

export interface IcsPerson {
  name: string;
  email: string;
}

export interface IcsBooking {
  id: string;
  status: string;
  student: IcsPerson;
  tutor: IcsPerson;
  slot: {
    id: string;
    date: Date | string;
    startTime: Date | string;
    endTime: Date | string;
  };
}

export interface IcsSlot {
  id: string;
  date: Date | string;
  startTime: Date | string;
  endTime: Date | string;
  isBooked: boolean;
}

const PROD_ID = "-//Tutor-Bank//Calendar//EN";

/**
 * Format a date as an iCalendar UTC timestamp: YYYYMMDDTHHMMSSZ.
 */
export function formatIcsDate(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`
  );
}

/**
 * Escape a text value per RFC 5545 (backslash, comma, semicolon, newline).
 */
export function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/**
 * Fold long content lines to a max of 75 octets per RFC 5545.
 */
function foldLine(line: string): string {
  if (line.length <= 75) return line;
  const parts: string[] = [];
  let remaining = line;
  parts.push(remaining.slice(0, 75));
  remaining = remaining.slice(75);
  while (remaining.length > 74) {
    parts.push(" " + remaining.slice(0, 74));
    remaining = remaining.slice(74);
  }
  if (remaining.length > 0) parts.push(" " + remaining);
  return parts.join("\r\n");
}

function bookingIcsStatus(status: string): string {
  switch (status) {
    case "CONFIRMED":
      return "CONFIRMED";
    case "PENDING":
      return "TENTATIVE";
    default:
      // REJECTED, CANCELLED
      return "CANCELLED";
  }
}

interface BuildOptions {
  /** The current user's id, used to decide the "other party" for the summary. */
  userId: string;
  role: string;
  bookings: IcsBooking[];
  /** Optional free/available slots (for tutors). */
  slots?: IcsSlot[];
}

function bookingEvent(booking: IcsBooking, role: string): string[] {
  const otherParty =
    role === "TUTOR" ? booking.student.name : booking.tutor.name;
  const summary = `Tutoring with ${otherParty}`;
  const description =
    `Booking status: ${booking.status}. ` +
    `Student: ${booking.student.name} (${booking.student.email}). ` +
    `Tutor: ${booking.tutor.name} (${booking.tutor.email}).`;

  return [
    "BEGIN:VEVENT",
    `UID:${booking.id}@tutor-bank`,
    `DTSTAMP:${formatIcsDate(new Date())}`,
    `DTSTART:${formatIcsDate(booking.slot.startTime)}`,
    `DTEND:${formatIcsDate(booking.slot.endTime)}`,
    `SUMMARY:${escapeIcsText(summary)}`,
    `DESCRIPTION:${escapeIcsText(description)}`,
    `STATUS:${bookingIcsStatus(booking.status)}`,
    "END:VEVENT",
  ];
}

function slotEvent(slot: IcsSlot): string[] {
  return [
    "BEGIN:VEVENT",
    `UID:slot-${slot.id}@tutor-bank`,
    `DTSTAMP:${formatIcsDate(new Date())}`,
    `DTSTART:${formatIcsDate(slot.startTime)}`,
    `DTEND:${formatIcsDate(slot.endTime)}`,
    `SUMMARY:${escapeIcsText("Available time slot")}`,
    "STATUS:TENTATIVE",
    "TRANSP:TRANSPARENT",
    "END:VEVENT",
  ];
}

/**
 * Build a full VCALENDAR string for a user's bookings and (optionally) slots.
 */
export function buildCalendar({
  role,
  bookings,
  slots,
}: BuildOptions): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${PROD_ID}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Tutor-Bank",
  ];

  for (const booking of bookings) {
    lines.push(...bookingEvent(booking, role));
  }

  if (slots) {
    for (const slot of slots) {
      if (!slot.isBooked) {
        lines.push(...slotEvent(slot));
      }
    }
  }

  lines.push("END:VCALENDAR");

  return lines.map(foldLine).join("\r\n") + "\r\n";
}
