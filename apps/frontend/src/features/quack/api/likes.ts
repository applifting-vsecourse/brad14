import { api } from "@/lib/api-client"

export async function setQuackLike(id: string, shouldLike: boolean): Promise<void> {
  const path = `quacks/${encodeURIComponent(id)}/likes`
  if (shouldLike) await api.put(path)
  else await api.delete(path)
}
