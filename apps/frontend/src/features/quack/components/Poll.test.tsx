import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import * as PollApi from "@/features/quack/api/polls"
import { Poll } from "@/features/quack/components/Poll"
import { PollProvider } from "@/features/quack/components/PollProvider"

vi.mock("@/features/quack/api/polls", async (original) => ({
  ...(await original<typeof PollApi>()),
  readPolls: vi.fn(),
  readPoll: vi.fn(),
  setPollVote: vi.fn(),
}))
const initial: PollApi.PollSnapshot = {
  id: "p1",
  revision: "0",
  options: [
    { id: "a", label: "Pizza", position: 0, count: 0 },
    { id: "b", label: "Soup", position: 1, count: 0 },
  ],
  totalVotes: 0,
  myOptionId: null,
}
class TestEventSource extends EventTarget {
  static instances: TestEventSource[] = []
  onerror: (() => void) | null = null
  isClosed = false
  constructor() {
    super()
    TestEventSource.instances.push(this)
  }
  close() {
    this.isClosed = true
  }
  emit(type: string, data: unknown = {}) {
    this.dispatchEvent(new MessageEvent(type, { data: JSON.stringify(data) }))
  }
}
function latestSource() {
  const source = TestEventSource.instances.at(-1)
  if (!source) throw new Error("Missing stream")
  return source
}
function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const view = render(
    <QueryClientProvider client={client}>
      <PollProvider
        accountId="u1"
        pollIds={["p1"]}
      >
        <Poll id="p1" />
      </PollProvider>
    </QueryClientProvider>,
  )
  act(() => latestSource().emit("ready"))
  return { client, ...view }
}
beforeEach(() => {
  vi.resetAllMocks()
  TestEventSource.instances = []
  vi.stubGlobal("EventSource", TestEventSource)
  vi.mocked(PollApi.readPolls).mockResolvedValue({ polls: [initial], missingIds: [] })
  vi.mocked(PollApi.readPoll).mockResolvedValue(initial)
})
afterEach(() => vi.unstubAllGlobals())
describe("Poll voting and live results", () => {
  it("shows zero counts before voting and updates immediately while pending", async () => {
    let finish: (value: PollApi.PollSnapshot) => void = () => undefined
    vi.mocked(PollApi.setPollVote).mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    setup()
    expect(await screen.findByText("0 votes · No votes yet.")).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Pizza: 0 votes" }).querySelector("span[aria-hidden]"),
    ).toHaveStyle({ width: "0%" })
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Pizza: 0 votes" })).toBeEnabled(),
    )
    await userEvent.click(screen.getByRole("button", { name: "Pizza: 0 votes" }))
    expect(
      screen.getByRole("button", { name: "Pizza: 1 vote" }).querySelector("span[aria-hidden]"),
    ).toHaveStyle({ width: "100%" })
    expect(screen.queryByRole("status", { name: "Saving vote" })).not.toBeInTheDocument()
    expect(await screen.findByRole("status", { name: "Saving vote" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Pizza: 1 vote" })).toContainElement(
      screen.getByRole("status", { name: "Saving vote" }),
    )
    expect(screen.getByRole("button", { name: "Pizza: 1 vote" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Soup: 0 votes" })).toBeDisabled()
    const confirmed = {
      ...initial,
      revision: "1",
      totalVotes: 1,
      myOptionId: "a",
      options: initial.options.map((option) => ({ ...option, count: option.id === "a" ? 1 : 0 })),
    }
    vi.mocked(PollApi.readPoll).mockResolvedValue(confirmed)
    await act(async () => {
      finish(confirmed)
      await Promise.resolve()
    })
    await waitFor(() =>
      expect(screen.queryByRole("status", { name: "Saving vote" })).not.toBeInTheDocument(),
    )
    expect(screen.getByRole("button", { name: "Pizza: 1 vote" })).toHaveAttribute(
      "aria-pressed",
      "true",
    )
  })
  it("rolls back a failed cast and retries the original intent", async () => {
    vi.mocked(PollApi.setPollVote).mockRejectedValue(new Error("Offline"))
    setup()
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Pizza: 0 votes" })).toBeEnabled(),
    )
    await userEvent.click(screen.getByRole("button", { name: "Pizza: 0 votes" }))
    expect(await screen.findByText(/Your vote change was not confirmed/)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Pizza: 0 votes" })).toHaveAttribute(
      "aria-pressed",
      "false",
    )
    await userEvent.click(screen.getByRole("button", { name: "Retry vote" }))
    await waitFor(() => expect(vi.mocked(PollApi.setPollVote)).toHaveBeenCalledTimes(2))
    expect(vi.mocked(PollApi.setPollVote).mock.calls).toEqual([
      ["p1", "a"],
      ["p1", "a"],
    ])
  })
  it("removes the selected vote using null and retries removal without toggling", async () => {
    const voted = {
      ...initial,
      revision: "1",
      myOptionId: "a",
      totalVotes: 1,
      options: initial.options.map((option) => ({ ...option, count: option.id === "a" ? 1 : 0 })),
    }
    vi.mocked(PollApi.readPolls).mockResolvedValue({ polls: [voted], missingIds: [] })
    vi.mocked(PollApi.readPoll).mockResolvedValue(voted)
    vi.mocked(PollApi.setPollVote).mockRejectedValue(new Error("No response"))
    setup()
    await waitFor(() => expect(screen.getByRole("button", { name: "Pizza: 1 vote" })).toBeEnabled())
    await userEvent.click(screen.getByRole("button", { name: "Pizza: 1 vote" }))
    expect(await screen.findByRole("button", { name: "Retry vote" })).toBeEnabled()
    await userEvent.click(screen.getByRole("button", { name: "Retry vote" }))
    await waitFor(() => expect(vi.mocked(PollApi.setPollVote)).toHaveBeenCalledTimes(2))
    expect(vi.mocked(PollApi.setPollVote).mock.calls).toEqual([
      ["p1", null],
      ["p1", null],
    ])
  })
  it("refreshes on events, ignores stale responses, and preserves results while disconnected", async () => {
    setup()
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Pizza: 0 votes" })).toBeEnabled(),
    )
    const incoming = {
      ...initial,
      revision: "2",
      totalVotes: 1,
      options: initial.options.map((option) => ({ ...option, count: option.id === "b" ? 1 : 0 })),
    }
    vi.mocked(PollApi.readPoll).mockResolvedValue(incoming)
    act(() => latestSource().emit("poll-changed", { pollId: "p1", revision: "2" }))
    expect(await screen.findByRole("button", { name: "Soup: 1 vote" })).toBeEnabled()
    act(() => latestSource().onerror?.())
    expect(screen.getByRole("button", { name: "Soup: 1 vote" })).toBeDisabled()
    expect(screen.getByText(/Results may be out of date/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Retry connection" }))
    act(() => latestSource().emit("ready"))
    await waitFor(() => expect(screen.getByRole("button", { name: "Soup: 1 vote" })).toBeEnabled())
    expect(PollApi.readPoll).toHaveBeenCalled()
  })
  it("reports initial load errors without inventing zero totals", async () => {
    vi.mocked(PollApi.readPolls).mockRejectedValue(new Error("Unavailable"))
    setup()
    expect(await screen.findByText("Unavailable")).toBeInTheDocument()
    expect(screen.queryByText(/No votes yet/)).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Retry" })).toBeEnabled()
  })
  it("closes the event stream on unmount and clears personal poll data", async () => {
    const { client, unmount } = setup()
    await screen.findByText("0 votes · No votes yet.")
    unmount()
    expect(latestSource().isClosed).toBe(true)
    expect(client.getQueryData(PollApi.pollKeys.detail("u1", "p1"))).toBeUndefined()
  })
})

it("keeps another person's live vote when my pending vote fails", async () => {
  let fail: (error: Error) => void = () => undefined
  vi.mocked(PollApi.setPollVote).mockImplementation(
    () =>
      new Promise((_resolve, reject) => {
        fail = reject
      }),
  )
  setup()
  await waitFor(() => expect(screen.getByRole("button", { name: "Pizza: 0 votes" })).toBeEnabled())
  await userEvent.click(screen.getByRole("button", { name: "Pizza: 0 votes" }))
  await screen.findByRole("status", { name: "Saving vote" })
  const otherVote = {
    ...initial,
    revision: "1",
    totalVotes: 1,
    options: initial.options.map((option) => ({ ...option, count: option.id === "b" ? 1 : 0 })),
  }
  vi.mocked(PollApi.readPoll).mockResolvedValue(otherVote)
  act(() => latestSource().emit("poll-changed", { pollId: "p1", revision: "1" }))
  expect(await screen.findByText("2 votes")).toBeInTheDocument()
  await act(async () => {
    fail(new Error("Vote failed"))
    await Promise.resolve()
  })
  expect(await screen.findByText(/Your vote change was not confirmed/)).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Soup: 1 vote" })).toBeEnabled()
  expect(screen.getByRole("button", { name: "Pizza: 0 votes" })).toHaveAttribute(
    "aria-pressed",
    "false",
  )
  expect(screen.getByText("1 vote")).toBeInTheDocument()
})
it("only disables the poll with a pending request", async () => {
  vi.mocked(PollApi.setPollVote).mockImplementation(() => new Promise(() => undefined))
  const second = {
    ...initial,
    id: "p2",
    options: initial.options.map((option) => ({
      ...option,
      label: option.id === "a" ? "Coffee" : "Tea",
    })),
  }
  vi.mocked(PollApi.readPolls).mockResolvedValue({ polls: [initial, second], missingIds: [] })
  render(
    <QueryClientProvider client={new QueryClient()}>
      <PollProvider
        accountId="u1"
        pollIds={["p1", "p2"]}
      >
        <Poll id="p1" />
        <Poll id="p2" />
      </PollProvider>
    </QueryClientProvider>,
  )
  act(() => latestSource().emit("ready"))
  await waitFor(() => expect(screen.getByRole("button", { name: "Pizza: 0 votes" })).toBeEnabled())
  await userEvent.click(screen.getByRole("button", { name: "Pizza: 0 votes" }))
  expect(await screen.findByRole("status", { name: "Saving vote" })).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Pizza: 1 vote" })).toContainElement(
    screen.getByRole("status", { name: "Saving vote" }),
  )
  expect(screen.getByRole("button", { name: "Pizza: 1 vote" })).toBeDisabled()
  expect(screen.getByRole("button", { name: "Coffee: 0 votes" })).toBeEnabled()
})
it("refreshes when returning to the tab and does not restore older revisions", async () => {
  setup()
  await waitFor(() => expect(screen.getByRole("button", { name: "Pizza: 0 votes" })).toBeEnabled())
  const newer = {
    ...initial,
    revision: "2",
    totalVotes: 1,
    options: initial.options.map((option) => ({ ...option, count: option.id === "b" ? 1 : 0 })),
  }
  vi.mocked(PollApi.readPoll).mockResolvedValue(newer)
  act(() => latestSource().emit("poll-changed", { pollId: "p1", revision: "2" }))
  expect(await screen.findByRole("button", { name: "Soup: 1 vote" })).toBeEnabled()
  act(() => {
    window.dispatchEvent(new Event("focus"))
  })
  await waitFor(() => expect(screen.getByRole("button", { name: "Soup: 1 vote" })).toBeEnabled())
  expect(PollApi.readPolls).toHaveBeenCalledTimes(3)
})
it("does not leak a late vote response into a different account", async () => {
  let finish: (snapshot: PollApi.PollSnapshot) => void = () => undefined
  vi.mocked(PollApi.setPollVote).mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve
      }),
  )
  const client = new QueryClient()
  const view = (accountId: string) => (
    <QueryClientProvider client={client}>
      <PollProvider
        accountId={accountId}
        pollIds={["p1"]}
      >
        <Poll id="p1" />
      </PollProvider>
    </QueryClientProvider>
  )
  const { rerender } = render(view("u1"))
  act(() => latestSource().emit("ready"))
  await waitFor(() => expect(screen.getByRole("button", { name: "Pizza: 0 votes" })).toBeEnabled())
  await userEvent.click(screen.getByRole("button", { name: "Pizza: 0 votes" }))
  await screen.findByRole("status", { name: "Saving vote" })
  rerender(view("u2"))
  act(() => latestSource().emit("ready"))
  await waitFor(() => expect(screen.getByRole("button", { name: "Pizza: 0 votes" })).toBeEnabled())
  const oldAccount = {
    ...initial,
    revision: "1",
    totalVotes: 1,
    myOptionId: "a",
    options: initial.options.map((option) => ({ ...option, count: option.id === "a" ? 1 : 0 })),
  }
  await act(async () => {
    finish(oldAccount)
    await Promise.resolve()
  })
  expect(client.getQueryData(PollApi.pollKeys.detail("u1", "p1"))).toBeUndefined()
  expect(screen.getByRole("button", { name: "Pizza: 0 votes" })).toHaveAttribute(
    "aria-pressed",
    "false",
  )
  expect(screen.queryByRole("status", { name: "Saving vote" })).not.toBeInTheDocument()
})
