# Implementation plan: polls in posts

This is a proposed implementation of [story.md](story.md). It adds optional polls to Quacker without separate poll pages, editing, closing, voter lists, or analytics. No application changes are part of this planning task.

## Approach and ownership

Extend the existing backend `modules/quack` controller → service → repository pattern and frontend `features/quack` API schemas → query hooks → components. Polls are attachments to quacks, so keep their code within this feature for the first release. Add dedicated poll files rather than expanding every existing quack file. Controllers own DTOs; services and repositories use domain types.

Keep BetterAuth as a black box. Authenticate every poll endpoint with the existing guard and obtain the voter from the session, never the request body. Frontend route composition provides the signed-in account ID, respecting the rule that features cannot import other features.

## Data model

| Model        | Fields and constraints                                                      | Purpose                                                                   |
| ------------ | --------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `Quack`      | Existing fields; optional `poll` relation                                   | Its existing required text is the question; mood remains unchanged.       |
| `Poll`       | `id`, unique `quackId`, `revision` starting at 0                            | At most one poll per post. Revision increases on each actual vote change. |
| `PollOption` | `id`, `pollId`, `position`, `label`, `normalizedLabel`                      | Immutable answers in entered order.                                       |
| `PollVote`   | `pollId`, `userId`, `optionId`, `updatedAt`; primary key `(pollId, userId)` | One active choice per account and poll. Removing a vote deletes this row. |

Database constraints and indexes:

- `Poll.quackId` references `Quack`; deleting a post cascades to its poll, answers, and votes.
- Option labels are stored trimmed, with a normalized lowercase copy. Use `VARCHAR(100)`, a nonempty-label check, and uniqueness on `(pollId, normalizedLabel)` and `(pollId, position)`.
- Options have a unique `(pollId, id)` pair. A composite foreign key from a vote's `(pollId, optionId)` to that pair ensures an answer belongs to that poll, even if a caller supplies an answer from another poll.
- Votes reference `User` and have an index on `(pollId, optionId)` for aggregation. Foreign-key deletion behavior must be compatible with cascading post deletion.
- Use a PostgreSQL `BIGINT` revision, serialized as a decimal string in JSON/SSE and compared numerically on the client, avoiding JavaScript integer precision issues.
- Enforce 2–6 answers, the 280-character question limit, and trimmed, case-insensitive answer uniqueness in both client validation and backend creation validation. The repository creates the post, poll, and answers in one transaction, so no partial post can be published.

Do not persist answer counts or a total counter. Calculate counts from active vote rows, retaining options with zero votes; derive the total by summing those counts. This keeps counts correct without maintaining a second source of truth.

## HTTP contracts

All paths below include the existing `/api` prefix. JSON endpoints retain the shared credentialed HTTP client, DTO validation, Swagger descriptions, and zod response validation. Personalized poll responses use `Cache-Control: no-store`.

