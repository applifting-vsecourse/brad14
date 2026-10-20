import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { api } from "@/lib/api-client"

import { QuackItem } from "./QuackItem"

vi.mock("@/lib/api-client", () => ({ api: { delete: vi.fn().mockResolvedValue(undefined) } }))
const quack = {
  id: "q1",
  text: "Hello",
  userId: "u1",
  createdAt: new Date(),
  user: { id: "u1", name: "Duck", username: "duck" },
}

describe("quack deletion", () => {
  it("hides Delete for other authors", () => {
    render(
      <QuackItem
        quack={quack}
        currentUserId="u2"
      />,
    )
    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument()
  })
  it("waits for confirmation and allows cancellation", async () => {
    const client = new QueryClient()
    render(
      <QueryClientProvider client={client}>
        <QuackItem
          quack={quack}
          currentUserId="u1"
        />
      </QueryClientProvider>,
    )
    await userEvent.click(screen.getByRole("button", { name: "Delete" }))
    expect(api.delete).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }))
    expect(api.delete).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole("button", { name: "Delete" }))
    await userEvent.click(
      within(screen.getByRole("alertdialog")).getByRole("button", { name: "Delete" }),
    )
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith("quacks/q1"))
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument())
  })
})
