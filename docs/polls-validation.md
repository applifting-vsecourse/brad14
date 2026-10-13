# Poll implementation and validation

Implementation follows [the agreed story](../story.md) and [plan](../plan.md), with the revision/notification trigger documented in [ADR 0001](adr/0001-poll-votes-and-live-results.md).

## Commands

- `pnpm check-all`: lint, unit/component tests, type-checks, production builds, and formatting.
- `pnpm backend test:polls:integration`: real Postgres tests plus HTTP tests against an isolated Nest test server on an ephemeral loopback port. It uses `apps/backend/.env`, fails if the database or listener is unavailable, creates temporary accounts/posts, and deletes them afterward. It does not reset or seed the application database or restart the dev servers.
- CI now provisions Postgres, applies migrations, and runs the integration command in addition to existing checks. The revised CI workflow has not been run on GitHub during this implementation task.

## Acceptance evidence

| Story criteria                                                                                                       | Evidence                                                                                                                                                                                                                               |
| -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1–4: optional poll creation, answer limits, order, validation, retained failed draft, existing mood                  | `QuackForm.test.tsx`, `polls.test.ts`, `poll-validation.spec.ts`, and integration creation/HTTP validation tests.                                                                                                                      |
| 5: immutable published choices, no closing                                                                           | No poll editing/closing endpoint or UI is introduced; post text remains the existing question field.                                                                                                                                   |
| 6–9, 11–13: signed-in voting, own selection, counts, switching/removal, persistence, concurrent accounts and devices | Real database tests for simultaneous casts, idempotency, switch/removal, unique/FK constraints, highest accepted revision, and account cleanup; HTTP tests for the auth guard, strict bodies, private responses, and bulk missing IDs. |
| 10: instant response and per-poll pending controls                                                                   | Component tests check optimistic counts and selection before the request resolves, and that another poll remains enabled.                                                                                                              |
| 14: live updates and returning to the tab                                                                            | Two independent PostgreSQL listeners receive changes; HTTP SSE delivery followed by a viewer snapshot read completes locally within one second. Component tests process events, reject older snapshots, and refresh on focus.          |
| 15–16: rollback and exact-intent retries                                                                             | Component tests cover failed cast and removal, preserving another user's incoming vote, and retrying the original desired state. Database tests establish that repeated desired-state writes do not duplicate or toggle votes.         |
| 17: disconnection and reconnection                                                                                   | Component tests preserve confirmed results, disable controls, show stale-result warnings, and reconcile on Retry. Integration tests close the dedicated listener, observe SSE ending, and verify automatic database reconnection.      |
| 18 and empty states                                                                                                  | Component tests show real zero counts and “No votes yet,” loading/error behavior without invented totals, and normal posts without polls.                                                                                              |
| Account isolation                                                                                                    | Component tests clear personal caches on unmount and prevent a late response for one account from entering another account's view.                                                                                                     |

HTTP integration tests retain the real controllers, DTO validation, auth guard, repositories, and database, but supply test sessions at the BetterAuth boundary. They do not establish that the actual sign-in/session service or deployed cookie configuration works end to end.

## Release boundary

The additive poll migration has been applied locally. Existing records remain unchanged, and fresh-database seeds now include zero-vote and voted polls; the seed was not rerun against the current database.

No browser, staging, or production verification was performed. Deployment verification remains outside the local validation evidence. Before release, verify authenticated SSE through the actual API ingress, its buffering/timeouts and cookie configuration, and the agreed one-second commit-to-render bound in two connected foreground clients. Local database/HTTP measurements and component tests do not prove that deployed timing requirement.
