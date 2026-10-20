import { useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"

import { Seo } from "@/components/Seo"

import { profileQueryOptions } from "@/features/auth/api/profile"
import { useSession } from "@/features/auth/hooks/useSession"
import { quacksQueryOptions } from "@/features/quack/api/quacksQueryOptions"
import { PollProvider } from "@/features/quack/components/PollProvider"
import { QuackForm } from "@/features/quack/components/QuackForm"
import { QuackList } from "@/features/quack/components/QuackList"

export const Route = createFileRoute("/_ProtectedPages/quacks")({
  component: QuacksPage,
})

function QuacksPage() {
  const { user } = useSession()
  const profile = useQuery(profileQueryOptions(user?.id ?? ""))
  const quacksQuery = useQuery(quacksQueryOptions())

  return (
    <>
      <Seo title="Quacks" />
      <section className="mx-auto w-full max-w-2xl px-4 py-8">
        <h1 className="mb-4 text-2xl font-semibold tracking-tight">Quacks</h1>

        <div id="quack-composer">
          <QuackForm
            className="mb-4"
            defaultMood={profile.data?.defaultMood ?? "none"}
            isProfilePending={profile.isPending}
          />
        </div>

        <PollProvider
          accountId={user?.id ?? ""}
          pollIds={(quacksQuery.data ?? []).flatMap((quack) => (quack.poll ? [quack.poll.id] : []))}
        >
          <QuackList
            currentUserId={user?.id}
            quacks={quacksQuery.data ?? []}
            isLoading={quacksQuery.isLoading}
            error={quacksQuery.error ?? undefined}
            // Only the error state offers a retry — posting invalidates the list,
            // and refocusing the tab refetches it.
            onReload={() => void quacksQuery.refetch()}
          />
        </PollProvider>
      </section>
    </>
  )
}
