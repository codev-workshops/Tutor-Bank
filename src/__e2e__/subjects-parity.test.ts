import { GET as getSubjects, POST as postSubject } from "@/app/api/subjects/route";
import { GET as getTutors } from "@/app/api/tutors/route";
import { GET as getTutor, PUT as putTutor } from "@/app/api/tutors/[id]/route";
import { prisma } from "@/lib/prisma";

const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const unique = (value: string) => `${value}-${suffix}`;

async function json(response: Response) {
  return response.json();
}

async function createTutor(name: string) {
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

async function subject(name: string) {
  const response = await postSubject(new Request("http://localhost/api/subjects", {
    method: "POST",
    body: JSON.stringify({ name }),
  }));
  expect(response.status).toBe(201);
  return json(response);
}

describe("Subject and TutorSubject Postgres/Dynamo parity", () => {
  it("creates subjects idempotently and orders GET results", async () => {
    const firstName = unique("Alpha");
    const secondName = unique("Zulu");
    const first = await subject(firstName);
    const again = await subject(firstName);
    expect(again).toEqual(first);
    await subject(secondName);
    const response = await getSubjects();
    expect(response.status).toBe(200);
    const rows = await json(response);
    const mine = rows.filter((row: { name: string }) => [firstName, secondName].includes(row.name));
    expect(mine).toEqual([
      { id: first.id, name: first.name },
      { id: expect.any(String), name: secondName },
    ].sort((a, b) => a.name.localeCompare(b.name)));
  });

  it("returns the documented validation error", async () => {
    const response = await postSubject(new Request("http://localhost/api/subjects", {
      method: "POST",
      body: JSON.stringify({}),
    }));
    expect(response.status).toBe(400);
    expect(await json(response)).toEqual({ error: "Subject name is required" });
  });

  it("searches tutors by no filter, name, subject, and both filters", async () => {
    const matching = await createTutor(unique("Searchable Tutor"));
    const other = await createTutor(unique("Other Tutor"));
    const matchingSubject = await subject(unique("Algebra"));
    await putTutor(new Request("http://localhost/api/tutors/" + matching.id, {
      method: "PUT",
      body: JSON.stringify({ subjects: [matchingSubject.name] }),
    }) as any, { params: Promise.resolve({ id: matching.id }) } as any);

    const all = await json(await getTutors(new Request("http://localhost/api/tutors")));
    const mine = all.filter((row: { id: string }) => [matching.id, other.id].includes(row.id));
    expect(mine.map((row: { id: string }) => row.id)).toEqual([matching.id, other.id]);
    expect(mine.find((row: { id: string }) => row.id === other.id).subjects).toEqual([]);

    const byName = await json(await getTutors(new Request("http://localhost/api/tutors?name=SEARCHABLE")));
    expect(byName.map((row: { id: string }) => row.id)).toContain(matching.id);
    const bySubject = await json(await getTutors(new Request(`http://localhost/api/tutors?subject=${encodeURIComponent(matchingSubject.name.toUpperCase())}`)));
    expect(bySubject.map((row: { id: string }) => row.id)).toEqual([matching.id]);
    const both = await json(await getTutors(new Request(`http://localhost/api/tutors?name=searchable&subject=${encodeURIComponent(matchingSubject.name.toLowerCase())}`)));
    expect(both.map((row: { id: string }) => row.id)).toEqual([matching.id]);
  });

  it("replaces a tutor subject list and preserves insertion order", async () => {
    const tutor = await createTutor(unique("Replacement Tutor"));
    const old = await subject(unique("Old Subject"));
    const firstNew = await subject(unique("First New"));
    const secondNew = await subject(unique("Second New"));
    await putTutor(new Request(`http://localhost/api/tutors/${tutor.id}`, {
      method: "PUT",
      body: JSON.stringify({ subjects: [old.name] }),
    }) as any, { params: Promise.resolve({ id: tutor.id }) } as any);
    const response = await putTutor(new Request(`http://localhost/api/tutors/${tutor.id}`, {
      method: "PUT",
      body: JSON.stringify({ subjects: [firstNew.name, secondNew.name] }),
    }) as any, { params: Promise.resolve({ id: tutor.id }) } as any);
    expect(response.status).toBe(200);
    const fetched = await json(await getTutor(new Request("http://localhost/api/tutors/" + tutor.id) as any, {
      params: Promise.resolve({ id: tutor.id }),
    } as any));
    expect(fetched.subjects).toEqual([
      { subject: { id: firstNew.id, name: firstNew.name } },
      { subject: { id: secondNew.id, name: secondNew.name } },
    ]);
    expect(fetched.subjects).not.toContainEqual({ subject: old });
  });

  it("returns the documented tutor not-found response", async () => {
    const response = await getTutor(new Request("http://localhost/api/tutors/unknown") as any, {
      params: Promise.resolve({ id: unique("missing") }),
    } as any);
    expect(response.status).toBe(404);
    expect(await json(response)).toEqual({ error: "Tutor not found" });
  });
});
