# Replies to quacks

## Story

As a signed-in Quacker user, I want to reply directly to a quack and read its replies beneath it, so I can follow the discussion without guessing what an @mention refers to. I can delete my own quack or reply. If I delete a quack that has replies, its content disappears and the replies stay together under a placeholder.

## Acceptance criteria

1. In the signed-in feed, a live top-level quack has a **Reply** action and a reply count. Replies start collapsed. Selecting the count expands or collapses the replies under that quack. Selecting **Reply** expands the same section and focuses the reply field. A reply has no Reply action of its own.
2. While an expanded discussion loads, it shows a loading state. If loading fails, the discussion shows an error with a retry action. With zero replies, it shows “No replies yet” and the reply form remains available on a live quack.
3. The reply form accepts plain text. After trimming surrounding whitespace, 1–280 characters are accepted. An empty or too-long reply shows a field error and keeps the draft. The form offers no mood or poll, and the account’s default mood is not applied.
4. Submitting prevents a second submission while the request is pending. On success, the new reply appears once under the correct quack and the count increases by one. On failure, the form shows an error and retains the draft for retry. Refreshing shows the saved reply with its own author and timestamp. Replies appear oldest first.
5. Replies appear inside their discussion only. Mine matches the viewer’s live top-level quacks. Search matches live top-level text, author name, and username within the current tab. A match on a reply alone does not return its discussion. Unfiltered All includes deleted threads that still have replies.
6. A reply author can delete their own reply through the existing confirmation flow. A regular user cannot delete another user’s reply. Admin deletion follows the existing quack permissions. After deletion the reply and its text are gone, the count drops, and the original and other replies remain. If the original is live and the last reply is deleted, reopening the discussion shows the empty state.
7. Confirming deletion of a live original with replies removes its text, author attribution, mood, and poll from the feed. A “Deleted quack” placeholder takes its place in the original chronological position, displays the surviving reply count, and can be expanded. The surviving replies keep their original content and authors. A confirmed deletion remains in effect after refresh, and searching for text unique to the deleted original yields no match.
8. A deleted discussion offers no reply composer. If another session deletes the original while a reply draft is open, submitting the draft is rejected with a message that the original has been deleted. The attempted reply does not appear. If a reply was saved before deletion, it remains visible.
9. Deleting an original with zero replies removes it from the feed. Deleting the final surviving reply under a deleted placeholder removes the placeholder. Refreshing does not restore either entry.

## Scope

The protected quack feed and its existing create, display, filter, and delete flows. Existing @mention-style posts stay ordinary top-level quacks. Nested replies, reply editing, reply notifications, separate discussion pages, searching replies, and live cross-session reply updates are out of scope. Refetch on tab focus and invalidate affected queries after successful mutations.

## Decisions

| Chosen option                                                        | Rejected option and why                                                                                                                                                                                                       |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Reply to original quacks only.                                       | Reply to any reply would add nested relationships and complicate loading and deletion. Adding it later cannot reconstruct the target of older replies.                                                                        |
| Keep an anonymous “Deleted quack” placeholder while replies survive. | Promoting replies to standalone feed items loses the discussion context and would require retaining extra links to regroup them later.                                                                                        |
| Replies are text only, using existing text validation.               | Optional mood adds composer controls and default-mood behavior. Full quacks with polls also add voting to discussions and would leave saved polls and votes to handle if support were withdrawn.                              |
| Close a thread when its original is deleted.                         | Continuing the discussion would leave a deleted item open for posting and introduce a race with removal of the last reply.                                                                                                    |
| Store the thread in a separate table and store replies as quacks.    | A self-referencing Quack tombstone would make content and author fields nullable and complicate the current account-to-quack cascade. The thread table allows a physical delete while preserving independent reply ownership. |
| Keep the original feed position.                                     | Ordering by the earliest surviving reply would avoid a copied timestamp, but the placeholder could move after the original or earliest reply was deleted.                                                                     |
| Filter by live top-level quacks in Mine and search.                  | Matching replies improves discovery but changes the meaning of Mine and makes search return discussions whose original does not match.                                                                                        |
| Expand replies inline on demand.                                     | Showing every reply by default would make the feed harder to scan.                                                                                                                                                            |
| Reuse the original quack ID as the thread key.                       | Generating a separate ID adds an identity lookup and would still require keeping the original sort key to preserve position on timestamp ties.                                                                                |
| Remove the placeholder after the last reply is deleted.              | Keeping an empty placeholder preserves a feed entry with no remaining discussion.                                                                                                                                             |

Replies default to oldest first. Admin permissions and query refresh behavior follow existing product conventions. The thread is created lazily with the first successful reply.

## Proposed schema

Replace the Quack model with the version below and add QuackThread. User, Poll, PollOption, and PollVote keep their existing relations. This is a proposal for `apps/backend/prisma/schema.prisma`.

```prisma
model Quack {
  id            String       @id @default(cuid())
  text          String       @db.Text
  mood          QuackMood?
  user          User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId        String
  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @default(now()) @updatedAt
  poll          Poll?
  rootOfThread  QuackThread? @relation("ThreadRoot")
  replyThread   QuackThread? @relation("ThreadReplies", fields: [replyThreadId], references: [id], onDelete: Restrict)
  replyThreadId String?

  @@index([userId])
  @@index([replyThreadId, createdAt, id])
  @@map("quack")
}

model QuackThread {
  id           String  @id
  rootQuackId  String? @unique
  rootQuack    Quack?  @relation("ThreadRoot", fields: [rootQuackId], references: [id], onDelete: SetNull)
  rootPostedAt DateTime
  replies      Quack[] @relation("ThreadReplies")

  @@map("quack_thread")
}
```

