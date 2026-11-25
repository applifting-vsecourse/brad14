import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { LikeButton } from "./LikeButton"

describe("like action failure — cases.md", () => {
  it("RULE-08: restores count and selected state and shows an error when unlike fails", async () => {
    const user = userEvent.setup()
    const onLike = vi.fn().mockResolvedValue(undefined)
    const onUnlike = vi.fn().mockRejectedValue(new Error("Could not remove like"))
    let renderError: unknown

    try {
      render(
        <LikeButton
          quackId="quack-1"
          likeCount={1}
          likedByCurrentUser
          onLike={onLike}
          onUnlike={onUnlike}
        />,
      )
    } catch (error) {
      renderError = error
    }
    expect(renderError).toBeUndefined()

    const button = screen.getByRole("button", { name: /like/i })
    await user.click(button)
    expect(onUnlike).toHaveBeenCalledWith("quack-1")
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("Could not remove like"),
    )
    expect(button).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByText("1", { exact: true })).toBeInTheDocument()
  })
})