| Endpoint                      | Request                                                                 | Response / behavior                                                                                                                   |
| ----------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/quacks`            | Existing `{ text, mood? }`, plus optional `poll: { options: string[] }` | `201` quack with nullable poll metadata. Validate and create everything atomically.                                                   |
| `GET /api/quacks`             | Existing feed request                                                   | Existing quacks plus `poll: null` or `{ id, options: [{ id, label, position }] }`. Preserve feed order and author data.               |
| `GET /api/polls?ids=...`      | Comma-separated poll IDs; validate and limit each batch to 100          | Current snapshots for requested polls. Chunk larger feeds on the client; avoid one request per post.                                  |
| `GET /api/polls/:pollId`      | Poll ID                                                                 | One current snapshot; also used for a targeted retry or refresh.                                                                      |
| `PUT /api/polls/:pollId/vote` | `{ optionId: string \| null }`                                          | `200` confirmed snapshot. A string sets that choice; `null` removes the vote. Repeating the same desired state is a successful no-op. |
| `GET /api/polls/events`       | Credentialed SSE connection                                             | `ready`, `poll-changed`, and heartbeat events. One connection per open feed, not per poll. Register this route before `/:pollId`.     |

A snapshot is:

```ts
{
  id: string;
  revision: string;
  options: {
    id: string;
    label: string;
    position: number;
    count: number;
  }
  [];
  totalVotes: number;
  myOptionId: string | null;
}
```

No endpoint returns voter lists or other accounts' choices. Poll events contain only `{ pollId, revision }`; each viewer fetches their own personalized snapshot.

Errors: `400` for malformed input, invalid answer counts/labels, or an option belonging to another poll; `401` for missing/expired authentication; `404` for a nonexistent poll; a readable server error for unavailable storage. Creation validation errors identify the answer index and message so the client can display them beside the correct input. The bulk read reports missing IDs explicitly rather than turning them into zero-vote polls.

## Correctness under concurrent voting

For each vote request, run a short transaction:

1. Lock the poll row with `SELECT ... FOR UPDATE`; return `404` if it does not exist. All vote writes for that poll use this lock.
2. Validate the requested answer against the same poll.
3. Read the session account's current vote. Upsert the requested answer or delete the row for `null`. If the desired state already exists, leave it unchanged.
4. For an actual change, increment the poll revision and call parameterized `pg_notify` with its ID and revision inside the transaction.
5. Read an authoritative snapshot, including the requesting account's choice, and return it only after commit succeeds.

The unique key prevents duplicate votes; the lock orders casts, switches, and removals. The last transaction accepted under this lock wins for simultaneous changes from the same account. There is no server-side toggle endpoint: a lost-response retry repeats the intended outcome rather than reversing it.

Read snapshots with one SQL statement, or a repeatable-read transaction if multiple statements are necessary, so revision, counts, and personal choice come from the same database snapshot. Include zero-count answers and never expose vote records through DTOs. Database integration tests must exercise these guarantees; repository mocks cannot establish them.

## Live updates

Use SSE for server-to-browser changes while retaining HTTP for writes. PostgreSQL `LISTEN/NOTIFY` fans out committed changes to every backend instance without adding Redis. Notifications issued inside a transaction are delivered only after it commits. [PostgreSQL documentation](https://www.postgresql.org/docs/current/sql-notify.html)

- Add a lifecycle-managed, dedicated PostgreSQL listener connection using a directly declared `pg` dependency. Do not attempt to keep `LISTEN` on an arbitrary Prisma pooled connection.
- Each backend instance forwards notifications to its authenticated SSE subscribers. Attach subscribers before sending `ready`; send `ready` only while the database listener is healthy.
- A poll change triggers an immediate targeted snapshot refresh. Coalesce overlapping requests for a poll, remember the greatest advertised revision, and refresh again if a response has not yet reached it. Do not use a debounce that consumes the one-second budget.
- On initial `ready`, reconnection, and tab focus, refresh all loaded poll snapshots. Changes arriving during that refresh must still trigger reconciliation before the UI is considered current.
- Notifications are invalidations, not a durable event log. Reconnection always loads current state instead of assuming missed events can be replayed. If the database listener fails, close/mark its client streams unhealthy so the UI cannot appear live while silently missing changes.
- Use credentialed `EventSource`, validate event payloads, and close streams on feed unmount or sign-out. Handle session expiry by ending the stream and returning through the existing authentication flow.
- Send a heartbeat every 5 seconds; a missing heartbeat for 10 seconds marks a silently stalled connection unhealthy. Ordinary stream errors disable voting immediately. Retry reconnects explicitly; automatic reconnection also remains enabled. Restore voting only after a healthy stream and fresh snapshots.
- Serve `text/event-stream`, flush events, disable response buffering and caching, and configure suitable timeouts on the actual API ingress. The current frontend Nginx config serves static files and does not proxy the API; verify the backend hosting path separately. SSE requires particular response and connection handling. [MDN documentation](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events)

The agreed one-second bound is measured from vote commit to another connected foreground client rendering its confirmed snapshot under a healthy connection. Verify this through the deployed API ingress before claiming the release meets it; local event delivery alone is insufficient.

## Frontend behavior

- Extend the quack schema with nullable poll metadata. Maintain account-scoped poll snapshot queries separately from the feed, so vote traffic does not refetch every post. Batch initial reads and reconcile individual snapshots by revision.
- Add an optional poll editor to `QuackForm`: attach/remove poll, add/remove answer rows, indexed validation, and existing pending submission behavior. Reset the draft only after successful publication; preserve question, answers, and mood on failure.
- Render polls inline with `QuackItem`, using the existing UI kit and `DESIGN.md`. Show counts, total, own selection, and the zero-vote message. Initial loading or failure must not look like zero votes.
- Keep confirmed snapshots separate from an optimistic overlay. Compute displayed counts by moving the account's confirmed choice to the desired choice; changing answers preserves the total, while casting/removing changes it by one.
- Permit one pending request per poll in each tab. Disable only its controls and show its pending indicator. Clear the overlay on confirmation and accept the freshest snapshot; never let an older HTTP response overwrite a newer SSE-triggered read.
- Live snapshots received during a pending request still update the confirmed baseline. Recompute the overlay against that baseline. On failure, remove the overlay and reveal the latest confirmed state, preserving other people's votes rather than restoring an obsolete whole-cache copy.
- Store the exact failed desired state for Retry, show an inline error, and reconcile ambiguous timeouts with a fresh read. A response lost after commit must not produce duplicate votes or an accidental removal on retry.
- Preserve confirmed values during disconnection, mark them potentially out of date, and disable voting until resynchronized. Clear personalized poll caches on account changes/sign-out.

## Build order and checkpoints

1. **Define contracts and record the architecture.** Add domain types, DTO/snapshot/event contracts, frontend zod schemas, and an ADR for one vote row, serialized writes, and PostgreSQL-backed SSE. Check existing constraints and `DESIGN.md` before UI implementation.
2. **Add persistence.** Create an additive Prisma migration and small seed fixtures for a normal post, a zero-vote poll, and a voted poll. Verify foreign keys, uniqueness, aggregate reads, and atomic publication on real Postgres. Existing posts remain valid without polls.
3. **Build creation and read endpoints.** Extend quack publication/feed metadata and implement single/bulk snapshot reads. Test answer boundaries, duplicate labels, indexed errors, authentication, zero counts, and draft-compatible error responses.
4. **Build vote writes before optimistic UI.** Implement locked transactions, desired-state idempotency, revisions, and authoritative responses. Test parallel accounts, same-account races, wrong-poll answers, repeated casts/removals, and transaction rollback on real Postgres. Counts must pass before building UI feedback.
5. **Build the notification/SSE path.** Implement transactional notifications, dedicated listener lifecycle, authenticated streams, readiness, heartbeat, and reconnection. Test delivery after commit, no event after rollback, two backend instances, listener failure, and resynchronization. Prove the latency budget through the intended API ingress.
6. **Build poll creation and display.** Add the editor, snapshot queries, inline results, and loading/error/empty states. Test publish validation, preserved drafts, optional moods, ordinary posts, and visible counts before voting.
7. **Add optimistic voting and recovery.** Implement overlays, per-poll pending controls, cast/switch/remove, exact-intent Retry, revision reconciliation, and stale-result warnings. Test delayed and out-of-order responses, other votes arriving during a pending request, lost responses, disconnects, reconnects, and account changes.
8. **Validate the complete story and release.** Run `pnpm check-all` and database/SSE integration tests. Apply migrations before deploying code that requires them. Cover every acceptance criterion with named test evidence, including the one-second bound. Per repo guidance, use tests and type-checks; do not open the running browser or restart dev servers unless requested. Report browser, staging, and production checks separately and do not mark unverified acceptance criteria complete.

## Validation boundary

This document proposes the implementation; it does not claim that polls or live updates already exist. The existing project supports the chosen NestJS/Prisma/Postgres and React/TanStack patterns. Hosting support for unbuffered SSE and the measured one-second end-to-end bound are required implementation checkpoints, not unresolved product decisions. No additional product decisions are needed beyond the agreed story.
