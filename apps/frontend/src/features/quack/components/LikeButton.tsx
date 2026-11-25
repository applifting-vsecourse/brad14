import { useEffect, useRef, useState } from "react"
import { Heart, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type LikeButtonProps = {
  quackId: string
  likeCount: number
  likedByCurrentUser: boolean
  onLike: (quackId: string) => Promise<void>
  onUnlike: (quackId: string) => Promise<void>
}

export function LikeButton({
  quackId,
  likeCount,
  likedByCurrentUser: isLikedByCurrentUser,
  onLike,
  onUnlike,
}: LikeButtonProps) {
  const [optimisticState, setOptimisticState] = useState<{
    likeCount: number
    likedByCurrentUser: boolean
  } | null>(null)
  const [isPending, setIsPending] = useState(false)
  const [requestId, setRequestId] = useState(0)
  const [spinnerForRequest, setSpinnerForRequest] = useState<number | null>(null)
  const latestRequestId = useRef(0)
  const [error, setError] = useState("")
  const state = optimisticState ?? {
    likeCount,
    likedByCurrentUser: isLikedByCurrentUser,
  }

  useEffect(() => {
    if (!isPending) return
    const timer = window.setTimeout(() => setSpinnerForRequest(requestId), 200)
    return () => window.clearTimeout(timer)
  }, [isPending, requestId])

  const toggle = async () => {
    if (isPending) return
    const previous = state
    const next = {
      likeCount: Math.max(0, previous.likeCount + (previous.likedByCurrentUser ? -1 : 1)),
      likedByCurrentUser: !previous.likedByCurrentUser,
    }
    setOptimisticState(next)
    setError("")
    latestRequestId.current += 1
    setRequestId(latestRequestId.current)
    setIsPending(true)
    try {
      if (next.likedByCurrentUser) await onLike(quackId)
      else await onUnlike(quackId)
      setOptimisticState(null)
    } catch (actionError) {
      setOptimisticState(previous)
      setError(actionError instanceof Error ? actionError.message : "Could not update like")
    } finally {
      setIsPending(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-label="Like"
        aria-pressed={state.likedByCurrentUser}
        disabled={isPending}
        onClick={() => void toggle()}
        className={cn(state.likedByCurrentUser && "text-primary")}
      >
        {isPending && spinnerForRequest === requestId ? (
          <Loader2
            className="size-4 animate-spin"
            aria-hidden="true"
          />
        ) : (
          <Heart
            className={cn("size-4", state.likedByCurrentUser && "fill-current")}
            aria-hidden="true"
          />
        )}
        <span>{state.likeCount}</span>
      </Button>
      {error ? (
        <p
          role="alert"
          className="text-sm text-destructive"
        >
          {error}
        </p>
      ) : null}
    </div>
  )
}
