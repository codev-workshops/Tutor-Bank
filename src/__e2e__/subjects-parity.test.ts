import { GET as getSubjects, POST as postSubject } from "@/app/api/subjects/route";
import { GET as getTutors } from "@/app/api/tutors/route";
import { GET as getTutor, PUT as putTutor } from "@/app/api/tutors/[id]/route";
import { prisma } from "@/lib/prisma";

const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const unique = (value: string) => `${value}-${suffix}`;
const tutorKeys = ["id", "name", "email", "bio", "hourlyRate", "subjects"];
const detailKeys = [...tutorKeys, "timeSlots"];

async function json(response: Response): Promise<any> {
  return response.json();
}

async function createTutor(name: string): Promise<any> {
  return (prisma as any).user.create({
    data: {
      email: `${name.toLowerCase().replace(/\s+/g, "-")}-${suffix}@example.com`,
      name,
      passwordHash: "test",
      role: "TUTOR",
      bio: "Parity tutor",
      hourlyRate: 50,
    },
  });
}

async function createSubject(name: string): Promise<any> {
  const response = await postSubject(new Request("http://localhost/api/subjects", {
    method: "POST",
    body: JSON.stringify({ name }),
  }));
  expect(response.status).toBe(201);
  const body = await json(response);
  expect(Object.keys(body)).toEqual(["id", "name", "createdAt"]);
  expect(body.name).toBe(name);
  expect(typeof body.createdAt).toBe("string");
  expect(Number.isNaN(new Date(body.createdAt).getTime())).toBe(false);
  expect(new Date(body.createdAt).toISOString()).toBe(body.createdAt);
  return body;
}

async function updateTutor(id: string, body: Record<string, unknown>) {
  return putTutor(new Request(`http://localhost/api/tutors/${id}`, {
    method: "PUT",
    body: JSON.stringify(body),
  }) as any, { params: Promise.resolve({ id }) } as any);
}

async function fetchTutor(id: string): Promise<any> {
  const response = await getTutor(new Request(`http://localhost/api/tutors/${id}`) as any, {
    params: Promise.resolve({ id }),
  } as any);
  expect(response.status).toBe(200);
  return json(response);
}

function expectTutorShape(tutor: any, expectedSubjects: any[]) {
  expect(Object.keys(tutor)).toEqual(tutorKeys);
  expect(tutor.subjects).toEqual(expectedSubjects);
  for (const association of tutor.subjects) {
    expect(Object.keys(association)).toEqual(["subject"]);
    expect(Object.keys(association.subject)).toEqual(["id", "name"]);
  }
}

