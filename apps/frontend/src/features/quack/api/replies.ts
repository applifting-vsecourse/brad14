import { queryOptions } from "@tanstack/react-query"
import { z } from "zod"

import { api } from "@/lib/api-client"

import { quackKeys } from "@/features/quack/api/quackKeys"
import { quackSchema } from "@/features/quack/api/quackSchemas"

const repliesSchema = z.array(quackSchema)

export const repliesQueryOptions = (id: string) =>
  queryOptions({
    queryKey: quackKeys.discussion(id),
    queryFn: async () =>
      repliesSchema.parse(await api.get(`quacks/${encodeURIComponent(id)}/replies`).json()),
    enabled: Boolean(id),
  })

export async function addReply(id: string, text: string) {
  return quackSchema.parse(
    await api.post(`quacks/${encodeURIComponent(id)}/replies`, { json: { text } }).json(),
  )
}
