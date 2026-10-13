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

describe("Poll composer", () => {
  function setupComposer() {
    render(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}
      >
        <QuackForm defaultMood="happy" />
      </QueryClientProvider>,
    )
    return userEvent.setup()
  }
  it("attaches 2–6 answers, removes rows, and removes the poll entirely", async () => {
    const user = setupComposer()
    await user.click(screen.getByRole("button", { name: "Attach poll" }))
    expect(screen.getByLabelText("Answer 1")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Remove answer 1" })).toBeDisabled()
    for (let index = 0; index < 4; index++) {
      await user.click(screen.getByRole("button", { name: "Add answer" }))
      expect(screen.getByLabelText(`Answer ${index + 3}`)).toHaveFocus()
    }
    expect(screen.getByLabelText("Answer 6")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Add answer" })).toBeDisabled()
    await user.click(screen.getByRole("button", { name: "Remove answer 3" }))
    expect(screen.queryByLabelText("Answer 6")).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Add answer" }))
    expect(screen.getByLabelText("Answer 6")).toHaveFocus()
    await user.click(screen.getByRole("button", { name: "Remove poll" }))
    expect(screen.queryByLabelText("Answer 1")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Attach poll" })).toBeEnabled()
  })
  it("validates choices, keeps a failed draft, and submits trimmed choices with the existing mood", async () => {
    vi.mocked(addQuack).mockRejectedValue(new Error("Could not publish"))
    const user = setupComposer()
    await user.type(screen.getByLabelText("New quack"), "Lunch?")
    await user.click(screen.getByRole("button", { name: "Attach poll" }))
    await user.type(screen.getByLabelText("Answer 1"), " Pizza ")
    await user.type(screen.getByLabelText("Answer 2"), " pizza ")
    await user.click(screen.getByRole("button", { name: "Quack" }))
    expect(await screen.findByText("Answers must be different")).toBeInTheDocument()
    expect(addQuack).not.toHaveBeenCalled()
    await user.clear(screen.getByLabelText("Answer 2"))
    await user.type(screen.getByLabelText("Answer 2"), " Soup ")
    await user.click(screen.getByRole("button", { name: "Quack" }))
    expect(await screen.findByText("Could not publish")).toBeInTheDocument()
    expect(screen.getByLabelText("New quack")).toHaveValue("Lunch?")
    expect(screen.getByLabelText("Answer 1")).toHaveValue(" Pizza ")
    expect(screen.getByRole("button", { name: "Happy" })).toHaveAttribute("aria-pressed", "true")
    expect(vi.mocked(addQuack).mock.calls[0]?.[0]).toEqual({
      text: "Lunch?",
      mood: "happy",
      poll: { options: ["Pizza", "Soup"] },
    })
    vi.mocked(addQuack).mockResolvedValue({
      id: "q1",
      text: "Lunch?",
      mood: "happy",
      userId: "u1",
      user: { id: "u1", username: "duck", name: "Duck" },
      createdAt: new Date(),
      poll: { id: "p1", options: [] },
    })
    await user.click(screen.getByRole("button", { name: "Quack" }))
    await waitFor(() => expect(screen.getByLabelText("New quack")).toHaveValue(""))
    expect(screen.queryByLabelText("Answer 1")).not.toBeInTheDocument()
  })
})
