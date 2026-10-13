import { useEffect, useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Check, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import { optimisticSnapshot, pollKeys, readPoll, setPollVote } from "@/features/quack/api/polls"
import { acceptPollSnapshot, usePollContext } from "@/features/quack/components/PollProvider"

export function Poll({ id }: { id: string }) {
  const { accountId } = usePollContext()
  return (
    <PollView
      key={accountId}
      id={id}
    />
  )
}

function PollView({ id }: { id: string }) {
  const isMounted = useRef(true)
  useEffect(() => {
    isMounted.current = true
    return () => {
      isMounted.current = false
    }
  }, [])
  const { accountId, isConnected, errors, reconnect, refresh } = usePollContext()
  const client = useQueryClient()
  const query = useQuery({
    queryKey: pollKeys.detail(accountId, id),
    queryFn: () => readPoll(id),
    enabled: false,
  })
  const mutation = useMutation({
    mutationFn: (optionId: string | null) => setPollVote(id, optionId),
    onSuccess: (snapshot) => {
      if (!isMounted.current) return
      acceptPollSnapshot(client, accountId, snapshot)
      void refresh(id)
    },
    onError: () => {
      if (!isMounted.current) return
      void refresh(id)
    },
  })
  const [spinnerForRequest, setSpinnerForRequest] = useState<number | null>(null)
  useEffect(() => {
    if (!mutation.isPending) return
    const timer = window.setTimeout(() => setSpinnerForRequest(mutation.submittedAt), 200)
    return () => window.clearTimeout(timer)
  }, [mutation.isPending, mutation.submittedAt])
  const shouldShowSpinner = mutation.isPending && spinnerForRequest === mutation.submittedAt
  const confirmed = query.data
  const displayed =
    confirmed && mutation.isPending
      ? optimisticSnapshot(confirmed, mutation.variables ?? null)
      : confirmed
  if (!displayed) {
    return (
      <div className="mt-3 space-y-2">
        {errors[id] ? (
          <>
            <p
              role="alert"
              className="text-sm text-destructive"
            >
              {errors[id]}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void refresh(id)
                reconnect()
              }}
            >
              Retry
            </Button>
          </>
        ) : (
          <p
            role="status"
            className="text-sm text-muted-foreground"
          >
            Loading poll…
          </p>
        )}
      </div>
    )
  }
  return (
    <div
      className="mt-3 space-y-3"
      aria-label="Poll"
    >
      <div
        className="flex flex-col gap-2"
        role="group"
        aria-label="Poll answers"
      >
        {displayed.options.map((option) => (
          <Button
            key={option.id}
            type="button"
            variant="outline"
            className={cn(
              "relative h-auto justify-between gap-3 overflow-hidden py-2 text-left whitespace-normal",
              displayed.myOptionId === option.id &&
                "border-secondary-foreground/30 bg-secondary/40 font-semibold dark:border-secondary-foreground/30 dark:bg-secondary/40",
            )}
            aria-label={`${option.label}: ${option.count} ${option.count === 1 ? "vote" : "votes"}`}
            aria-pressed={displayed.myOptionId === option.id}
            disabled={!isConnected || mutation.isPending || Boolean(errors[id])}
            onClick={() => mutation.mutate(displayed.myOptionId === option.id ? null : option.id)}
          >
            <span
              aria-hidden="true"
              className={cn(
                "pointer-events-none absolute inset-y-0 left-0 transition-[width] duration-200 motion-reduce:transition-none",
                displayed.myOptionId === option.id ? "bg-secondary-foreground/15" : "bg-secondary",
              )}
              style={{
                width: `${displayed.totalVotes > 0 ? (option.count / displayed.totalVotes) * 100 : 0}%`,
              }}
            />
            <span className="relative flex items-center gap-2">
              {shouldShowSpinner && (mutation.variables ?? confirmed?.myOptionId) === option.id ? (
                <span
                  role="status"
                  aria-label="Saving vote"
                >
                  <Loader2
                    className="size-4 shrink-0 animate-spin"
                    aria-hidden="true"
                  />
                </span>
              ) : displayed.myOptionId === option.id ? (
                <Check
                  className="size-4 shrink-0"
                  aria-hidden="true"
                />
              ) : null}
              {option.label}
            </span>
            <span className="relative shrink-0 text-muted-foreground">{option.count}</span>
          </Button>
        ))}
      </div>
      <p className="text-sm text-muted-foreground">
        {displayed.totalVotes} {displayed.totalVotes === 1 ? "vote" : "votes"}
        {displayed.totalVotes === 0 ? " · No votes yet." : ""}
      </p>
      {mutation.isError ? (
        <div
          role="alert"
          className="space-y-2"
        >
          <p className="text-sm text-destructive">
            Your vote change was not confirmed. {mutation.error.message}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!isConnected || Boolean(errors[id])}
            onClick={() => mutation.mutate(mutation.variables ?? null)}
          >
            Retry vote
          </Button>
        </div>
      ) : null}
      {!isConnected || errors[id] ? (
        <div className="space-y-2">
          <p
            role="status"
            className={cn("text-sm", errors[id] ? "text-destructive" : "text-muted-foreground")}
          >
            {errors[id] ?? "Live updates are reconnecting. Results may be out of date."}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={reconnect}
          >
            Retry connection
          </Button>
        </div>
      ) : null}
    </div>
  )
}
