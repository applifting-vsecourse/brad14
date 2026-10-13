# Polls in posts

## Story

As a signed-in user, I want to attach a question with a few answer choices to a post, cast or change my vote, and see accurate live totals, so that we can make group decisions without counting replies by hand.

This first release tests whether people use polls. Existing polls and their vote totals are sufficient for that evaluation; no separate usage report is included.

## Acceptance criteria

### Create a poll

1. In the existing post form, I can optionally attach a poll. The post text is the question, remains required, and keeps its existing 280-character limit. The existing optional mood and default mood behavior still apply. Posting without a poll works as before.
2. Before publishing, I can add, edit, or remove answer choices, and remove the poll attachment entirely. A published poll contains 2–6 answers, displayed in the order entered.
3. Each answer is trimmed of leading and trailing whitespace and must then contain 1–100 characters. Blank answers and duplicates ignoring letter case are rejected. Validation messages appear beside the affected answers; an invalid poll is not published and my draft stays intact.
4. Publishing shows a pending state and prevents repeated submission while that request is pending. A failed publication shows an error and leaves the question, answers, and mood intact so I can try again. A successful publication appears as one post with its poll in the normal feed.
5. Once published, the question and answer choices cannot be edited, and the poll cannot be closed. Voting remains open indefinitely in this release.

### Vote and view results

6. Any signed-in user, including the poll creator, can vote. Each account can have at most one active vote per poll, regardless of how many tabs or devices it uses.
7. The question, answer choices, count for each answer, and total number of votes are visible before and after voting. My current choice is visibly selected. Voter names and other people's individual selections are not exposed.
8. Clicking an unselected answer casts my first vote or switches my existing vote to that answer. Switching subtracts one from the previous answer and adds one to the new answer, without changing the total number of votes.
9. Clicking my selected answer removes my vote, clears my selection, and subtracts one from that answer and the total. Clicking it again after removal casts a new vote.
10. My selection and the displayed counts update immediately, without waiting for the vote request to finish. A visible pending indicator distinguishes this unconfirmed change. Only that poll's answer controls are temporarily disabled while it is pending; other polls remain usable.
11. After confirmation, the pending indicator disappears and the confirmed selection and counts remain. Refreshing the page preserves my confirmed vote and shows the confirmed totals.
12. With two signed-in accounts in separate browsers, concurrent votes produce the correct per-answer counts. Each count equals the number of accounts currently selecting that answer; the total equals the sum of the answer counts. Repeated submissions or retries never count one account twice, and counts never become negative.
13. If the same account changes its vote from multiple tabs or devices, the last change accepted by the server wins. All connected views converge to that selection and the same confirmed counts.

### Live updates and failures

14. In an open, connected foreground feed, a confirmed vote, switch, or removal by another user appears automatically within one second of acceptance, without a manual reload. Returning to the tab refreshes the current selection and counts.
15. If casting, switching, or removing a vote fails, my optimistic change rolls back to the last confirmed selection and counts. An inline error on that poll explains that the change was not confirmed and offers Retry. Once no request is pending and the connection is healthy, the answer controls are available again.
16. Retry attempts the same intended outcome: selecting the originally requested answer or removing the vote. It does not toggle a selection accidentally. If the earlier request was actually accepted but its response was lost, retrying still leaves one correct vote or no vote, as intended.
17. If live updates disconnect, the last confirmed results stay visible with a clear warning that they may be out of date. Voting controls are disabled. The app attempts to reconnect automatically and provides Retry for reconnecting. After reconnection, it refreshes the current selection and counts before enabling voting and removing the warning. The one-second live-update requirement applies while connected.
18. While a poll's initial results are loading, it shows a loading state and does not offer voting. If they cannot be loaded, it shows an error with Retry rather than presenting unknown totals as zero.

## In scope

- Optional polls attached to normal posts in the existing feed and composer.
- Answer validation and draft preservation after publication failures.
- One active vote per signed-in account per poll, including the creator.
- Casting, switching, and removing votes.
- Visible answer counts, total votes, and the viewer's own selection.
- Immediate feedback, pending states, rollback, and retry.
- Accurate concurrent voting, live updates, and recovery after disconnection.

## Out of scope

- Standalone poll pages or a separate question field.
- Multiple-choice voting, anonymous guest voting, or write-in answers.
- Editing published questions or answers, manual closing, and scheduled expiry.
- Voter lists, percentages, charts, and analytics or usage reports.
- Poll-specific notifications, feed ranking, or changes to existing reply behavior.

## Empty state

- A poll with no votes displays zero beside every answer, a total of zero, and “No votes yet.” Connected signed-in users can choose an answer.
- When I have not voted, no answer is selected; I can still see all counts.
- A normal post with no attached poll displays as before, without an empty poll area.
- The composer does not show poll answer fields until I choose to attach a poll. Incomplete answers are a draft validation state, not a publishable empty poll.

## Open questions

None. All product decisions above were agreed with David.
