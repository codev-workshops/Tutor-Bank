# AWS Subject migration checklist

## Scope and selector

Only `Subject` and `TutorSubject` are stored in DynamoDB when `DB_MODE=aws`.
`DB_MODE` unset or `postgres` uses the existing Prisma/Postgres path. `User`,
`TimeSlot`, `Booking`, `Notification`, and NextAuth models remain in Postgres.
The hybrid Prisma-shaped client delegates all non-migrated models and Prisma
client methods to the real client.

There are no authentication branches in this slice: these routes do not call
`getServerSession`, and middleware does not match `/api/subjects` or
`/api/tutors` (apart from `/api/tutors/:id*/slots`). Therefore 401/403 parity is
N/A; the suite covers the 400 and 404 branches.

## Finite Prisma call inventory

The following calls are the complete migration surface, including exact
argument shapes:

* `prisma.subject.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } })`
* `prisma.subject.upsert({ where: { name }, update: {}, create: { name } })`
* `prisma.user.findMany({ where: { role: "TUTOR", ...(name && { name: { contains: name, mode: "insensitive" } }), ...(subject && { subjects: { some: { subject: { name: { contains: subject, mode: "insensitive" } } } } }) }, select: { id: true, name: true, email: true, bio: true, hourlyRate: true, subjects: { select: { subject: { select: { id: true, name: true } } } } } })`
* `prisma.user.findUnique({ where: { id, role: "TUTOR" }, select: { id: true, name: true, email: true, bio: true, hourlyRate: true, subjects: { select: { subject: { select: { id: true, name: true } } } }, timeSlots: { where: { isBooked: false, date: { gte: new Date() } }, orderBy: { date: "asc" }, select: { id: true, date: true, startTime: true, endTime: true } } } })`
* `prisma.user.update({ where: { id }, data: { ...(name && { name }), ...(bio !== undefined && { bio }), ...(hourlyRate !== undefined && { hourlyRate }) } })`
* `prisma.tutorSubject.deleteMany({ where: { tutorId: id } })`
* `prisma.subject.upsert({ where: { name: subjectName }, update: {}, create: { name: subjectName } })` (inside the PUT loop)
* `prisma.tutorSubject.create({ data: { tutorId: id, subjectId: subject.id } })` (inside the PUT loop)

The PUT operation intentionally remains non-transactional: update User, delete
existing associations, then upsert and create each requested association.

## DynamoDB tables

All names are `${DYNAMODB_TABLE_PREFIX}<base name>`; the default prefix is
empty. `Subject` uses `id` (string) as the partition key and stores `name`,
`nameLower`, and ISO `createdAt`. `SubjectName` uses `name` as its partition
key and stores `id`; conditional `PutItem` makes name upsert race-safe.
`TutorSubject` uses `tutorId` (string) as partition key and `subjectId`
(string) as sort key, plus `id` (cuid) and monotonic numeric `seq`. Its
`subjectId-index` GSI has `subjectId` as partition key for subject cascades.

Subject upsert first conditionally creates the name lock, then writes the
subject item. A conditional conflict consistently reads the lock and subject.
No GSI is used for subject name uniqueness.

`deleteMany({ where: { tutorId } })` queries then batch-deletes matching
associations and returns the deleted count. User deletion cascades query and
batch-delete by tutor; Subject deletion queries the GSI and batch-deletes
matching associations. These helpers are implemented even though no in-scope
route invokes deletes.

## Emulated versus native behavior

| Concern | Dynamo adapter behavior | Native Postgres behavior / limitation |
| --- | --- | --- |
| Subject ordering | Scan and JavaScript-sort by `name`, then `id` | SQL collation can order case/punctuation differently; parity names use agreeing values |
| Tutor subject order | Store increasing `seq`; sort by `seq`, then `id` | Physical relation order is not a documented guarantee; deterministic insertion order is reproduced |
| Subject `contains` | `nameLower` and JavaScript `toLowerCase()` substring matching | Prisma insensitive mode uses PostgreSQL `ILIKE`/`lower()` under database collation |
| `%` and `_` | Ordinary substring characters | Prisma escapes them, so they are ordinary characters here too |
| Unicode case | JS default Unicode casing | Locale/database collation can differ (for example Turkish `ı`/`İ` and multi-character folds such as `ß`) |
| Cross-store relation | Resolve matching subject IDs in Dynamo, filter/order users in Postgres, then enrich | Single SQL query performs relation join and projection |
| Transactions | Dynamo writes made inside a delegated Prisma transaction are not rolled back | Prisma transaction rolls back Postgres writes |
| Missing association target | Orphan association is omitted | Inner join does not return a null subject |

The Dynamo client is constructed as `new DynamoDBClient({})`; region, endpoint,
and credentials are supplied by deployment/test environment rather than app
code. A defensive `systemClockOffset` guard ignores non-finite writes because
moto can emit duplicate Date headers, producing `NaN` and a signer
`RangeError: Invalid time value`.
