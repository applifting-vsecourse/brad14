import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { useQueryClient, type QueryClient } from "@tanstack/react-query"

import { env } from "@/config/env"
import { authKeys } from "@/lib/auth-keys"

import {
  newestSnapshot,
  pollChangeSchema,
  pollKeys,
  readPoll,
  readPolls,
  type PollSnapshot,
} from "@/features/quack/api/polls"

type PollContextValue = {
  accountId: string
  isConnected: boolean
  errors: Record<string, string>
  reconnect: () => void
  refresh: (id: string) => Promise<boolean>
}
const PollContext = createContext<PollContextValue | null>(null)
export function usePollContext() {
  const context = useContext(PollContext)
  if (!context) throw new Error("Polls require a PollProvider")
  return context
}
export function acceptPollSnapshot(client: QueryClient, accountId: string, snapshot: PollSnapshot) {
  client.setQueryData<PollSnapshot>(pollKeys.detail(accountId, snapshot.id), (previous) =>
    newestSnapshot(previous, snapshot),
  )
}
export function PollProvider({
  accountId,
  pollIds,
  children,
}: {
  accountId: string
  pollIds: string[]
  children: ReactNode
}) {
  const client = useQueryClient()
  const [isConnected, setConnected] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [connectionAttempt, setConnectionAttempt] = useState(0)
  const [refresh, setRefresh] = useState<(id: string) => Promise<boolean>>(
    () => () => Promise.resolve(false),
  )
  const idsKey = [...new Set(pollIds)].sort().join(",")
  useEffect(() => {
    let isActive = true
    const ids = idsKey ? idsKey.split(",") : []
    const abort = new AbortController()
    const required = new Map<string, bigint>()
    const running = new Map<string, Promise<boolean>>()
    let source: EventSource | undefined
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined
    let lastHeartbeat = 0
    let isStreamReady = false
    let syncGeneration = 0
    setConnected(false)
    setErrors({})
    const clearError = (id: string) =>
      setErrors((previous) => {
        const next = { ...previous }
        delete next[id]
        return next
      })
    const refreshOne = (id: string): Promise<boolean> => {
      const existing = running.get(id)
      if (existing) return existing
      const promise = (async () => {
        try {
          for (let attempt = 0; attempt < 3; attempt++) {
            const snapshot = await readPoll(id, abort.signal)
            if (!isActive) return false
            acceptPollSnapshot(client, accountId, snapshot)
            if (BigInt(snapshot.revision) >= (required.get(id) ?? BigInt(0))) {
              clearError(id)
              return true
            }
          }
          throw new Error("Poll updates could not be confirmed")
        } catch (error) {
          if (isActive) {
            setErrors((previous) => ({
              ...previous,
              [id]: error instanceof Error ? error.message : "Could not load poll",
            }))
          }
          return false
        } finally {
          running.delete(id)
        }
      })()
      running.set(id, promise)
      return promise
    }
    setRefresh(() => refreshOne)
    const synchronize = async () => {
      const generation = ++syncGeneration
      setConnected(false)
      try {
        for (let index = 0; index < ids.length; index += 100) {
          const result = await readPolls(ids.slice(index, index + 100), abort.signal)
          if (!isActive) return
          result.polls.forEach((snapshot) => {
            acceptPollSnapshot(client, accountId, snapshot)
            clearError(snapshot.id)
          })
          result.missingIds.forEach((id) =>
            setErrors((previous) => ({ ...previous, [id]: "Poll no longer exists" })),
          )
        }
        const results = await Promise.all(
          ids
            .filter((id) => {
              const cached = client.getQueryData<PollSnapshot>(pollKeys.detail(accountId, id))
              return cached && BigInt(cached.revision) < (required.get(id) ?? BigInt(0))
            })
            .map(refreshOne),
        )
        if (isActive && isStreamReady && generation === syncGeneration) {
          setConnected(results.every(Boolean))
        }
      } catch (error) {
        if (isActive) {
          setErrors((previous) => ({
            ...previous,
            ...Object.fromEntries(
              ids.map((id) => [id, error instanceof Error ? error.message : "Could not load poll"]),
            ),
          }))
          clearTimeout(reconnectTimer)
          reconnectTimer = setTimeout(() => {
            if (isStreamReady) void synchronize()
          }, 2000)
        }
      }
    }
    const disconnect = () => {
      isStreamReady = false
      syncGeneration++
      setConnected(false)
      source?.close()
      clearTimeout(reconnectTimer)
      if (isActive) reconnectTimer = setTimeout(connect, 2000)
    }
    const connect = () => {
      if (!isActive || !accountId || !ids.length) return
      source?.close()
      source = new EventSource(`${env.VITE_API_URL.replace(/\/$/, "")}/polls/events`, {
        withCredentials: true,
      })
      source.addEventListener("ready", () => {
        lastHeartbeat = Date.now()
        isStreamReady = true
        void synchronize()
      })
      source.addEventListener("heartbeat", () => {
        lastHeartbeat = Date.now()
      })
      source.addEventListener("poll-changed", (event) => {
        let payload: unknown
        try {
          payload = JSON.parse((event as MessageEvent<string>).data) as unknown
        } catch {
          disconnect()
          return
        }
        const result = pollChangeSchema.safeParse(payload)
        if (!result.success) {
          disconnect()
          return
        }
        const { pollId, revision } = result.data
        if (!ids.includes(pollId)) return
        required.set(
          pollId,
          BigInt(revision) > (required.get(pollId) ?? BigInt(0))
            ? BigInt(revision)
            : (required.get(pollId) ?? BigInt(0)),
        )
        void refreshOne(pollId).then((didRefresh) => {
          if (!didRefresh && isActive) disconnect()
        })
      })
      source.addEventListener("auth-expired", () => {
        source?.close()
        isStreamReady = false
        setConnected(false)
        void client.invalidateQueries({ queryKey: authKeys.session() })
      })
      source.onerror = disconnect
    }
    const focus = () => {
      if (isStreamReady) void synchronize()
      else {
        clearTimeout(reconnectTimer)
        connect()
      }
    }
    const visibility = () => {
      if (document.visibilityState === "visible") focus()
    }
    const timer = setInterval(() => {
      if (isStreamReady && Date.now() - lastHeartbeat > 10000) disconnect()
    }, 1000)
    window.addEventListener("focus", focus)
    document.addEventListener("visibilitychange", visibility)
    if (accountId && ids.length) void synchronize()
    connect()
    return () => {
      isActive = false
      abort.abort()
      source?.close()
      clearTimeout(reconnectTimer)
      clearInterval(timer)
      window.removeEventListener("focus", focus)
      document.removeEventListener("visibilitychange", visibility)
    }
  }, [accountId, idsKey, client, connectionAttempt])
  useEffect(
    () => () => {
      client.removeQueries({ queryKey: pollKeys.account(accountId) })
    },
    [accountId, client],
  )
  return (
    <PollContext.Provider
      value={{
        accountId,
        isConnected,
        errors,
        refresh,
        reconnect: () => setConnectionAttempt((value) => value + 1),
      }}
    >
      {children}
    </PollContext.Provider>
  )
}
