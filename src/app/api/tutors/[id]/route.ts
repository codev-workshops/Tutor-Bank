import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { NextRequest } from "next/server";

export async function GET(
  _req: NextRequest,
  ctx: RouteContext<"/api/tutors/[id]">
) {
  try {
    const { id } = await ctx.params;

    const tutor = await prisma.user.findUnique({
      where: { id, role: "TUTOR" },
      select: {
        id: true,
        name: true,
        email: true,
        bio: true,
        hourlyRate: true,
        subjects: {
          select: {
            subject: { select: { id: true, name: true } },
          },
        },
        timeSlots: {
          where: { isBooked: false, date: { gte: new Date() } },
          orderBy: { date: "asc" },
          select: {
            id: true,
            date: true,
            startTime: true,
            endTime: true,
          },
        },
      },
    });

    if (!tutor) {
      return NextResponse.json({ error: "Tutor not found" }, { status: 404 });
    }

    return NextResponse.json(tutor);
  } catch (error) {
    console.error("Error fetching tutor:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  ctx: RouteContext<"/api/tutors/[id]">
) {
  try {
    const { id } = await ctx.params;
    const body = await request.json();
    const { name, bio, hourlyRate, subjects } = body;

    const tutor = await prisma.user.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(bio !== undefined && { bio }),
        ...(hourlyRate !== undefined && { hourlyRate }),
      },
    });

    if (subjects && Array.isArray(subjects)) {
      await prisma.tutorSubject.deleteMany({ where: { tutorId: id } });

      for (const subjectName of subjects) {
        const subject = await prisma.subject.upsert({
          where: { name: subjectName },
          update: {},
          create: { name: subjectName },
        });
        await prisma.tutorSubject.create({
          data: { tutorId: id, subjectId: subject.id },
        });
      }
    }

    return NextResponse.json(tutor);
  } catch (error) {
    console.error("Error updating tutor:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
