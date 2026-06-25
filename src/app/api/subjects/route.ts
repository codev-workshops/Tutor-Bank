import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const subjects = await prisma.subject.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });

    return NextResponse.json(subjects);
  } catch (error) {
    console.error("Error fetching subjects:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Subject name is required" },
        { status: 400 }
      );
    }

    const subject = await prisma.subject.upsert({
      where: { name },
      update: {},
      create: { name },
    });

    return NextResponse.json(subject, { status: 201 });
  } catch (error) {
    console.error("Error creating subject:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
