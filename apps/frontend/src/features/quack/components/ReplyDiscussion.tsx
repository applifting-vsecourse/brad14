import { useEffect, useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Loader2, MessageCircle, RefreshCw } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { HTTPError } from "@/lib/api-client"
import { formatDate } from "@/lib/date"

import { quackKeys } from "@/features/quack/api/quackKeys"
import { addReply, repliesQueryOptions } from "@/features/quack/api/replies"
import { DeleteQuack } from "@/features/quack/components/DeleteQuack"
import { UsersName } from "@/features/quack/components/UsersName"
import { UsersUserName } from "@/features/quack/components/UsersUserName"

const MAX_LENGTH = 280

type ReplyDiscussionProps = {
  id: string
  replyCount: number
  canReply: boolean
  currentUserId?: string
  isAdmin?: boolean
}

export function ReplyDiscussion({
  id,
  replyCount,
  canReply,
  currentUserId,
  isAdmin = false,
}: ReplyDiscussionProps) {
  const [isExpanded, setExpanded] = useState(false)
  const [draft, setDraft] = useState("")
  const [fieldError, setFieldError] = useState("")
  const shouldFocusInput = useRef(false)
  const [isLoadingVisible, setIsLoadingVisible] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const client = useQueryClient()
  const discussion = useQuery({ ...repliesQueryOptions(id), enabled: isExpanded })
  const mutation = useMutation({
    mutationFn: (text: string) => addReply(id, text),
    onSuccess: async () => {
      setDraft("")
      setFieldError("")
      await Promise.all([
        client.invalidateQueries({ queryKey: quackKeys.lists() }),
        client.invalidateQueries({ queryKey: quackKeys.discussion(id) }),
      ])
    },
  })

  useEffect(() => {
    const timer = window.setTimeout(
      () => setIsLoadingVisible(discussion.isFetching),
      discussion.isFetching ? 200 : 0,
    )
    return () => window.clearTimeout(timer)
  }, [discussion.isFetching])

  useEffect(() => {
    if (shouldFocusInput.current && !discussion.isPending) {
      inputRef.current?.focus()
      shouldFocusInput.current = false
    }
  }, [discussion.isPending])

  const expandAndFocus = () => {
    setExpanded(true)
    shouldFocusInput.current = true
  }

  const submit = () => {
    const text = draft.trim()
    if (!text) {
      setFieldError("Write a reply first")
      inputRef.current?.focus()
      return
    }
    if (text.length > MAX_LENGTH) {
      setFieldError(`Keep your reply under ${MAX_LENGTH} characters`)
      inputRef.current?.focus()
      return
    }
    setFieldError("")
    mutation.mutate(text)
  }

  const isDeletedOriginal =
    mutation.error instanceof HTTPError && mutation.error.response.status === 409

  return (
    <div className="mt-2">
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-expanded={isExpanded}
          aria-label={`${isExpanded ? "Collapse" : "Expand"} ${replyCount} replies`}
          onClick={() => setExpanded((isCurrentlyExpanded) => !isCurrentlyExpanded)}
        >
          <MessageCircle
            className="size-4"
            aria-hidden="true"
          />
          {replyCount} {replyCount === 1 ? "reply" : "replies"}
        </Button>
        {canReply ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={expandAndFocus}
          >
            Reply
          </Button>
        ) : null}
      </div>

      {isExpanded ? (
        <div className="mt-2 border-l border-border pl-4">
          {discussion.error ? (
            <Alert
              variant="destructive"
              className="mb-3"
            >
              <AlertTitle>Couldn&apos;t load replies</AlertTitle>
              <AlertDescription className="flex items-center justify-between gap-3">
                <span>{discussion.error.message}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void discussion.refetch()}
                >
                  <RefreshCw
                    className="size-4"
                    aria-hidden="true"
                  />
                  Retry
                </Button>
              </AlertDescription>
            </Alert>
          ) : null}

          {isLoadingVisible && discussion.isFetching ? (
            <div
              role="status"
              className="flex items-center gap-2 py-3 text-sm text-muted-foreground"
            >
              <Loader2
                className="size-4 animate-spin"
                aria-hidden="true"
              />
              Loading replies…
            </div>
          ) : null}

          {!discussion.isPending && !discussion.error && discussion.data?.length === 0 ? (
            <p className="py-2 text-sm text-muted-foreground">No replies yet</p>
          ) : null}

          {discussion.data?.map((reply) => (
            <article
              key={reply.id}
              className="flex items-start justify-between gap-3 border-b border-border py-3 last:border-b-0"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-2">
                  <UsersName name={reply.user.name} />
                  <UsersUserName username={reply.user.username} />
                  <time className="text-xs text-muted-foreground">
                    · {formatDate(reply.createdAt)}
                  </time>
                </div>
                <p className="mt-1 text-sm break-words whitespace-pre-line">{reply.text}</p>
              </div>
              {currentUserId === reply.userId || isAdmin ? (
                <DeleteQuack
                  id={reply.id}
                  isReply
                />
              ) : null}
            </article>
          ))}

          {canReply ? (
            <form
              noValidate
              className="space-y-2 border-t border-border py-3"
              onSubmit={(event) => {
                event.preventDefault()
                submit()
              }}
            >
              <label
                htmlFor={`reply-${id}`}
                className="text-sm font-medium"
              >
                Write a reply
              </label>
              <Textarea
                id={`reply-${id}`}
                ref={inputRef}
                rows={2}
                value={draft}
                disabled={mutation.isPending}
                aria-invalid={Boolean(fieldError)}
                aria-describedby={fieldError ? `reply-error-${id}` : undefined}
                onChange={(event) => {
                  setDraft(event.target.value)
                  if (fieldError) setFieldError("")
                  if (mutation.error) mutation.reset()
                }}
              />
              {fieldError ? (
                <p
                  id={`reply-error-${id}`}
                  role="alert"
                  className="text-sm text-destructive"
                >
                  {fieldError}
                </p>
              ) : null}
              {mutation.error ? (
                <p
                  role="alert"
                  className="text-sm text-destructive"
                >
                  {isDeletedOriginal
                    ? "This original quack has been deleted. Your reply was not posted."
                    : mutation.error.message}
                </p>
              ) : null}
              <div className="flex items-center justify-between gap-3">
                <span
                  className={
                    draft.trim().length > MAX_LENGTH
                      ? "text-sm text-destructive"
                      : "text-sm text-muted-foreground"
                  }
                >
                  {draft.trim().length}/{MAX_LENGTH}
                </span>
                <Button
                  type="submit"
                  size="sm"
                  disabled={mutation.isPending}
                >
                  {mutation.isPending ? (
                    <Loader2
                      className="size-4 animate-spin"
                      aria-hidden="true"
                    />
                  ) : null}
                  Reply
                </Button>
              </div>
            </form>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
