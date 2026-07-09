import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/session";
import { buildCalendar } from "@/lib/ical";

export async function GET(request: Request) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const role = searchParams.get("role") ?? "STUDENT";

    if (!userId) {
      return Response.json({ error: "userId is required" }, { status: 400 });
    }

    const bookings = await prisma.booking.findMany({
      where: role === "TUTOR" ? { tutorId: userId } : { studentId: userId },
      include: {
        student: { select: { id: true, name: true, email: true } },
        tutor: { select: { id: true, name: true, email: true } },
        slot: {
          select: { id: true, date: true, startTime: true, endTime: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const slots =
      role === "TUTOR"
        ? await prisma.timeSlot.findMany({
            where: { tutorId: userId },
            orderBy: { date: "asc" },
            select: {
              id: true,
              date: true,
              startTime: true,
              endTime: true,
              isBooked: true,
            },
          })
        : undefined;

    const ics = buildCalendar({ userId, role, bookings, slots });

    return new Response(ics, {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": 'attachment; filename="tutor-bank.ics"',
      },
    });
  } catch (error) {
    console.error("Error generating calendar:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