describe("Subject and TutorSubject Postgres/Dynamo parity", () => {
  it("returns exact Subject POST shape, idempotency, and ordered GET rows", async () => {
    const firstName = unique("Alpha");
    const secondName = unique("Zulu");
    const first = await createSubject(firstName);
    const again = await createSubject(firstName);
    expect(again).toEqual(first);

    const second = await createSubject(secondName);
    const response = await getSubjects();
    expect(response.status).toBe(200);
    const rows = await json(response);
    const mine = rows.filter((row: { name: string }) => [firstName, secondName].includes(row.name));
    expect(mine).toEqual([
      { id: first.id, name: firstName },
      { id: second.id, name: secondName },
    ]);
    expect(mine.filter((row: { name: string }) => row.name === firstName)).toHaveLength(1);
    for (const row of mine) expect(Object.keys(row)).toEqual(["id", "name"]);
  });

  it("returns exact tutor list keys and covers all case-insensitive search branches", async () => {
    const matching = await createTutor(unique("Searchable"));
    const other = await createTutor(unique("Other Tutor"));
    const matchingSubject = await createSubject(unique("Algebra"));
    const unassignedSubject = await createSubject(unique("Geometry"));
    await updateTutor(matching.id, { subjects: [matchingSubject.name] });

    const all = await json(await getTutors(new Request("http://localhost/api/tutors")));
    const mine = all.filter((row: { id: string }) => [matching.id, other.id].includes(row.id));
    expect(mine.map((row: { id: string }) => row.id)).toEqual([matching.id, other.id]);
    expectTutorShape(mine[0], [{ subject: { id: matchingSubject.id, name: matchingSubject.name } }]);
    expectTutorShape(mine[1], []);

    const nameNeedles = [
      matching.name.toUpperCase(),
      matching.name.toLowerCase(),
      `archable-${suffix}`,
    ];
    for (const needle of nameNeedles) {
      const body = await json(await getTutors(new Request(
        `http://localhost/api/tutors?name=${encodeURIComponent(needle)}`,
      )));
      expect(body.map((row: { id: string }) => row.id)).toEqual([matching.id]);
    }

    const subjectNeedles = [
      matchingSubject.name.toUpperCase(),
      matchingSubject.name.toLowerCase(),
      matchingSubject.name.slice(2).toLowerCase(),
    ];
    for (const needle of subjectNeedles) {
      const body = await json(await getTutors(new Request(
        `http://localhost/api/tutors?subject=${encodeURIComponent(needle)}`,
      )));
      expect(body.map((row: { id: string }) => row.id)).toEqual([matching.id]);
    }

    const both = await json(await getTutors(new Request(
      `http://localhost/api/tutors?name=search&subject=${encodeURIComponent(matchingSubject.name.toLowerCase())}`,
    )));
    expect(both.map((row: { id: string }) => row.id)).toEqual([matching.id]);

    const zeroSubject = await json(await getTutors(new Request(
      `http://localhost/api/tutors?subject=${encodeURIComponent(matchingSubject.name)}`,
    )));
    expect(zeroSubject.map((row: { id: string }) => row.id)).not.toContain(other.id);

    const noTutors = await json(await getTutors(new Request(
      `http://localhost/api/tutors?subject=${encodeURIComponent(unassignedSubject.name)}`,
    )));
    expect(noTutors).toEqual([]);
  });

  it("preserves select and nested key order in tutor detail responses", async () => {
    const tutor = await createTutor(unique("Detail Tutor"));
    const detail = await fetchTutor(tutor.id);
    expect(Object.keys(detail)).toEqual(detailKeys);
    expect(detail.subjects).toEqual([]);
    expect(detail.timeSlots).toEqual([]);
  });

  it("replaces, preserves, and clears tutor associations through every PUT branch", async () => {
    const tutor = await createTutor(unique("Replacement Tutor"));
    const old = await createSubject(unique("Old Subject"));
    const firstNew = await createSubject(unique("First New"));
    const secondNew = await createSubject(unique("Second New"));

    let response = await updateTutor(tutor.id, { subjects: [old.name] });
    expect(response.status).toBe(200);
    response = await updateTutor(tutor.id, { subjects: [firstNew.name, secondNew.name] });
    expect(response.status).toBe(200);

    let fetched = await fetchTutor(tutor.id);
    expect(fetched.subjects).toEqual([
      { subject: { id: firstNew.id, name: firstNew.name } },
      { subject: { id: secondNew.id, name: secondNew.name } },
    ]);
    expect(fetched.subjects.map((row: any) => row.subject.id)).not.toContain(old.id);

    response = await updateTutor(tutor.id, { bio: "No subject change" });
    expect(response.status).toBe(200);
    fetched = await fetchTutor(tutor.id);
    expect(fetched.subjects.map((row: any) => row.subject.id)).toEqual([firstNew.id, secondNew.id]);

    response = await updateTutor(tutor.id, { subjects: [] });
    expect(response.status).toBe(200);
    fetched = await fetchTutor(tutor.id);
    expect(fetched.subjects).toEqual([]);
  });

  it("returns the documented validation and not-found bodies", async () => {
    const invalid = await postSubject(new Request("http://localhost/api/subjects", {
      method: "POST",
      body: JSON.stringify({}),
    }));
    expect(invalid.status).toBe(400);
    expect(await json(invalid)).toEqual({ error: "Subject name is required" });

    const missing = await getTutor(new Request("http://localhost/api/tutors/unknown") as any, {
      params: Promise.resolve({ id: unique("missing") }),
    } as any);
    expect(missing.status).toBe(404);
    expect(await json(missing)).toEqual({ error: "Tutor not found" });
  });
});
