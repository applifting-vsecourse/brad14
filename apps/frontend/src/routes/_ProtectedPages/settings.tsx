import { useQueryClient } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"

import type { Profile } from "@/features/auth/api/profile"
import { SettingsPage } from "@/features/auth/components/SettingsPage"
import { quackKeys } from "@/features/quack/api/quackKeys"
import type { Quack, QuackFeedEntry } from "@/features/quack/api/quackSchemas"

export const Route = createFileRoute("/_ProtectedPages/settings")({ component: Page })
function Page() {
  const client = useQueryClient()
  const onSaved = async (updated: Profile) => {
    await client.cancelQueries({ queryKey: quackKeys.all() })
    client.setQueriesData<QuackFeedEntry[]>({ queryKey: quackKeys.lists() }, (quacks) =>
      quacks?.map((quack) =>
        quack.type === "quack" && quack.user.id === updated.id
          ? {
              ...quack,
              user: { ...quack.user, name: updated.name, username: updated.username ?? "" },
            }
          : quack,
      ),
    )
    client.setQueriesData<Quack[]>({ queryKey: [...quackKeys.all(), "discussion"] }, (replies) =>
      replies?.map((reply) =>
        reply.user.id === updated.id
          ? {
              ...reply,
              user: { ...reply.user, name: updated.name, username: updated.username ?? "" },
            }
          : reply,
      ),
    )
    void client.invalidateQueries({ queryKey: quackKeys.all() })
  }
  return <SettingsPage onSaved={onSaved} />
}
