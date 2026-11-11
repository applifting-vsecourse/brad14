// Example component test — the pattern to copy for your own components.
import type { ReactElement } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import type { Quack } from "@/features/quack/api/quackSchemas"
import { QuackList } from "@/features/quack/components/QuackList"

const renderWithQueryClient = (ui: ReactElement) =>
  render(<QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>)

const quack = (overrides: Partial<Quack> = {}): Quack => ({
  id: "q1",
  text: "quack quack",
  userId: "u1",
  createdAt: new Date("2026-01-01T12:00:00Z"),
  user: { id: "u1", name: "Caffeinated Duck", username: "CaffeinatedDuck" },
  ...overrides,
})

describe("QuackList", () => {
  it("renders quacks with author info", () => {
    renderWithQueryClient(<QuackList quacks={[quack()]} />)

    expect(screen.getByText("quack quack")).toBeInTheDocument()
    expect(screen.getByText("Caffeinated Duck")).toBeInTheDocument()
    expect(screen.getByText("@CaffeinatedDuck")).toBeInTheDocument()
  })

  it("shows an error with a working reload button", async () => {
    const onReload = vi.fn()
    renderWithQueryClient(
      <QuackList
        quacks={[]}
        error={new Error("Server unreachable")}
        onReload={onReload}
      />,
    )

    expect(screen.getByText("Couldn't load quacks")).toBeInTheDocument()
    expect(screen.getByText("Server unreachable")).toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: /reload/i }))
    expect(onReload).toHaveBeenCalledOnce()
  })
})

it("filters Mine and offers to compose when empty", async () => {
  renderWithQueryClient(
    <QuackList
      currentUserId="u2"
      quacks={[quack()]}
    />,
  )
  await userEvent.click(screen.getByRole("tab", { name: "Mine" }))
  expect(screen.queryByText("quack quack")).not.toBeInTheDocument()
  expect(screen.getByText("You haven’t posted any quacks yet.")).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Write your first quack" })).toBeInTheDocument()
  await userEvent.click(screen.getByRole("tab", { name: "All" }))
  expect(screen.getByText("quack quack")).toBeInTheDocument()
})
