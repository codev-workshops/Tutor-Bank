import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/session";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const body = await request.json();
    const { status } = body;

    if (!status || !["CONFIRMED", "REJECTED", "CANCELLED"].includes(status)) {
      return NextResponse.json(
        { error: "Invalid status. Must be CONFIRMED, REJECTED, or CANCELLED" },
        { status: 400 }
      );
    }

    const booking = await prisma.booking.update({
      where: { id },
      data: { status },
    });

    // If rejected or cancelled, free up the slot
    if (status === "REJECTED" || status === "CANCELLED") {
      await prisma.timeSlot.update({
        where: { id: booking.slotId },
        data: { isBooked: false },
      });
    }

    // Notify the student about status change
    await prisma.notification.create({
      data: {
        userId: booking.studentId,
        message: `Your booking has been ${status.toLowerCase()}`,
      },
    });

    return NextResponse.json(booking);
  } catch (error) {
    console.error("Error updating booking:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
