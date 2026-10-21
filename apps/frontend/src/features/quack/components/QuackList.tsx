import { useState } from "react"
import { Loader2, RefreshCw } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

import type { Quack } from "@/features/quack/api/quackSchemas"
import { QuackItem } from "@/features/quack/components/QuackItem"

type QuackListProps = {
  isAdmin?: boolean
  currentUserId?: string
  quacks: Quack[]
  isLoading?: boolean
  error?: Error
  onReload?: () => void
}

export function QuackList({
  quacks,
  isLoading,
  error,
  onReload,
  currentUserId,
  isAdmin,
}: QuackListProps) {
  const [scope, setScope] = useState("all")
  const scopedQuacks =
    scope === "mine" ? quacks.filter((quack) => quack.userId === currentUserId) : quacks
  const [searchTerm, setSearchTerm] = useState("")
  const normalizedSearchTerm = searchTerm.trim().toLowerCase()
  const visibleQuacks = normalizedSearchTerm
    ? scopedQuacks.filter((quack) =>
        [quack.text, quack.user.name, quack.user.username].some((value) =>
          value.toLowerCase().includes(normalizedSearchTerm),
        ),
      )
    : scopedQuacks

  return (
    <div className="flex flex-col">
      <Tabs
        value={scope}
        onValueChange={setScope}
        className="mb-4"
        aria-label="Quack feed"
      >
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="mine">Mine</TabsTrigger>
        </TabsList>
      </Tabs>
      <div className="mb-4 flex flex-col gap-2">
        <label
          htmlFor="quack-search"
          className="text-sm font-medium"
        >
          Search posts
        </label>
        <Input
          id="quack-search"
          type="search"
          placeholder="Search posts or authors..."
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
        />
      </div>

      {isLoading && quacks.length === 0 ? (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
        </div>
      ) : null}

      {error ? (
        <Alert
          variant="destructive"
          className="mb-4"
        >
          <AlertTitle>Couldn&apos;t load quacks</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-3">
            <span>{error.message}</span>
            {onReload ? (
              <Button
                variant="outline"
                size="sm"
                onClick={onReload}
              >
                <RefreshCw className="size-4" />
                Reload
              </Button>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}

      {!isLoading && !error && visibleQuacks.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {normalizedSearchTerm
            ? "No posts match."
            : scope === "mine"
              ? "You haven’t posted any quacks yet."
              : "No quacks yet. Post the first one."}
          {scope === "mine" && !normalizedSearchTerm ? (
            <Button
              variant="link"
              onClick={() =>
                document.querySelector<HTMLTextAreaElement>("#quack-composer textarea")?.focus()
              }
            >
              Write your first quack
            </Button>
          ) : null}
        </p>
      ) : null}

      {visibleQuacks.map((quack) => (
        <QuackItem
          key={quack.id}
          quack={quack}
          currentUserId={currentUserId}
          isAdmin={isAdmin}
        />
      ))}
    </div>
  )
}
