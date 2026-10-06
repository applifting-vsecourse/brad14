import { useState } from "react"
import { Loader2, RefreshCw } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

import type { Quack } from "@/features/quack/api/quackSchemas"
import { QuackItem } from "@/features/quack/components/QuackItem"

type QuackListProps = {
  quacks: Quack[]
  isLoading?: boolean
  error?: Error
  onReload?: () => void
}

export function QuackList({ quacks, isLoading, error, onReload }: QuackListProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const normalizedSearchTerm = searchTerm.trim().toLowerCase()
  const visibleQuacks = normalizedSearchTerm
    ? quacks.filter((quack) =>
        [quack.text, quack.user.name, quack.user.username].some((value) =>
          value.toLowerCase().includes(normalizedSearchTerm),
        ),
      )
    : quacks

  return (
    <div className="flex flex-col">
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
          {normalizedSearchTerm ? "No posts match." : "No quacks yet. Post the first one."}
        </p>
      ) : null}

      {visibleQuacks.map((quack) => (
        <QuackItem
          key={quack.id}
          quack={quack}
        />
      ))}
    </div>
  )
}
