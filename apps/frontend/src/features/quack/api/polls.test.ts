import { describe, expect, it } from "vitest"

import {
  newestSnapshot,
  optimisticSnapshot,
  pollDraftSchema,
  pollSnapshotSchema,
  type PollSnapshot,
} from "@/features/quack/api/polls"

const snapshot: PollSnapshot = {
  id: "p1",
  revision: "9007199254740993",
  options: [
    { id: "a", label: "Pizza", position: 0, count: 2 },
    { id: "b", label: "Soup", position: 1, count: 1 },
  ],
  totalVotes: 3,
  myOptionId: "a",
}
describe("Poll state", () => {
  it("switches a vote without changing the total or mutating the confirmed state", () => {
    const result = optimisticSnapshot(snapshot, "b")
    expect(result.options.map((option) => option.count)).toEqual([1, 2])
    expect(result.totalVotes).toBe(3)
    expect(snapshot.options.map((option) => option.count)).toEqual([2, 1])
  })
  it("removes a vote and adds a first vote accurately", () => {
    expect(optimisticSnapshot(snapshot, null).totalVotes).toBe(2)
    expect(optimisticSnapshot({ ...snapshot, myOptionId: null }, "b").totalVotes).toBe(4)
    expect(optimisticSnapshot(snapshot, "a")).toBe(snapshot)
  })
  it("orders large revisions numerically and rejects stale responses", () => {
    expect(newestSnapshot(snapshot, { ...snapshot, revision: "9007199254740992" })).toBe(snapshot)
    expect(
      newestSnapshot({ ...snapshot, revision: "9" }, { ...snapshot, revision: "10" }).revision,
    ).toBe("10")
  })
  it("recomputes the overlay against another user's newly confirmed vote", () => {
    const incoming = {
      ...snapshot,
      totalVotes: 4,
      options: snapshot.options.map((option) => ({
        ...option,
        count: option.count + (option.id === "b" ? 1 : 0),
      })),
    }
    const result = optimisticSnapshot(incoming, "b")
    expect(result.options.map((option) => option.count)).toEqual([1, 3])
    expect(result.totalVotes).toBe(4)
  })
  it("rejects inconsistent totals and choices from server responses", () => {
    expect(pollSnapshotSchema.safeParse({ ...snapshot, totalVotes: 10 }).success).toBe(false)
    expect(pollSnapshotSchema.safeParse({ ...snapshot, myOptionId: "other" }).success).toBe(false)
  })
  it("trims answer drafts, enforces bounds and identifies duplicates", () => {
    expect(
      pollDraftSchema.parse({ options: [{ label: " Pizza " }, { label: "Soup" }] }).options[0]
        ?.label,
    ).toBe("Pizza")
    for (const options of [
      [{ label: "A" }],
      [{ label: " " }, { label: "Soup" }],
      [{ label: "a".repeat(101) }, { label: "Soup" }],
      Array.from({ length: 7 }, (_, i) => ({ label: String(i) })),
    ]) {
      expect(pollDraftSchema.safeParse({ options }).success).toBe(false)
    }
    const result = pollDraftSchema.safeParse({
      options: [{ label: "Pizza" }, { label: " PIZZA " }],
    })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.issues[0]?.path).toEqual(["options", 1, "label"])
  })
})
