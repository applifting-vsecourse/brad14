import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { addQuack } from "@/features/quack/api/addQuack"
import { QuackForm } from "@/features/quack/components/QuackForm"

vi.mock("@/features/quack/api/addQuack", () => ({ addQuack: vi.fn() }))
beforeEach(() => vi.resetAllMocks())
describe("Default post mood", () => {
  it("starts with the preference, allows an override and resets to the preference after posting", async () => {
    vi.mocked(addQuack).mockResolvedValue({
      id: "q1",
      text: "Hello",
      mood: "sad",
      userId: "u1",
      user: { id: "u1", name: "Duck", username: "duck" },
      createdAt: new Date(),
    })
    const user = userEvent.setup()
    render(
      <QueryClientProvider client={new QueryClient()}>
        <QuackForm defaultMood="happy" />
      </QueryClientProvider>,
    )
    expect(screen.getByRole("button", { name: "Happy" })).toHaveAttribute("aria-pressed", "true")
    await user.click(screen.getByRole("button", { name: "Sad" }))
    await user.type(screen.getByLabelText("New quack"), "Hello")
    await user.click(screen.getByRole("button", { name: "Quack" }))
    await waitFor(() => expect(screen.getByLabelText("New quack")).toHaveValue(""))
    expect(vi.mocked(addQuack).mock.calls[0]?.[0]).toEqual({ text: "Hello", mood: "sad" })
    expect(screen.getByRole("button", { name: "Happy" })).toHaveAttribute("aria-pressed", "true")
  })
  it("loads a preference without overwriting a mood the user already selected", async () => {
    const client = new QueryClient()
    const view = (defaultMood: "none" | "silly" | "happy") => (
      <QueryClientProvider client={client}>
        <QuackForm defaultMood={defaultMood} />
      </QueryClientProvider>
    )
    const { rerender } = render(view("none"))
    rerender(view("silly"))
    expect(screen.getByRole("button", { name: "Silly" })).toHaveAttribute("aria-pressed", "true")
    await userEvent.click(screen.getByRole("button", { name: "Sad" }))
    rerender(view("happy"))
    expect(screen.getByRole("button", { name: "Sad" })).toHaveAttribute("aria-pressed", "true")
  })
})
