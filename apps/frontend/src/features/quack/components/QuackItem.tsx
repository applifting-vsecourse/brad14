import { useContext } from "react"
import { QueryClientContext } from "@tanstack/react-query"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { formatDate } from "@/lib/date"

import { setQuackLike } from "@/features/quack/api/likes"
import { quackKeys } from "@/features/quack/api/quackKeys"
import type { Quack } from "@/features/quack/api/quackSchemas"
import { Poll } from "@/features/quack/components/Poll"
import { UsersName } from "@/features/quack/components/UsersName"
import { UsersUserName } from "@/features/quack/components/UsersUserName"

import { DeleteQuack } from "./DeleteQuack"
import { LikeButton } from "./LikeButton"
import { ReplyDiscussion } from "./ReplyDiscussion"

type QuackItemProps = {
  quack: Quack
  currentUserId?: string
  isAdmin?: boolean
  hasDiscussionActions?: boolean
  replyCount?: number
}

export function QuackItem({
  quack,
  currentUserId,
  isAdmin = false,
  hasDiscussionActions = false,
  replyCount = 0,
}: QuackItemProps) {
  const client = useContext(QueryClientContext)
  const { name, username } = quack.user

  const initials = name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

  const updateLike = async (shouldLike: boolean, id: string) => {
    await setQuackLike(id, shouldLike)
    if (client) {
      await Promise.all([
        client.invalidateQueries({ queryKey: quackKeys.lists() }),
        client.invalidateQueries({ queryKey: quackKeys.discussion(id) }),
      ])
    }
  }

  return (
    <article className="flex w-full gap-4 border-b border-border pt-2 pb-4 last:border-b-0">
      <Avatar className="size-12">
        <AvatarFallback>{initials}</AvatarFallback>
      </Avatar>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-wrap items-baseline gap-2">
            <span>
              <UsersName name={name} /> <UsersUserName username={username} />
            </span>
            <span className="text-xs text-muted-foreground">·</span>
            <time className="text-xs text-muted-foreground">{formatDate(quack.createdAt)}</time>
            {quack.mood ? (
              <>
                <span className="text-xs text-muted-foreground">·</span>
                <span className="text-xs text-muted-foreground capitalize">{quack.mood}</span>
              </>
            ) : null}
          </div>
          {currentUserId === quack.userId || isAdmin ? (
            <DeleteQuack
              id={quack.id}
              hasReplies={replyCount > 0}
            />
          ) : null}
        </div>
        <p className="text-sm break-words whitespace-pre-line">{quack.text}</p>
        {quack.poll ? <Poll id={quack.poll.id} /> : null}
        {currentUserId ? (
          <LikeButton
            quackId={quack.id}
            likeCount={quack.likeCount ?? 0}
            likedByCurrentUser={quack.likedByCurrentUser ?? false}
            onLike={(id) => updateLike(true, id)}
            onUnlike={(id) => updateLike(false, id)}
          />
        ) : null}
        {hasDiscussionActions ? (
          <ReplyDiscussion
            id={quack.id}
            replyCount={replyCount}
            canReply
            currentUserId={currentUserId}
            isAdmin={isAdmin}
          />
        ) : null}
      </div>
    </article>
  )
}
