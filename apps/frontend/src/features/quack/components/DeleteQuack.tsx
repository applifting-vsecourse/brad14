import { useEffect, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Loader2, Trash2 } from "lucide-react"

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { api } from "@/lib/api-client"

import { quackKeys } from "@/features/quack/api/quackKeys"

export function DeleteQuack({ id }: { id: string }) {
  const [isOpen, setOpen] = useState(false)
  const queryClient = useQueryClient()
  const deletion = useMutation({
    mutationFn: async () => {
      await api.delete(`quacks/${encodeURIComponent(id)}`)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: quackKeys.all() })
      setOpen(false)
    },
  })
  const [isPendingVisible, setShowPending] = useState(false)
  useEffect(() => {
    if (!deletion.isPending) return
    const timer = window.setTimeout(() => setShowPending(true), 200)
    return () => {
      window.clearTimeout(timer)
      setShowPending(false)
    }
  }, [deletion.isPending])
  return (
    <AlertDialog
      open={isOpen}
      onOpenChange={(isNextOpen) => {
        if (!deletion.isPending) {
          setOpen(isNextOpen)
          deletion.reset()
        }
      }}
    >
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Delete"
          title="Delete quack"
          className="shrink-0 text-muted-foreground hover:text-destructive"
        >
          <Trash2
            className="size-4"
            aria-hidden="true"
          />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this quack?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently deletes the quack and its poll, if any.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {deletion.error ? (
          <p
            role="alert"
            className="text-sm text-destructive"
          >
            Couldn’t delete this quack. Try again.
          </p>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deletion.isPending}>Cancel</AlertDialogCancel>
          <Button
            variant="destructive"
            disabled={deletion.isPending}
            onClick={() => deletion.mutate()}
          >
            {isPendingVisible ? (
              <Loader2
                className="size-4 animate-spin"
                aria-hidden="true"
              />
            ) : null}
            Delete
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
