import { formatDate } from "@/lib/date"

import type { DeletedQuackFeedEntry } from "@/features/quack/api/quackSchemas"
import { ReplyDiscussion } from "@/features/quack/components/ReplyDiscussion"

export function DeletedQuackItem({ quack }: { quack: DeletedQuackFeedEntry }) {
  return (
    <article className="flex w-full gap-4 border-b border-border pt-2 pb-4 last:border-b-0">
      <div
        aria-hidden="true"
        className="size-12 shrink-0 rounded-full border border-border"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-baseline gap-2">
          <span className="text-sm text-muted-foreground">Deleted quack</span>
          <span className="text-xs text-muted-foreground">·</span>
          <time className="text-xs text-muted-foreground">{formatDate(quack.createdAt)}</time>
        </div>
        <ReplyDiscussion
          id={quack.id}
          replyCount={quack.replyCount}
          canReply={false}
        />
      </div>
    </article>
  )
}
