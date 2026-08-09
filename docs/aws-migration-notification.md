# Notification DynamoDB migration

## Scope and translation

`DB_MODE` unset (or `postgres`) retains the existing Prisma/Postgres path. `DB_MODE=aws`
routes only `notification` through DynamoDB; all other Prisma models and transactions
remain PostgreSQL.

The application calls being translated are:

1. `src/app/api/notifications/route.ts` GET:
   `prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } })`
2. The same file PATCH:
   `prisma.notification.update({ where: { id: notificationId }, data: { read: true } })`
3. `src/app/api/bookings/route.ts` POST transaction:
   `tx.notification.create({ data: { userId: tutorId, message } })`
4. `src/app/api/bookings/[id]/route.ts` PATCH:
   `prisma.notification.create({ data: { userId: booking.studentId, message } })`

The adapter preserves those Prisma-shaped argument objects and result objects.

## DynamoDB design

The table name is `${DYNAMODB_TABLE_PREFIX ?? ''}Notification`. Its primary key is
`id` (String). A GSI named `userId-createdAt-index` has partition key `userId`
(String) and sort key `createdAt` (Number), represented as epoch milliseconds.
Notifications use a compatible cuid-shaped generator (it is not Prisma's internal
cuid implementation), `createdAt: new Date()` and `read: false` defaults.

Reads query the GSI in descending order and retry briefly for read-after-write
visibility, since GSIs are eventually consistent. Results are normalized to real
`Date` instances and sorted in memory by descending `createdAt`, then descending
`id` for descending requests (and ascending `id` for ascending requests) as a
deterministic tie-break. Postgres does not define tie ordering, so parity tests
use distinct timestamps and do not depend on tie order.

## Emulated versus native behavior

| Concern | Moto/emulator | Native DynamoDB |
| --- | --- | --- |
| Endpoint | Local endpoint supplied by the test script | AWS SDK endpoint resolution |
| GSI visibility | Usually immediate, but retry is still exercised | Eventually consistent; retry is required |
| Table lifecycle | Short local ACTIVE transition | Provisioning can take longer |
| Credentials | Dummy local credentials | IAM credentials/role |
| Capacity | Local emulation | PAY_PER_REQUEST |

No endpoint or region literal is present in application code.

## Atomicity

The accessor is deliberately hybrid: it proxies the real Prisma client and routes
only `notification` to DynamoDB. `$transaction(callback)` runs the real Prisma
transaction and gives the callback a transaction proxy with the same routing.
Atomicity across the two stores is **not preserved**: a DynamoDB notification write
is not rolled back if the PostgreSQL transaction later aborts, and it is not
visible-on-commit-only. Ordering and error propagation are preserved; a callback
error still aborts the PostgreSQL transaction. The bookings route is intentionally
unchanged.

The route's `requireAuth()` error and Prisma missing-record error are both caught
as generic errors. Therefore unauthenticated requests return 500
`{"error":"Internal server error"}`, and PATCH of an unknown notification id also
returns 500. The requested 401/404 paths do not exist in this route and are
asserted as the actual behavior in parity tests.

## First-run parity failure log

1. The first local parity run could not load `@auth/prisma-adapter` because its
   ESM entry point was not transformed by Jest. The e2e setup stubs only the
   adapter factory needed by `authOptions`; route authentication remains backed
   by the permitted `getServerSession` stub.
2. The first local run then hit Prisma's generated `prisma-client` WASM ESM
   loader under Jest (`Unexpected token 'export'`). The production schema and
   tracked generated stub were left unchanged. The e2e scripts now generate a
   harness-local `prisma-client-js` client into the ignored `.e2e-generated`
   directory, and the e2e Jest config maps only the generated-client import to
   that harness output.
3. The first AWS parity run returned `read: false` after PATCH because the
   DynamoDB expression placeholder map (`:read`) was spread directly into the
   result object. The adapter now overlays the actual `read` and `message`
   property names before normalizing the result.

## Deliberate-break evidence

The adapter was deliberately changed to return `read: false` from `update`.
`npm run test:parity` exited non-zero in
`Notification parity › marks a notification read`:

```diff
- Expected  - 1
+ Received  + 1
  Object {
    "id": "...",
-   "read": true,
+   "read": false,
  }
```

The change was reverted and the full `npm run test:parity` suite was rerun
successfully.
