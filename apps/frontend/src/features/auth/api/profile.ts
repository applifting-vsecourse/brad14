import { queryOptions } from "@tanstack/react-query"
import { z } from "zod"

import { api } from "@/lib/api-client"

export const moodSchema = z.enum(["none", "happy", "sad", "angry", "silly"])
export const settingsSchema = z.object({
  username: z
    .string()
    .min(3, "Use at least 3 characters")
    .max(30, "Use at most 30 characters")
    .regex(/^[a-zA-Z0-9._]+$/, "Use only letters, numbers, dots and underscores"),
  name: z.string().trim().min(1, "Display name is required"),
  bio: z.string().max(160, "Use at most 160 characters for your bio"),
  defaultMood: moodSchema,
})
export type Settings = z.infer<typeof settingsSchema>
export const profileSchema = z.object({
  id: z.string(),
  username: z.string().nullable(),
  name: z.string(),
  bio: z.string(),
  defaultMood: z.enum(["happy", "sad", "angry", "silly"]).nullable(),
})
export type Profile = z.infer<typeof profileSchema>
export const profileKey = (id: string) => ["profile", id] as const
export const profileQueryOptions = (id: string) =>
  queryOptions({
    queryKey: profileKey(id),
    queryFn: async () => profileSchema.parse(await api.get("profile").json()),
    enabled: Boolean(id),
  })
export const saveProfile = async (values: Settings) =>
  profileSchema.parse(await api.put("profile", { json: values }).json())
