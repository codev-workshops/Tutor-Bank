import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/session";

export async function POST(request: Request) {
  try {
    const user = await requireAuth();
    const body = await request.json();
    const { studentId, tutorId, slotId } = body;

    if (!studentId || !tutorId || !slotId) {
      return NextResponse.json(
        { error: "Missing required fields: studentId, tutorId, slotId" },
        { status: 400 }
      );
    }

    // Use transaction to prevent race condition
    const result = await prisma.$transaction(async (tx: any) => {
      const slot = await tx.timeSlot.findUnique({ where: { id: slotId } });
      if (!slot || slot.isBooked) {
        throw new Error("Slot is not available");
      }

      const booking = await tx.booking.create({
        data: { studentId, tutorId, slotId },
      });

      await tx.timeSlot.update({
        where: { id: slotId },
        data: { isBooked: true },
      });

      // Create notification for the tutor
      await tx.notification.create({
        data: {
          userId: tutorId,
          message: `New booking request for slot on ${slot.date.toLocaleDateString()}`,
        },
      });

      return booking;
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("Error creating booking:", error);
    if (error instanceof Error && error.message === "Slot is not available") {
      return NextResponse.json(
        { error: "Slot is not available" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const role = searchParams.get("role");

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      );
    }

    const bookings = await prisma.booking.findMany({
      where:
        role === "TUTOR" ? { tutorId: userId } : { studentId: userId },
      include: {
        student: { select: { id: true, name: true, email: true } },
        tutor: { select: { id: true, name: true, email: true } },
        slot: { select: { id: true, date: true, startTime: true, endTime: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(bookings);
  } catch (error) {
    console.error("Error fetching bookings:", error);
    if (error instanceof Error) {
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
