import { z } from "zod"

import { api } from "@/lib/api-client"

export const pollOptionSchema = z.object({
  id: z.string(),
  label: z.string(),
  position: z.number().int().nonnegative(),
})
export const pollMetadataSchema = z.object({ id: z.string(), options: z.array(pollOptionSchema) })
export const pollSnapshotSchema = z
  .object({
    id: z.string(),
    revision: z.string().regex(/^\d+$/),
    options: z.array(pollOptionSchema.extend({ count: z.number().int().nonnegative() })),
    totalVotes: z.number().int().nonnegative(),
    myOptionId: z.string().nullable(),
  })
  .superRefine((poll, context) => {
    if (poll.totalVotes !== poll.options.reduce((total, option) => total + option.count, 0)) {
      context.addIssue({ code: "custom", message: "Poll totals are inconsistent" })
    }
    if (poll.myOptionId && !poll.options.some((option) => option.id === poll.myOptionId)) {
      context.addIssue({ code: "custom", message: "Poll choice is invalid" })
    }
  })
export type PollSnapshot = z.infer<typeof pollSnapshotSchema>
export const pollChangeSchema = z.object({
  pollId: z.string(),
  revision: z.string().regex(/^\d+$/),
})
export const pollKeys = {
  all: () => ["polls"] as const,
  account: (accountId: string) => ["polls", accountId] as const,
  detail: (accountId: string, id: string) => ["polls", accountId, id] as const,
}
export const readPoll = async (id: string, signal?: AbortSignal) =>
  pollSnapshotSchema.parse(await api.get(`polls/${id}`, { signal }).json())
export const readPolls = async (ids: string[], signal?: AbortSignal) =>
  z
    .object({ polls: z.array(pollSnapshotSchema), missingIds: z.array(z.string()) })
    .parse(await api.get("polls", { searchParams: { ids: ids.join(",") }, signal }).json())
export const setPollVote = async (id: string, optionId: string | null) =>
  pollSnapshotSchema.parse(await api.put(`polls/${id}/vote`, { json: { optionId } }).json())
export function newestSnapshot(
  previous: PollSnapshot | undefined,
  incoming: PollSnapshot,
): PollSnapshot {
  return previous && BigInt(previous.revision) > BigInt(incoming.revision) ? previous : incoming
}
export function optimisticSnapshot(confirmed: PollSnapshot, desired: string | null): PollSnapshot {
  if (desired === confirmed.myOptionId) return confirmed
  const options = confirmed.options.map((option) => ({
    ...option,
    count:
      option.count - (option.id === confirmed.myOptionId ? 1 : 0) + (option.id === desired ? 1 : 0),
  }))
  return {
    ...confirmed,
    options,
    myOptionId: desired,
    totalVotes: options.reduce((total, option) => total + option.count, 0),
  }
}

export const pollDraftSchema = z
  .object({
    options: z
      .array(
        z.object({
          label: z.string().trim().min(1, "Enter an answer").max(100, "Use at most 100 characters"),
        }),
      )
      .min(2, "Use at least 2 answers")
      .max(6, "Use at most 6 answers"),
  })
  .superRefine((poll, context) => {
    const seen = new Set<string>()
    poll.options.forEach((option, index) => {
      const label = option.label.toLowerCase()
      if (seen.has(label)) {
        context.addIssue({
          code: "custom",
          path: ["options", index, "label"],
          message: "Answers must be different",
        })
      }
      seen.add(label)
    })
  })
