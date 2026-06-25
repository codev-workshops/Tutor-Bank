import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const subject = searchParams.get("subject");
    const name = searchParams.get("name");

    const tutors = await prisma.user.findMany({
      where: {
        role: "TUTOR",
        ...(name && { name: { contains: name, mode: "insensitive" } }),
        ...(subject && {
          subjects: {
            some: {
              subject: { name: { contains: subject, mode: "insensitive" } },
            },
          },
        }),
      },
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
      },
    });

    return NextResponse.json(tutors);
  } catch (error) {
    console.error("Error fetching tutors:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
