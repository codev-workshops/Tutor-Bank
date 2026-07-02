# Agentic MapReduce Migration: Tutor-Bank API → Python (FastAPI)

> **What this document is.** A ground-up teaching guide + executable playbook for migrating
> Tutor-Bank's API layer from Next.js 16 / TypeScript to a modern Python stack, using the
> **Agentic MapReduce** pattern hardened by an **actor–critic** control loop.
>
> **What it is not.** It does not change any source file. It is documentation only. Every
> factual claim about the current repo below was verified against the actual files (paths and
> line references are given so you can check them yourself).

---

## Table of contents

- [0. Executive summary](#0-executive-summary)
- [A. Ground knowledge: Agentic MapReduce](#a-ground-knowledge-agentic-mapreduce)
- [B. The subject: Tutor-Bank as a MapReduce problem](#b-the-subject-tutor-bank-as-a-mapreduce-problem)
- [C. The target: idiomatic Python stack + mapping](#c-the-target-idiomatic-python-stack--mapping)
- [D. The plan, derived via actor–critic](#d-the-plan-derived-via-actorcritic)
- [E. The approved execution guide (phases 0–4)](#e-the-approved-execution-guide)
- [F. Practice ladder](#f-practice-ladder)
- [G. SPEC.md starter](#g-specmd-starter)
- [Appendix: verified source facts](#appendix-verified-source-facts)

---

## 0. Executive summary

Tutor-Bank exposes **10 API route files** under `src/app/api/**`. They are almost perfectly
**independent** of one another (a booking handler never imports a tutor handler), but every one
of them leans on the **same two cross-cutting dependencies**: the Prisma client
(`src/lib/prisma.ts`) and the auth guard `requireAuth()` (`src/lib/session.ts`). That shape —
_many independent units + a small shared substrate_ — is the textbook precondition for a
MapReduce decomposition.

The migration is therefore run as:

1. **Phase 0 (broadcast variable):** extract the shared substrate once — `models.py`, `db.py`,
   `security.py`, and a frozen `SPEC.md` contract. This is the "broadcast variable" every map
   task reads but none mutates.
2. **Phase 1 (map):** one agent per domain router (`auth`, `tutors`, `subjects`, `bookings`,
   `notifications`), each a **pure function** `f: (Shard, Spec) -> Partial` producing a
   self-contained FastAPI router + Pydantic schemas + tests, one commit per shard.
3. **Phase 2 (reduce):** a coordinator dedupes schemas/helpers, wires `app/main.py`, sets up
   Alembic, and runs **reduce gates** (import smoke test, `uvicorn` boot, `/docs`, `pytest`).
4. **Phase 3 (test map/reduce):** re-author the test suite with `pytest` + `httpx.AsyncClient`.
5. **Phase 4 (CI reduce):** rewrite `.github/workflows/test.yml` for Python, keeping the
   `postgres:15` service.

The **actor–critic** loop (Section D) is an orthogonal control layer: at each phase an *actor*
produces work and a *critic* rejects it against explicit exit criteria until it passes. When a
reduce gate fails, the failure is re-cast as a new, narrowly-scoped map job (the "iterate loop").

---

## A. Ground knowledge: Agentic MapReduce

### A.1 Classic MapReduce (split → map → reduce)

MapReduce (Dean & Ghemawat, Google, 2004) is a model for processing a large input by expressing
the computation as two user functions over key/value pairs:

```
map:    (k1, v1)        -> list[(k2, v2)]
reduce: (k2, list[v2])  -> list[(k3, v3)]
```

The framework does the rest: **split** the input into shards, run `map` on each shard in
parallel, **shuffle/group** the intermediate pairs by `k2`, then run `reduce` per group.

**The canonical word-count example:**

```python
def map(document_name, text):
    for word in text.split():
        emit(word, 1)                 # (k2="the", v2=1), (k2="cat", v2=1), ...

def reduce(word, counts):             # word="the", counts=[1, 1, 1, ...]
    emit(word, sum(counts))           # (k3="the", v3=42)
```

Three properties make this work and are exactly what we exploit for the migration:

- **Independence of shards.** `map` on document A never needs document B. Shards are processed
  in isolation, so they can run concurrently and in any order.
- **A stable grouping key.** The reducer only ever sees all values for one key at a time.
- **Associativity/commutativity at reduce.** `sum` doesn't care about ordering, so partial
  results can be merged safely (this is what lets Hadoop run *combiners* and speculative copies).

### A.2 Why the map function must behave like a PURE function

In MapReduce the `map` function is required to be, in functional-programming terms, a **pure
function**:

- **No shared mutable state / no side effects.** A map task must not depend on or mutate global
  state that another map task can see. If two shards raced on shared state, results would depend
  on scheduling — non-determinism that breaks retries and speculative execution.
- **Referential transparency.** `map(shard)` must return the same output for the same input
  every time. This is precisely what lets the framework *re-run* a straggler or a crashed task on
  another node and trust the result (Hadoop's speculative execution relies on this).
- **A typed output contract.** `map` commits to a fixed output shape — `list[(k2, v2)]` with
  known types. The reducer is written against that contract, not against how any particular map
  task happened to compute it.

Translated to agents: **each map agent must be able to complete its shard using only its shard +
the frozen shared spec, producing output in a pre-agreed shape, with no dependence on what any
other agent is doing.** If a shard needs to peek at another agent's in-progress work, the
decomposition is wrong.

### A.3 The typed "partial output" contract — `f: (Shard, Spec) -> Partial`

A map task is a function with a **signature**, and honoring that signature is what makes the
partial results mergeable:

```
f : (Shard, Spec) -> Partial
```

- **`Shard`** — the isolated slice of the problem (e.g. "the `bookings` domain: `POST /bookings`,
  `GET /bookings`, `PATCH /bookings/{id}`").
- **`Spec`** — the frozen, read-only contract shared by all shards (see [SPEC.md](#g-specmd-starter)):
  error→status-code mapping, Pydantic naming rules, the auth dependency signature, DB session
  usage, behavior pins. This is the agentic equivalent of the reducer's *expected intermediate
  type*.
- **`Partial`** — a typed, self-contained artifact: `app/routers/<domain>.py`,
  `app/schemas/<domain>.py`, `tests/test_<domain>.py`, plus a **structured JSON manifest** of
  what it produced (endpoints, schemas, shared helpers it *assumed*). See the per-shard output
  contract in [Phase 1](#phase-1--map).

Because every `Partial` conforms to the same `Spec`, the reducer can merge them mechanically:
concatenate routers, dedupe schemas by name, resolve shared helpers to Phase 0 modules.

### A.4 Cross-cutting dependencies as a "broadcast variable" → Phase 0

In Spark, a **broadcast variable** is a read-only value shipped to every worker once, instead of
being recomputed or re-shuffled per task (the classic example: a lookup table joined against
every shard). The rule: **broadcast variables are immutable on the workers.**

Tutor-Bank's cross-cutting dependencies are exactly this:

- the **DB client** (`src/lib/prisma.ts`, imported by *every* route),
- the **auth guard** `requireAuth()` (`src/lib/session.ts`),
- the **data model** (`prisma/schema.prisma`).

If we let each map agent re-derive these, we get five subtly different `get_db()` helpers and
five incompatible `User` models — the reduce step would then be a painful reconciliation. So we
**extract them once, up front, in a pre-map "Phase 0"** and *broadcast* them (freeze them in the
repo + SPEC). Map agents **import** them; they never redefine them. This is the single most
important structural decision in the migration.

### A.5 The iterate loop: reduce-time failures become new map jobs

Reduce is where integration truths surface: a smoke import fails, `uvicorn` won't boot, two
routers defined a `UserOut` with different fields, a test asserts a `409` the router returns as
`400`. In Hadoop, a failed or straggling task isn't fatal — the scheduler **re-dispatches** it
(retry / speculative execution) because tasks are pure and idempotent.

We do the same: **a reduce-time failure is re-cast as a new, narrowly-scoped map job** —
"re-run the `bookings` shard; the transaction must map `Slot is not available` to HTTP 400, not
500." The scope is one shard, the commit is one revert-able unit, and the reduce gates re-run.
This loop is what makes the whole thing robust instead of a big-bang rewrite.

### A.6 Actor–critic as an orthogonal control layer

Actor–critic comes from reinforcement learning: an **actor** proposes actions; a **critic**
estimates their value and supplies a corrective signal the actor learns from. Here we use it as a
**control layer that sits orthogonally on top of MapReduce** — it does not replace map or reduce,
it *hardens* each of them:

- At **planning** time: the actor drafts the decomposition; the critic rejects it until shards
  are truly independent and Phase 0 truly removes duplication (Section D).
- At **map** time: the actor (per-shard agent) writes the router; the critic checks the Partial
  against SPEC before the commit lands.
- At **reduce** time: the gates *are* the critic — objective, runnable pass/fail signals
  (import, boot, `/docs`, `pytest`) that decide whether to accept the merge or spawn an iterate
  job.

The key discipline: **the critic must reject with concrete, checkable reasons and must not
approve until every exit criterion passes.** Approval is earned, never assumed.

### A.7 Concept map: MapReduce → agentic equivalent (this migration)

| MapReduce / distributed-systems concept | Agentic equivalent in this migration |
|---|---|
| Input to be processed | The Next.js/TS API layer (`src/app/api/**`, `src/lib/**`) |
| **Split** into shards | Group the 10 route files into 5 domain shards (auth, tutors, subjects, bookings, notifications) |
| **Shard** | One domain's routes + their behavior |
| **Map function** `f: (Shard, Spec) -> Partial` | One agent turning a domain into a FastAPI router + schemas + tests |
| **Pure / referentially transparent map** | Agent uses only its shard + frozen SPEC; no dependence on other agents' in-progress work |
| **Typed intermediate output** `(k2, v2)` | The per-shard `Partial`: router file, schema file, test file + JSON manifest |
| **Broadcast variable** (read-only, shipped once) | Phase 0 shared substrate: `models.py`, `db.py`, `security.py`, `SPEC.md` |
| **Shuffle / group by key** | Coordinator groups Partials by concern (routers vs. schemas vs. shared helpers) |
| **Reduce function** | Coordinator wires `app/main.py`, dedupes schemas, sets up Alembic |
| **Combiner** (partial pre-aggregation) | Per-shard dedupe of obviously-shared DTOs before global reduce |
| **Speculative / retry execution** | The iterate loop: a failed reduce gate re-dispatches a narrow map job |
| **Task idempotency & determinism** | One commit per shard, revert-able; idempotency guard in the shard prompt |
| **Job = map + reduce** | Full migration = Phase 0 → map → reduce → test → CI |
| **Actor–critic (RL)** | Orthogonal control layer hardening plan/map/reduce; gates are the critic |

---

## B. The subject: Tutor-Bank as a MapReduce problem

### B.1 Current stack (verified)

| Layer | Technology | Evidence |
|---|---|---|
| Framework | **Next.js 16.2.9** (App Router, Web Request/Response) | `package.json` `next: 16.2.9`; `AGENTS.md` |
| UI runtime | **React 19.2.4** | `package.json` `react/react-dom: 19.2.4` |
| Language | **TypeScript 5** | `package.json` `typescript: ^5` |
| ORM / DB | **Prisma 7.8.0** + `@prisma/adapter-pg`, **PostgreSQL** | `package.json`; `src/lib/prisma.ts`; `prisma/schema.prisma` |
| Auth | **NextAuth 4.24.14** (JWT strategy) + `@auth/prisma-adapter`, **bcryptjs 3** | `src/lib/auth.ts`; `package.json` |
| Tests | **Jest 30** (`next/jest`, jsdom), Prisma mocked globally | `jest.config.js`, `jest.setup.js`, `package.json` |
| CI | GitHub Actions, `postgres:15` service, Node 20 | `.github/workflows/test.yml` |

This matches the brief. Two nuances worth pinning (they matter for behavior parity):

1. **`requireAuth()` throws a plain `Error("Unauthorized")`** (`src/lib/session.ts:12`). In the
   route handlers that call it, that error is caught by the *generic* `catch` and returned as
   **HTTP 500 `"Internal server error"`**, not 401. So today an unauthenticated call to a
   protected route surfaces as a 500. The Python target should raise `HTTPException(status_code=401)`
   via the auth dependency — a deliberate, documented **behavior improvement** (see SPEC §Auth).
2. **`POST /api/auth/login`** (`src/app/api/auth/login/route.ts`) only verifies the password with
   bcrypt and echoes the user; it does **not** issue a token/cookie. The real session is issued by
   the **NextAuth catch-all** `src/app/api/auth/[...nextauth]/route.ts`. Both must be accounted
   for in the target (see Section C.4).

### B.2 The 10 route files as "shards"

Grouped into **5 domain shards** for the map phase:

| Shard (domain) | Route files | Endpoints (method → path) | Auth? |
|---|---|---|---|
| **auth** | `auth/register/route.ts`, `auth/login/route.ts`, `auth/[...nextauth]/route.ts` | `POST /auth/register`, `POST /auth/login`, NextAuth catch-all `GET/POST /auth/*` | public |
| **tutors** | `tutors/route.ts`, `tutors/[id]/route.ts`, `tutors/[id]/slots/route.ts` | `GET /tutors`, `GET /tutors/{id}`, `PUT /tutors/{id}`, `GET /tutors/{id}/slots`, `POST /tutors/{id}/slots` | mixed (slot POST needs auth) |
| **subjects** | `subjects/route.ts` | `GET /subjects`, `POST /subjects` | public |
| **bookings** | `bookings/route.ts`, `bookings/[id]/route.ts` | `POST /bookings`, `GET /bookings`, `PATCH /bookings/{id}` | required |
| **notifications** | `notifications/route.ts` | `GET /notifications`, `PATCH /notifications` | required |

Full endpoint table with status codes is in the [Appendix](#appendix-verified-source-facts).

### B.3 The data model (verified — `prisma/schema.prisma`)

- **`User`** (`id` cuid, `email` unique, `name`, `passwordHash`, `role` enum, `bio?`,
  `hourlyRate?`, timestamps). **`Role`** enum = `TUTOR | STUDENT` (default `STUDENT`).
- **`Subject`** (`id`, `name` **unique**).
- **`TutorSubject`** join table — `@@unique([tutorId, subjectId])`.
- **`TimeSlot`** (`id`, `tutorId`, `date`, `startTime`, `endTime`, `isBooked` default false).
  Has an optional 1:1 back-relation to `Booking`.
- **`Booking`** (`id`, `studentId`, `tutorId`, **`slotId` `@unique`**, `status`
  `BookingStatus` default `PENDING`, timestamps). The unique `slotId` enforces **one booking per
  slot at the DB level**. **`BookingStatus`** enum = `PENDING | CONFIRMED | REJECTED | CANCELLED`.
- **`Notification`** (`id`, `userId`, `message`, `read` default false, `createdAt`).
- NextAuth models: `Account`, `Session`, `VerificationToken`.

### B.4 Why this is an ideal MapReduce subject

- **Independent routes.** Handlers do not import each other; each owns one domain. → clean split.
- **A small, shared cross-cutting substrate.** Every handler imports `prisma` from
  `src/lib/prisma.ts`; the protected ones import `requireAuth` from `src/lib/session.ts`; all
  share `prisma/schema.prisma`. → a natural broadcast variable / Phase 0.
- **Behavior concentrated in two hot spots.** The transactional booking flow
  (`bookings/route.ts`) and the case-insensitive tutor search (`tutors/route.ts`) are the only
  places with non-trivial semantics — perfect targets for the practice ladder and behavior pins.

---

## C. The target: idiomatic Python stack + mapping

### C.1 Chosen stack (and why)

| Concern | Choice | Justification |
|---|---|---|
| Web framework | **FastAPI** | `APIRouter` maps 1:1 onto Next.js route groups; native async; generates OpenAPI/`/docs` (our reduce gate). |
| Validation / DTOs | **Pydantic v2** | Replaces Zod/manual checks; typed request/response models; `model_config = ConfigDict(from_attributes=True)` to serialize ORM rows. |
| ORM | **SQLModel** (SQLAlchemy 2.0 core underneath) | SQLModel unifies the Pydantic-ish model + SQLAlchemy table; if you prefer separation, plain **SQLAlchemy 2.0** `DeclarativeBase` works identically. PostgreSQL is **unchanged**. |
| Migrations | **Alembic** | Replaces `prisma migrate`; autogenerate from the SQLAlchemy metadata. |
| Auth | **python-jose[cryptography]** (JWT) + **passlib[bcrypt]** | `passlib`'s bcrypt verifies the *existing* bcryptjs hashes (same algorithm) → no forced password reset; python-jose issues/verifies JWTs to mirror NextAuth's JWT strategy. |
| Auth wiring | **`Depends(get_current_user)`** | Direct replacement for `requireAuth()`; raises `HTTPException(401)` (fixing the current 500-on-unauth behavior). |
| Server | **uvicorn** | ASGI server; boot is a reduce gate. |
| Tests | **pytest** + **httpx.AsyncClient** (via `ASGITransport`) | Async route testing without a live socket; parametrized fixtures replace Jest. |

> **Version note.** Pin exact versions at execution time (prefer releases published ≥7 days ago).
> As a baseline these are all current and mutually compatible: FastAPI ≥ 0.115, Pydantic ≥ 2.9,
> SQLAlchemy ≥ 2.0, SQLModel ≥ 0.0.22, Alembic ≥ 1.13, python-jose ≥ 3.3, passlib ≥ 1.7.4,
> httpx ≥ 0.27, pytest ≥ 8. Confirm on PyPI before committing `requirements.txt`/`pyproject.toml`.

### C.2 Concept mapping: TypeScript/Next.js → Python

| Next.js / TS concept | Python equivalent |
|---|---|
| `src/app/api/<domain>/route.ts` (file-based routing) | `app/routers/<domain>.py` with `APIRouter(prefix=..., tags=...)` |
| `export async function GET/POST/PUT/PATCH` | `@router.get/post/put/patch` decorated async functions |
| `RouteContext<"/api/tutors/[id]">` / `{ params }` | Path params: `async def get_tutor(id: str)` |
| `new URL(request.url).searchParams.get("x")` | Query params: `def list_tutors(name: str | None = None, subject: str | None = None)` |
| `await request.json()` + manual field checks | A Pydantic request model as the typed body parameter |
| `NextResponse.json(data, { status: n })` | `return data` (200) or `JSONResponse(status_code=n, ...)` / `HTTPException` |
| Zod (aspirational, per README TODO) | Pydantic v2 models (validation is built in) |
| `prisma` singleton (`src/lib/prisma.ts`) | `get_db()` dependency yielding a SQLAlchemy `Session` (`app/db.py`) |
| `prisma.$transaction(async (tx) => {...})` | `with session.begin():` (SQLAlchemy transaction block) |
| `requireAuth()` (`src/lib/session.ts`) | `Depends(get_current_user)` (`app/security.py`) |
| NextAuth Credentials + bcryptjs | `passlib[bcrypt]` verify + python-jose JWT issue |
| Prisma models (`schema.prisma`) | SQLAlchemy/SQLModel models (`app/models.py`) |
| `prisma migrate` | Alembic migrations |
| `contains` + `mode: "insensitive"` | `Model.col.ilike(f"%{term}%")` (Postgres `ILIKE`) |
| Jest + `next/jest`, Prisma mocked in `jest.setup.js` | pytest + `httpx.AsyncClient`; DB via a transactional test fixture |
| `.github/workflows/test.yml` (Node) | same workflow rewritten for Python (keep `postgres:15`) |

### C.3 Target project layout

```
app/
├── main.py                # FastAPI() app; include_router() for each domain (REDUCE output)
├── db.py                  # engine + SessionLocal + get_db() dependency  (Phase 0 / broadcast)
├── models.py              # SQLAlchemy/SQLModel models mirroring schema.prisma (Phase 0)
├── security.py            # password hash/verify, JWT, get_current_user  (Phase 0)
├── config.py              # pydantic-settings: DATABASE_URL, JWT_SECRET, ...
├── schemas/
│   ├── common.py          # shared DTOs consolidated at reduce (UserOut, SubjectOut, ...)
│   ├── auth.py            # per-shard MAP output
│   ├── tutors.py
│   ├── subjects.py
│   ├── bookings.py
│   └── notifications.py
└── routers/
    ├── auth.py            # MAP output: one router per domain shard
    ├── tutors.py
    ├── subjects.py
    ├── bookings.py
    └── notifications.py
alembic/                   # migrations (REDUCE output)
alembic.ini
tests/
├── conftest.py            # app + db + client fixtures (Phase 0 for tests)
├── test_auth.py
├── test_tutors.py
├── test_subjects.py
├── test_bookings.py
└── test_notifications.py
pyproject.toml             # or requirements.txt
.github/workflows/test.yml # Python CI (REDUCE output, Phase 4)
```

### C.4 Handling the auth special cases

- **NextAuth catch-all (`auth/[...nextauth]/route.ts`).** There is no 1:1 Python equivalent of
  NextAuth's endpoint surface. Collapse it into an explicit, documented token endpoint:
  `POST /auth/token` (OAuth2 password-style) that verifies credentials via `passlib` and returns a
  python-jose JWT. This is the intentional shape change; record it in SPEC so no map agent tries
  to reproduce NextAuth's `/api/auth/session`, `/csrf`, etc.
- **Legacy `POST /auth/login`.** Keep it for parity (verify password, echo the user object,
  `401` on bad credentials) but note in SPEC that new clients should use `POST /auth/token`.

---

## D. The plan, derived via actor–critic

Below is the **actual** planning loop that produced the execution guide in Section E. Each round
is `ACTOR` (proposal) → `CRITIC` (verdict + reasons). The critic scores against the five exit
criteria: **(1) concept correctness, (2) actionable & internally consistent phases, (3) factual
correctness vs. the repo, (4) safety (idempotency + revertable commits + iterate loop),
(5) idiomatic Python that maps cleanly.** Approval is only given when all five pass.

### Round 1

**ACTOR (draft plan).** "Split by the 10 route files — one map agent per file (10 shards). Each
agent writes a FastAPI router and its own DB session helper and its own auth check inline, then a
coordinator concatenates them into `main.py`. Port each Jest test file line-for-line to pytest."

**CRITIC — REJECT.** Reasons:
1. **(crit 4/broadcast) Cross-cutting duplication.** Letting each of 10 agents write its own DB
   session helper and inline auth check reproduces the shared substrate 10×. That is the anti-pattern
   MapReduce's broadcast variable exists to prevent — reduce would become a manual reconciliation of
   10 divergent `get_db()`/auth implementations. **There must be a Phase 0 that extracts
   `db.py`/`security.py`/`models.py` once, before any map job.**
2. **(crit 2/independence) Shard granularity.** 10 file-level shards split cohesive domains
   (`tutors/route.ts` and `tutors/[id]/route.ts` share the tutor DTO and search semantics). Splitting
   them forces cross-shard coordination on shared schemas → shards aren't independent. **Group into 5
   domain shards.**
3. **(crit 2/test fidelity) Line-for-line test port is wrong.** Jest mocks Prisma globally
   (`jest.setup.js`); a literal port would try to mock Prisma in Python and test nothing real. Tests
   must be **re-authored** against a real Postgres test DB with `httpx.AsyncClient`.
4. **(crit 4) No idempotency or revert story.** Nothing says re-running an agent is safe or that a
   bad shard can be reverted independently.

### Round 2

**ACTOR (revision).** "Add **Phase 0** that freezes `models.py`, `db.py`, `security.py`, and a
`SPEC.md` contract; map agents *import* these, never redefine them. Regroup into **5 domain
shards**. Give each map agent a prompt template with an **idempotency guard** ('if the target
router file already exists and matches SPEC, stop') and a **one-commit-per-shard** rule. Reduce
step dedupes schemas and wires `main.py`. Re-author tests with pytest + httpx against a
transactional DB fixture."

**CRITIC — REJECT (closer).** Reasons:
1. **(crit 2/gates) Reduce has no objective acceptance test.** "Wire `main.py`" is not a
   pass/fail signal. **Define concrete reduce gates:** import smoke test, `uvicorn` boot, `/docs`
   (OpenAPI) renders, `pytest` green. Without runnable gates the critic at reduce time has nothing to
   check.
2. **(crit 3/facts) Behavior pins missing.** The plan doesn't pin the two behaviors that actually
   carry risk: the **booking transaction** (slot-availability check → create booking → set
   `isBooked=true` → notify tutor, all atomic; `Slot is not available` must map to **400**, not 500)
   and **tutor search** (case-insensitive substring on `name`, and on `subject` via the join). These
   must be in SPEC and asserted in tests, or "behavior parity" is unverifiable.
3. **(crit 5/auth) Auth-failure status code.** Plan says "port `requireAuth`" but doesn't note that
   the TS version currently yields **500** on unauth (generic catch). The target should return **401**
   via `Depends(get_current_user)`; this deviation must be explicit or the critic can't tell a bug
   from an intended fix.
4. **(crit 4/iterate) No iterate loop.** Nothing describes what happens when a reduce gate fails.

### Round 3

**ACTOR (revision).** "Add explicit reduce **gates** (import / boot / `/docs` / `pytest`). Add
`SPEC.md` behavior pins for the booking transaction and tutor search, plus the error→status map
including the intentional **401** auth change. Add the **iterate loop**: any failed gate is
re-cast as a new narrowly-scoped map job on the offending shard, one revert-able commit. Add a
per-shard **structured JSON output manifest** so the reducer can merge mechanically. Add a
**practice ladder**: rehearse the whole loop on `bookings` first, then fan out, then deliberately
break one shard to exercise the iterate loop."

**CRITIC — APPROVE.** All five criteria pass:
1. **Concepts** — split/map/reduce, purity, broadcast variable, iterate loop, and actor–critic are
   defined with real terminology and grounded examples (Section A). ✔
2. **Phases actionable & consistent** — Phase 0 provably removes cross-cutting duplication (agents
   import, never redefine); map shards are domain-independent; reduce gates are concrete and runnable. ✔
3. **Factual correctness** — endpoints, status codes, the transaction, search semantics, and auth
   behavior are pinned to verified files (Appendix + SPEC). No invented files. ✔
4. **Safety** — idempotency guard + one revert-able commit per shard + a defined iterate loop. ✔
5. **Idiomatic Python that maps cleanly** — FastAPI/Pydantic/SQLAlchemy/Alembic/passlib+jose/pytest
   map 1:1 onto the source shape (Section C). ✔

> The approved plan is written out as the execution guide in Section E. The `bookings` shard is the
> designated rehearsal shard (Section F) because it concentrates the highest-risk behavior.

---

## E. The approved execution guide

### Phase 0 — shared context (the broadcast variable)

**Goal:** produce, review, and *freeze* the shared substrate so every map agent imports it. No
domain routes yet. Output of this phase is committed and treated as read-only by map agents.

Deliverables:

1. **`app/models.py`** — SQLAlchemy/SQLModel models mirroring `prisma/schema.prisma` exactly:
   `User` (+ `Role` enum), `Subject`, `TutorSubject` (`UniqueConstraint(tutorId, subjectId)`),
   `TimeSlot` (`isBooked` default `False`), `Booking` (**`slot_id` unique**, `BookingStatus` enum
   default `PENDING`), `Notification`. Keep column names/semantics identical; PostgreSQL unchanged.
2. **`app/db.py`** — engine from `DATABASE_URL`, `SessionLocal`, and a `get_db()` dependency that
   yields a session and closes it. This is the Prisma-singleton replacement.
3. **`app/security.py`** — `hash_password`/`verify_password` (`passlib[bcrypt]`, cost 10, so it
   verifies existing bcryptjs hashes), `create_access_token`/`decode_token` (python-jose), and
   **`get_current_user(token, db) -> User`** raising `HTTPException(401)`.
4. **`app/config.py`** — `pydantic-settings` for `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`.
5. **`SPEC.md`** — the frozen map-function contract (see [Section G](#g-specmd-starter)). Once
   Phase 0 is merged, SPEC is the single source of truth; changing it means re-broadcasting.

**Phase 0 exit gate:** `python -c "import app.models, app.db, app.security, app.config"` succeeds;
Alembic can autogenerate an initial migration whose tables match `schema.prisma`.

### Phase 1 — MAP (one agent per domain shard)

Run 5 map agents (auth, tutors, subjects, bookings, notifications), each a pure
`f: (Shard, Spec) -> Partial`. Each imports Phase 0 modules; **none** redefines models/db/auth.

Each agent produces exactly:
- `app/routers/<domain>.py` — an `APIRouter`.
- `app/schemas/<domain>.py` — Pydantic request/response models.
- `tests/test_<domain>.py` — pytest tests (authored, not ported).
- a **structured JSON manifest** printed at the end (fed to the reducer).

**One commit per shard.** The commit touches only that domain's three files (+ new schemas). It
must be independently revert-able.

#### Copy-pasteable per-shard prompt template

```text
ROLE: You are a MAP worker migrating ONE domain shard of Tutor-Bank to Python.
SHARD: {domain}  — source files: {list of src/app/api/... route.ts files}
SPEC: Read SPEC.md in full. It is FROZEN and read-only. Do not modify it.

HARD RULES (purity / broadcast variable):
- IMPORT shared code from app/models.py, app/db.py (get_db), app/security.py
  (get_current_user). NEVER redefine models, DB sessions, or auth logic.
- Depend ONLY on your shard's source files + SPEC.md. Do NOT read or wait on any
  other shard's in-progress work.

IDEMPOTENCY GUARD (run this FIRST):
- If app/routers/{domain}.py already exists AND its endpoints already satisfy SPEC
  (same paths, methods, status codes, auth deps), STOP and report "already satisfied"
  with the manifest below. Do not rewrite or duplicate.

TASK:
1. Implement app/routers/{domain}.py: one FastAPI endpoint per source handler, same
   method + path (strip the /api prefix), same query/path/body params.
2. Implement app/schemas/{domain}.py: Pydantic v2 request/response models.
3. Apply SPEC's error->status-code map EXACTLY (esp. auth -> 401 via
   Depends(get_current_user); booking "Slot is not available" -> 400).
4. Write tests/test_{domain}.py against the real Postgres test DB + httpx.AsyncClient
   (see conftest fixtures). Cover every status-code branch. Re-author tests; do NOT
   port Jest mocks.
5. Run: pytest tests/test_{domain}.py  — must be green before you commit.
6. COMMIT once, message: "map({domain}): port routes to FastAPI". Touch only your
   shard's files.

STRUCTURED JSON OUTPUT (print verbatim as the last thing you emit):
{
  "shard": "{domain}",
  "status": "completed" | "already_satisfied" | "blocked",
  "endpoints": [{"method": "...", "path": "...", "auth": true|false,
                 "status_codes": [200, 400, ...]}],
  "schemas": ["UserOut", "..."],
  "assumed_shared_helpers": ["get_db", "get_current_user", "..."],
  "files_changed": ["app/routers/{domain}.py", "app/schemas/{domain}.py",
                    "tests/test_{domain}.py"],
  "commit": "<sha>",
  "notes": "any SPEC ambiguity or cross-shard schema overlap the reducer must resolve"
}
```

### Phase 2 — REDUCE (coordinator)

The coordinator consumes the 5 JSON manifests and merges the Partials:

1. **Shuffle/group.** Group manifest entries by concern: routers, schemas, `assumed_shared_helpers`.
2. **Dedupe schemas.** If two shards emitted a `UserOut`/`SubjectOut`, hoist a single definition to
   `app/schemas/common.py` and point both routers at it (this is the "combiner"→reduce step). Any
   field disagreement is a conflict → **iterate job** on the offending shard.
3. **Wire `app/main.py`.** `include_router()` for each domain with its prefix/tags.
4. **Alembic.** `alembic revision --autogenerate` against `app/models.py`; review the migration.

**Reduce gates (the critic — all must pass):**
- **G1 import smoke:** `python -c "import app.main"` — no import/wiring errors.
- **G2 boot:** `uvicorn app.main:app` starts without exceptions.
- **G3 `/docs`:** `GET /openapi.json` returns 200 and lists every expected endpoint.
- **G4 tests:** `pytest` is green across all shards.

**Iterate loop.** Any failed gate → re-cast as a narrow map job scoped to the single offending
shard (reuse the Phase-1 template, note the failure as the objective), one revert-able commit,
then re-run all gates. Repeat until G1–G4 pass.

### Phase 3 — TEST MAP/REDUCE

Tests are themselves map/reduce: each shard maps its own `tests/test_<domain>.py`; the reduce is
the shared `tests/conftest.py`.

- **`conftest.py` (shared, Phase-0-for-tests):** fixtures for the FastAPI app, a Postgres test DB,
  a per-test transaction rolled back after each test (isolation), and an `httpx.AsyncClient` bound
  via `ASGITransport(app=app)`. Also an `auth_client` fixture that mints a JWT.
- **Re-author, don't port.** Jest mocked Prisma globally; the Python suite exercises a **real**
  DB. Cover every status-code branch enumerated in SPEC, and specifically the behavior pins:
  the booking transaction (including the `isBooked` guard and the tutor notification side-effect)
  and case-insensitive tutor search by name and by subject.

### Phase 4 — CI reduce

Rewrite `.github/workflows/test.yml` for Python, **keeping the `postgres:15` service** and its
health-check block verbatim:

```yaml
name: Tests
on:
  pull_request:
    branches: [ main, develop ]
  push:
    branches: [ main, develop ]
jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: tutor_bank_test
        ports: [ "5432:5432" ]
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.12'
      - name: Install dependencies
        run: pip install -e ".[dev]"     # or: pip install -r requirements.txt
      - name: Run Alembic migrations
        run: alembic upgrade head
        env:
          DATABASE_URL: postgresql+psycopg://test:test@localhost:5432/tutor_bank_test
      - name: Run tests
        run: pytest --cov=app --cov-report=xml --cov-report=term
        env:
          DATABASE_URL: postgresql+psycopg://test:test@localhost:5432/tutor_bank_test
          JWT_SECRET: test-secret
      - name: Upload coverage report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: coverage-report
          path: coverage.xml
          retention-days: 30
```

### Definition of Done

- [ ] **Behavior parity — booking transaction:** `POST /bookings` is atomic (slot check → create
      booking → `isBooked=true` → notify tutor); a busy/missing slot returns **400 `Slot is not
      available`**; the DB `slot_id` unique constraint still prevents double-booking.
- [ ] **Behavior parity — tutor search:** `GET /tutors?name=&subject=` filters by
      **case-insensitive substring** on name and (via the join) on subject name.
- [ ] **Zero cross-cutting duplication:** exactly one `get_db`, one `get_current_user`, one set of
      models; no router redefines them.
- [ ] **Auth:** protected endpoints return **401** (not 500) when unauthenticated (documented
      improvement over the TS behavior).
- [ ] **Every shard revertable:** one commit per shard; reverting one leaves the others working.
- [ ] **Reduce gates green:** import smoke, `uvicorn` boot, `/openapi.json`, `pytest`.
- [ ] **CI green** on the Python `test.yml` with `postgres:15`.
- [ ] **Endpoint parity:** every row of the [Appendix](#appendix-verified-source-facts) endpoint
      table exists with the same method/path/status codes (auth `/token` shape change documented).

---

## F. Practice ladder

Rehearse the loop on the highest-risk shard before fanning out, then deliberately exercise the
iterate loop.

1. **Rung 1 — Rehearse on `bookings` only.** Run Phase 0, then a *single* map agent on the
   `bookings` shard. This shard has the transaction (`bookings/route.ts`) and the status-transition
   side effects (`bookings/[id]/route.ts`) — the parts most likely to reveal SPEC gaps. Get G1–G4
   green for just this shard. Fix SPEC if the agent hit ambiguity, then re-freeze.
2. **Rung 2 — Fan out.** With SPEC proven, dispatch the remaining four map agents (auth, tutors,
   subjects, notifications) in parallel. Run the full reduce.
3. **Rung 3 — Break a shard on purpose.** Introduce a deliberate fault in one shard (e.g. make the
   `tutors` search use `like` instead of `ilike`, breaking case-insensitivity, or have `bookings`
   return 500 instead of 400 for an unavailable slot). Confirm a **reduce gate catches it** (a
   behavior-pin test fails), then watch the **iterate loop** re-dispatch a narrow map job scoped to
   that one shard, land a single revert-able fix commit, and turn the gates green again. This proves
   the control loop works before you rely on it.

---

## G. SPEC.md starter

The block below is a ready-to-use `SPEC.md`. It is the frozen "map function" contract every map
agent reads. (A copy is also written to `SPEC.md` at the repo root alongside this guide.)

```markdown
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
```

---

## Appendix: verified source facts

Endpoint table (method → path → auth → status codes), verified against `src/app/api/**`:

| Method | Path (source `/api/...`) | Source file | Auth (`requireAuth`) | Status codes |
|---|---|---|---|---|
| POST | `/auth/register` | `auth/register/route.ts` | no | 400, 409, 201, 500 |
| POST | `/auth/login` | `auth/login/route.ts` | no | 400, 401, 200, 500 |
| GET/POST | `/auth/[...nextauth]` | `auth/[...nextauth]/route.ts` | (NextAuth) | — |
| GET | `/tutors` | `tutors/route.ts` | no | 200, 500 |
| GET | `/tutors/{id}` | `tutors/[id]/route.ts` | no | 200, 404, 500 |
| PUT | `/tutors/{id}` | `tutors/[id]/route.ts` | no | 200, 500 |
| GET | `/tutors/{id}/slots` | `tutors/[id]/slots/route.ts` | no | 200, 500 |
| POST | `/tutors/{id}/slots` | `tutors/[id]/slots/route.ts` | **yes** | 400, 201, 500 |
| GET | `/subjects` | `subjects/route.ts` | no | 200, 500 |
| POST | `/subjects` | `subjects/route.ts` | no | 400, 201, 500 |
| POST | `/bookings` | `bookings/route.ts` | **yes** | 400, 201, 500 |
| GET | `/bookings` | `bookings/route.ts` | **yes** | 400, 200, 500 |
| PATCH | `/bookings/{id}` | `bookings/[id]/route.ts` | **yes** | 400, 200, 500 |
| GET | `/notifications` | `notifications/route.ts` | **yes** | 400, 200, 500 |
| PATCH | `/notifications` | `notifications/route.ts` | **yes** | 400, 200, 500 |

Key implementation facts:

- **Transaction** (`bookings/route.ts:19-43`): `prisma.$transaction` wraps slot lookup, booking
  create, `isBooked=true`, and tutor notification. `"Slot is not available"` → **400**
  (`bookings/route.ts:48-52`).
- **Search** (`tutors/route.ts:13-20`): `contains` + `mode: "insensitive"` on `name`; subject via
  `subjects.some.subject.name` contains-insensitive.
- **Auth** (`src/lib/session.ts:9-14`): `requireAuth()` calls `getCurrentUser()`
  (`getServerSession(authOptions)`) and throws `Error("Unauthorized")`; unhandled specially, so it
  currently surfaces as **500** in the calling routes.
- **NextAuth** (`src/lib/auth.ts`): Credentials provider, `bcrypt.compare`, `session.strategy:
  "jwt"`, `jwt`/`session` callbacks copy `id` and `role` onto the token/session.
- **Coverage thresholds** (`jest.config.js:23-30`): branches 70 / functions 75 / lines 80 /
  statements 80. (Note: `AGENTS.md` mentions 85%+/90%+ aspirationally; the enforced numbers are the
  `jest.config.js` values.)
- **CI** (`.github/workflows/test.yml`): `postgres:15` service, Node 20, `npm ci`,
  `npx prisma generate`, `npm run test:ci`, upload `coverage/`.
```
