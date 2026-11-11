# ADR 0002 — Store quack threads separately from quacks

## Status

Accepted and implemented in the replies feature.

## Context

Today, each quack is an authored post in the feed. Deleting it physically removes the row and cascades to its poll, options, and votes. Replies introduce a relationship that must survive deletion of the original quack. The original content and attribution must disappear, while the surviving replies stay grouped in the same feed position.

The storage choice affects every reader that currently treats a quack row as a top-level feed item and every deletion path that can remove one. Once replies are stored, changing the model requires migrating their thread links and preserving the identity and position of discussions whose originals have already been deleted.

## Decision

Store discussion identity in a separate `QuackThread` table and store replies as ordinary authored `Quack` rows with a nullable `replyThreadId`. Create the thread with the first successful reply. Its primary key is the original quack ID, and it records the original posting time for feed ordering. A separate nullable foreign key points to the live original.

Physically deleting the original clears the thread’s root foreign key through `ON DELETE SET NULL`. The closed thread keeps its replies and appears as a “Deleted quack” placeholder while any survive. The thread stores no copy of the original text, mood, author, or poll. The reply foreign key prevents deleting a thread that still has replies.

## Options considered

- **Separate thread table with replies stored as quacks (chosen).** Keeps text and author required on every quack, preserves physical deletion and the existing ownership and poll cascades, and gives replies a durable reference. The feed has to combine live top-level quacks with closed discussions.
- **Self-referencing quacks with a deleted placeholder row (rejected).** A parent ID on each reply would keep all feed entries in one table. A deleted original would still occupy a quack row, requiring nullable content and ownership fields and special handling wherever code assumes a quack has an author and text. Account deletion would also need a custom path to preserve parent rows that still have replies by other users.

## Consequences

- **Feed and API consumers.** Top-level quack reads must filter on `replyThreadId IS NULL`. The feed response must distinguish live quacks from placeholders. Unfiltered All merges the two entry types in chronological order. Mine and search continue to match only live top-level quacks. Poll subscriptions and cached profile updates must handle the two entry types and update reply authors where applicable.
- **Deletion and ownership.** Existing author and admin checks apply to replies. Account deletion can still cascade to that account’s own quacks and replies, while other authors’ replies keep their thread. The app must serialize reply creation, quack deletion, and empty-thread pruning for each discussion. If a direct account cascade leaves an empty anchor, feed reads exclude it.
- **Rollout.** Existing quacks remain top-level without a backfill. Roll out readers that understand the new feed shape before enabling reply writes, since old readers would show reply rows as standalone posts.
- **Future changes.** A replacement model must migrate existing reply links and carry forward thread IDs and posting times for deleted originals. Those values cannot be recovered from the original quack once its row is gone.
