import { z } from "zod"

import { pollMetadataSchema } from "@/features/quack/api/polls"

// Per the Applifting frontend playbook: validate every server payload with zod
// and infer types from the schema rather than auto-generating them.
export const quackUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  username: z.string(),
})

export const quackMoodSchema = z.enum(["happy", "sad", "angry", "silly"])
export type QuackMood = z.infer<typeof quackMoodSchema>

export const quackSchema = z.object({
  id: z.string(),
  text: z.string(),
  mood: quackMoodSchema.nullable().optional(),
  userId: z.string(),
  createdAt: z.coerce.date(),
  user: quackUserSchema,
  poll: pollMetadataSchema.nullable().optional(),
})

export const liveQuackFeedEntrySchema = quackSchema.extend({
  type: z.literal("quack"),
  replyCount: z.number().int().nonnegative(),
})

export const deletedQuackFeedEntrySchema = z.object({
  type: z.literal("deleted"),
  id: z.string(),
  createdAt: z.coerce.date(),
  replyCount: z.number().int().positive(),
})

export const quackFeedEntrySchema = z.discriminatedUnion("type", [
  liveQuackFeedEntrySchema,
  deletedQuackFeedEntrySchema,
])

export const quacksSchema = z.array(quackFeedEntrySchema)

export type Quack = z.infer<typeof quackSchema>
export type LiveQuackFeedEntry = z.infer<typeof liveQuackFeedEntrySchema>
export type DeletedQuackFeedEntry = z.infer<typeof deletedQuackFeedEntrySchema>
export type QuackFeedEntry = z.infer<typeof quackFeedEntrySchema>
