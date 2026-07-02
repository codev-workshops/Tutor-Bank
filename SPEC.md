# SPEC.md — Frozen migration contract (Tutor-Bank API → Python/FastAPI)

Status: FROZEN. Map agents READ this; they do not modify it. Changing this file means
re-broadcasting Phase 0.

## 1. Shared substrate (Phase 0 — import, never redefine)
- Models:        app/models.py       (mirror prisma/schema.prisma exactly)
- DB session:    app/db.py           -> `get_db()` dependency (replaces prisma singleton)
- Auth:          app/security.py     -> `get_current_user()` (replaces requireAuth())
- Passwords:     passlib[bcrypt], cost=10 (MUST verify existing bcryptjs hashes)
- Tokens:        python-jose JWT (mirrors NextAuth JWT strategy)
- DB:            PostgreSQL, unchanged

## 2. Pydantic naming conventions
- Request bodies:  <Entity>Create / <Entity>Update  (e.g. BookingCreate, TutorUpdate)
- Responses:       <Entity>Out                        (e.g. UserOut, TutorOut, SubjectOut)
- Enums:           Role = {TUTOR, STUDENT}; BookingStatus = {PENDING, CONFIRMED, REJECTED, CANCELLED}
- Response models set `model_config = ConfigDict(from_attributes=True)`.
- Never serialize `passwordHash`. Auth responses return: id, email, name, role.

## 3. Auth dependency usage
- Protected endpoints declare `user: User = Depends(get_current_user)`.
- Unauthenticated/invalid token => HTTP 401 (JSON {"detail": "..."}).
  NOTE: this is an INTENTIONAL change. The TS code throws Error("Unauthorized") which the
  generic catch surfaces as HTTP 500. Target returns 401.
- Endpoints requiring auth (from source): POST /bookings, GET /bookings, PATCH /bookings/{id},
  GET /notifications, PATCH /notifications, POST /tutors/{id}/slots.
- Public endpoints: POST /auth/register, POST /auth/login, POST /auth/token, GET /tutors,
  GET /tutors/{id}, PUT /tutors/{id}, GET /tutors/{id}/slots, GET /subjects, POST /subjects.
  (PUT /tutors/{id} is public in the source; preserve unless product decides otherwise.)

## 4. Error -> status-code map (pin exactly; verified against source)
| Endpoint                    | Condition                              | Status |
|-----------------------------|----------------------------------------|--------|
| POST /auth/register         | missing email/name/password            | 400    |
| POST /auth/register         | invalid role (not STUDENT/TUTOR)       | 400    |
| POST /auth/register         | email already exists                   | 409    |
| POST /auth/register         | success                                | 201    |
| POST /auth/login            | missing fields                         | 400    |
| POST /auth/login            | invalid credentials                    | 401    |
| POST /auth/login            | success                                | 200    |
| GET  /tutors                | success                                | 200    |
| GET  /tutors/{id}           | tutor not found                        | 404    |
| GET  /tutors/{id}           | success                                | 200    |
| PUT  /tutors/{id}           | success                                | 200    |
| GET  /tutors/{id}/slots     | success                                | 200    |
| POST /tutors/{id}/slots     | missing date/startTime/endTime         | 400    |
| POST /tutors/{id}/slots     | success                                | 201    |
| GET  /subjects              | success                                | 200    |
| POST /subjects              | missing name                           | 400    |
| POST /subjects              | success (upsert by unique name)        | 201    |
| POST /bookings              | missing studentId/tutorId/slotId       | 400    |
| POST /bookings              | slot missing or already booked         | 400    |
| POST /bookings              | success                                | 201    |
| GET  /bookings              | missing userId                         | 400    |
| GET  /bookings              | success                                | 200    |
| PATCH /bookings/{id}        | status not in CONFIRMED/REJECTED/CANCELLED | 400 |
| PATCH /bookings/{id}        | success                                | 200    |
| GET  /notifications         | missing userId                         | 400    |
| GET  /notifications         | success                                | 200    |
| PATCH /notifications        | missing notificationId                 | 400    |
| PATCH /notifications        | success                                | 200    |
| (any protected endpoint)    | unauthenticated/invalid token          | 401    |
| (any endpoint)              | unexpected error                       | 500    |

## 5. Behavior pin — booking transaction (POST /bookings)
Source: src/app/api/bookings/route.ts. Reproduce ATOMICALLY in one DB transaction
(`with session.begin():`):
  1. Load slot by id. If slot is None OR slot.isBooked -> raise -> HTTP 400 "Slot is not available".
  2. Create Booking(studentId, tutorId, slotId) with status default PENDING.
  3. Set slot.isBooked = True.
  4. Create Notification(userId=tutorId,
       message=f"New booking request for slot on {slot.date:%-m/%-d/%Y}").
  5. Return the created booking, HTTP 201.
The DB `slot_id` UNIQUE constraint must remain (one booking per slot). The notification message
format may be normalized but MUST include the slot date.
PATCH /bookings/{id}: on REJECTED or CANCELLED, set the slot's isBooked=False; always create a
Notification for booking.studentId with message f"Your booking has been {status.lower()}".

## 6. Behavior pin — tutor search (GET /tutors?name=&subject=)
Source: src/app/api/tutors/route.ts. Filter role == TUTOR, plus:
  - if `name`:    case-insensitive substring  -> User.name ILIKE %name%
  - if `subject`: case-insensitive substring on the joined subject name
                  -> EXISTS TutorSubject JOIN Subject WHERE Subject.name ILIKE %subject%
Response items: id, name, email, bio, hourlyRate, subjects:[{id, name}]. Both filters optional
and combinable (AND).

## 7. Per-shard rules
- One commit per shard; touch only that shard's files; must be independently revertable.
- Idempotency: if the router already satisfies this SPEC, stop (no rewrite/duplicate).
- Import shared helpers; never redefine models/db/auth.
- Every status-code branch above must have a pytest test.