A quack with no `replyThreadId` is top-level. A thread with a null `rootQuackId` is closed and has a deleted original. Its primary key still equals the original quack ID. The write path sets the thread ID, root link, and original posting time together on first reply. It accepts replies only to a live top-level quack and takes the reply author from the session. The Prisma relations enforce referential integrity. The service enforces one reply level and the text-only reply payload.

## Model review

### 1. Queries behind the UI

1. **Live feed entries and counts.** Find quacks with `replyThreadId = null`. Include each author, existing poll metadata, and the optional thread’s reply count. A missing thread means zero replies. Sort descending by `createdAt` and then `id`.
2. **Deleted entries and counts.** Find threads with `rootQuackId = null` and at least one reply. Select the thread ID, `rootPostedAt`, and reply count. Merge these entries into unfiltered All on the same descending timestamp and ID sort. The placeholder label is fixed UI text.
3. **Mine and search.** Use the existing filters on the live feed entries. Mine checks `userId`. Search checks top-level text, author name, and username. The current client-side filter can keep using those fields from query 1.
4. **Expanded discussion.** Resolve the supplied ID to a live top-level quack or a deleted thread with surviving replies. Fetch quacks with `replyThreadId` equal to that ID, including author details, in ascending `createdAt`, then `id` order. A live original without a thread returns an empty list. The presence of a live original controls whether the composer is available. The reply query serves live and deleted discussions.
5. **Permissions and polls.** The existing session identifies the viewer and admin role. Compare that identity with each live quack’s `userId` for the delete affordance, and keep the server authorization check. Polls on live originals use their current metadata and vote reads.

### 2. Stored copies

While the original exists, its ID is stored as the thread’s key and as the nullable root foreign key. The key survives deletion and preserves the feed tie-breaker. The root foreign key represents whether the original still exists. Both are initialized together, and PostgreSQL clears the foreign key on deletion. The original posting time is copied once to `rootPostedAt` to preserve ordering after deletion. Posting times and IDs are immutable in normal application flows. Reply counts come from rows. The thread stores no copy of the original’s text, author, mood, or poll.

### 3. Related rows on deletion

- **Original quack.** Physically delete the quack row. The existing cascades remove its poll, options, and votes. The root foreign key becomes null while reply rows continue pointing to the same thread. If the thread already has zero replies, delete the empty thread as part of the same operation. An original that never had replies has no thread row.
- **Reply.** Physically delete that reply only. If it was the last reply and the root is already gone, delete the empty thread in the same operation. The thread-to-reply foreign key restricts deleting an anchor that still has replies.
- **Account cascade.** The existing User relation still deletes that account’s own quacks and replies. Quacks written by other users survive and keep their thread. A direct database account cascade can leave an empty internal anchor. The deleted-entry query excludes it, and the app has no account deletion flow in this checkout.
- **Concurrent writes.** The repository must serialize reply creation and deletion for the same discussion in transactions, rechecking that the root is live before inserting a reply and that the thread is empty before pruning it. The first reply and its anchor commit together. A reply committed before root deletion survives. Once root deletion commits, new submissions are rejected. This also covers concurrent deletion of the root and the last reply.

### 4. Migration on a populated production database

The proposed change is additive. It creates an empty thread table, adds a nullable reply foreign key to Quack, and adds supporting constraints and indexes. Existing rows have a null reply thread ID and remain top-level. Existing text, authors, moods, polls, and votes remain in place. There is no backfill, and old @mention posts are not inferred to be replies.

Apply the schema migration before deploying the new application. Coordinate the backend and frontend rollout so old readers do not display newly created reply rows as top-level quacks. Check index build and foreign-key DDL lock times against a production-sized copy before rollout.

Prisma validated the proposed schema and generated a diff containing only the new table, nullable column, indexes, and foreign keys. The SQL has yet to be applied to a populated database.

## Code placement

- **Backend** — Extend `apps/backend/src/modules/quack` through its existing controller, DTO, service, domain, and repository layers. Put discussion reads and reply creation under the existing authenticated `/api/quacks` API. Keep deletion in the existing quack delete route and enforce current author/admin permissions there. Keep the original quack composer and poll endpoints in place. Existing poll cleanup follows the database cascades.
- **Frontend** — Extend `apps/frontend/src/features/quack` and the protected quacks route. Add a reply section and text composer under the existing feed item, a placeholder variant for the feed entry, and a lazy TanStack Query for the expanded discussion. Extend the Zod feed contract and invalidate feed and discussion queries after posting or deleting. Reuse the delete confirmation with copy that explains when replies survive. Use existing controls and separators inside the feed item.
- **Existing callers** — Update the feed’s All/Mine/search handling and its poll subscriptions to read the new feed entries. Adjust the settings route’s cached author updates for live quacks and loaded replies. The public landing page uses static sample quacks, so its shared item rendering should omit discussion actions there. Authentication, profile storage, and the poll voting workflow need no new data model.

## Open questions

None.
