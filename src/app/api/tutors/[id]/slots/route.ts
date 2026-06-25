import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { NextRequest } from "next/server";

export async function GET(
  _req: NextRequest,
  ctx: RouteContext<"/api/tutors/[id]/slots">
) {
  try {
    const { id } = await ctx.params;

    const slots = await prisma.timeSlot.findMany({
      where: { tutorId: id, date: { gte: new Date() } },
      orderBy: { date: "asc" },
      select: {
        id: true,
        date: true,
        startTime: true,
        endTime: true,
        isBooked: true,
      },
    });

    return NextResponse.json(slots);
  } catch (error) {
    console.error("Error fetching slots:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  ctx: RouteContext<"/api/tutors/[id]/slots">
) {
  try {
    const { id } = await ctx.params;
    const body = await request.json();
    const { date, startTime, endTime } = body;

    if (!date || !startTime || !endTime) {
      return NextResponse.json(
        { error: "Missing required fields: date, startTime, endTime" },
        { status: 400 }
      );
    }

    const slot = await prisma.timeSlot.create({
      data: {
        tutorId: id,
        date: new Date(date),
        startTime: new Date(startTime),
        endTime: new Date(endTime),
      },
    });

    return NextResponse.json(slot, { status: 201 });
  } catch (error) {
    console.error("Error creating slot:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
