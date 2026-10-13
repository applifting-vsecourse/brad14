# ADR 0001: poll votes and live results

Status: accepted for the first poll release.

Polls belong to quacks. The post text is the question, and published choices stay immutable. One `poll_vote` row per `(pollId, userId)` stores the active answer. Counts are derived from rows, not incremented counters.

Vote writes lock the poll row and set an explicit desired answer or `null`. Retries are idempotent; the last accepted change wins. A database trigger advances a monotonic revision and calls PostgreSQL `pg_notify` inside the same transaction. This differs slightly from the original service-managed revision proposal in `plan.md`: it also covers account deletion cascades, seeds, and other database writers. Rolled-back writes produce neither a revision change nor a notification.

Each API instance has a dedicated `LISTEN` connection and forwards committed poll IDs/revisions over one authenticated SSE stream per feed. Clients fetch personalized snapshots, so streams never disclose other voters. Reconnects perform a full snapshot refresh because PostgreSQL notifications are not a durable replay log. A broken database listener ends its SSE connections.

Frontend confirmed snapshots are account-scoped and revision-ordered. Pending votes are a separate overlay, recomputed when newer confirmed results arrive. Failure removes only that overlay, preserving other users' updates. Per-poll controls are disabled while pending or when live results cannot be confirmed.

The tradeoffs are serialized writes per poll, aggregate reads on updates, and a dedicated database connection per API instance. These are appropriate for the first release; no Redis, persisted counters, poll editing, or analytics are introduced. The one-second bound must be verified through the real API ingress before claiming production acceptance.
