# ADR 0003 — Store quack likes as unique user/quack rows

## Status

Accepted.

## Context

Signed-in users can like a live quack or reply once and remove their like. The author may like their own quack. The feed must show the aggregate count and whether the current user has liked each item, and both values must persist across reloads. A failed action restores the previous count and liked state. Likes from other users do not need to appear live; a feed refresh is sufficient.

Replies are ordinary `Quack` rows, so likes can reference the same model for both top-level quacks and replies. Deleting an original quack removes its `Quack` row while the separate `QuackThread` may retain a placeholder for its replies. Deleted placeholders have no likes or count.

The storage choice must enforce one like per user and quack, support removal, and provide the count and viewer-specific state. The current poll design already stores one row per user and poll and derives counts from those rows (ADR 0001).

## Decision

Store each active like as a row in a `Like` table, related to one `Quack` and one `User`. Enforce uniqueness on the `(quackId, userId)` pair. A row represents the user's current like; removing a like deletes that row. Deleting its quack or user cascades to the like row.

Derive the aggregate count from like rows and derive the current user's liked state by checking for that user's row. Do not store a separate counter on `Quack`. Treat repeated like and unlike operations as idempotent. Do not add live notifications for other users' changes; feed reload or refresh returns the latest count and viewer state.

## Options considered

- **A unique like row per user and quack, with counts derived from rows (chosen).** The database can enforce one like per pair, and the rows directly support unlike and personalized liked state. Counts always match the stored likes. Reads need an aggregate count, but this matches the established poll-vote pattern and the current requirements do not require live count updates.
- **A counter on `Quack` only (rejected).** Count reads are simple, but a counter cannot identify who liked the quack, prevent duplicate likes by one user, or remove one user's like. It does not satisfy the feature cases. Migrating later would require adding per-user rows, and the counter cannot recover which users had liked each quack.
- **Unique like rows plus a counter on `Quack` (rejected for now).** This preserves per-user identity and makes count reads cheap. Every like and unlike must update both representations atomically, and every write path must maintain the counter. A missed update can make the count drift. Adding this later remains possible by backfilling counts from like rows and then maintaining them transactionally; removing it later requires checking and retiring all counter-writing paths.

## Consequences

- **Integrity.** The compound uniqueness constraint prevents duplicate likes for the same user and quack, including concurrent requests. Foreign keys keep likes tied to existing users and quacks. Cascades remove likes when either referenced row is deleted; a retained deleted-quack placeholder has no `Quack` row and therefore no likes.
- **Reads.** Feed and reply reads must provide an aggregate like count and the current viewer's liked state. Count queries should be grouped for the quacks being returned rather than issuing one query per item. Indexes should support lookup by quack and by user.
- **Writes.** Liking inserts the user's row and unliking removes it. Repeating either operation leaves the same stored state and count. A failed request must not leave the UI showing an unconfirmed count or liked state.
- **Tradeoff and future change.** Counts require aggregation instead of a direct counter read. If measured read volume later makes that costly, a counter can be added and backfilled from the like rows while retaining those rows as the source of truth. The unique pair constraint and per-user rows remain necessary to support the product rules.
