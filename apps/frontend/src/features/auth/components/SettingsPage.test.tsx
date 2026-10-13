import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { HTTPError } from "@/lib/api-client"
import { authKeys } from "@/lib/auth-keys"

import * as ProfileApi from "@/features/auth/api/profile"
import { SettingsForm } from "@/features/auth/components/SettingsPage"
import { useSession } from "@/features/auth/hooks/useSession"

vi.mock("@/features/auth/api/profile", async (original) => ({
  ...(await original<typeof ProfileApi>()),
  saveProfile: vi.fn(),
}))
const profile: ProfileApi.Profile = {
  id: "u1",
  username: "duck",
  name: "Duck",
  bio: "Hello",
  defaultMood: "happy",
}
function CurrentName() {
  const { user } = useSession()
  return (
    <span>
      @{user?.username} {user?.name}
    </span>
  )
}
function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } },
  })
  client.setQueryData(ProfileApi.profileKey(profile.id), profile)
  client.setQueryData(authKeys.session(), {
    user: { id: "u1", email: "duck@example.com", name: "Duck", username: "duck" },
  })
  const onSaved = vi.fn().mockResolvedValue(undefined)
  render(
    <QueryClientProvider client={client}>
      <CurrentName />
      <SettingsForm
        profile={profile}
        onSaved={onSaved}
      />
    </QueryClientProvider>,
  )
  return { client, onSaved, user: userEvent.setup() }
}
beforeEach(() => vi.resetAllMocks())
describe("Settings", () => {
  it("prefills saved values and discards all changes", async () => {
    const { user } = setup()
    expect(screen.getByRole("button", { name: "Discard changes" })).toBeDisabled()
    expect(screen.getByLabelText("Username")).toHaveValue("duck")
    expect(screen.getByRole("button", { name: "Happy" })).toHaveAttribute("aria-pressed", "true")
    await user.clear(screen.getByLabelText("Username"))
    await user.type(screen.getByLabelText("Username"), "other")
    await user.clear(screen.getByLabelText("Display name"))
    await user.type(screen.getByLabelText("Display name"), "Other")
    await user.type(screen.getByLabelText("Bio (optional)"), " changed")
    await user.click(screen.getByRole("button", { name: "Sad" }))
    expect(screen.getByRole("button", { name: "Discard changes" })).toBeEnabled()
    await user.click(screen.getByRole("button", { name: "Discard changes" }))
    expect(screen.getByRole("button", { name: "Discard changes" })).toBeDisabled()
    expect(screen.getByLabelText("Username")).toHaveValue("duck")
    expect(screen.getByLabelText("Display name")).toHaveValue("Duck")
    expect(screen.getByLabelText("Bio (optional)")).toHaveValue("Hello")
    expect(screen.getByRole("button", { name: "Happy" })).toHaveAttribute("aria-pressed", "true")
    expect(ProfileApi.saveProfile).not.toHaveBeenCalled()
  })
  it("keeps a duplicate username and shows its field error", async () => {
    vi.mocked(ProfileApi.saveProfile).mockRejectedValue(
      new HTTPError(
        new Response(null, { status: 409 }),
        new Request("http://localhost/profile"),
        {} as ConstructorParameters<typeof HTTPError>[2],
      ),
    )
    const { user } = setup()
    await user.clear(screen.getByLabelText("Username"))
    await user.type(screen.getByLabelText("Username"), "taken")
    await user.click(screen.getByRole("button", { name: "Save changes" }))
    expect(await screen.findByText("This username is already taken")).toBeInTheDocument()
    expect(screen.getByLabelText("Username")).toHaveValue("taken")
    expect(screen.getByLabelText("Username")).toHaveAttribute("aria-invalid", "true")
  })
  it("saves, confirms, updates the current identity immediately and discards to the new saved values", async () => {
    const updated = {
      ...profile,
      username: "new.duck",
      name: "New Duck",
      defaultMood: "silly" as const,
    }
    vi.mocked(ProfileApi.saveProfile).mockResolvedValue(updated)
    const { user, client, onSaved } = setup()
    await user.clear(screen.getByLabelText("Username"))
    await user.type(screen.getByLabelText("Username"), "new.duck")
    await user.clear(screen.getByLabelText("Display name"))
    await user.type(screen.getByLabelText("Display name"), "New Duck")
    await user.click(screen.getByRole("button", { name: "Silly" }))
    await user.click(screen.getByRole("button", { name: "Save changes" }))
    expect(await screen.findByText("Settings saved.")).toBeInTheDocument()
    expect(screen.getByText("@new.duck New Duck")).toBeInTheDocument()
    expect(client.getQueryData(ProfileApi.profileKey("u1"))).toEqual(updated)
    expect(onSaved).toHaveBeenCalledWith(updated)
    await user.type(screen.getByLabelText("Username"), "_edit")
    expect(screen.getByRole("button", { name: "Discard changes" })).toBeEnabled()
    await user.click(screen.getByRole("button", { name: "Discard changes" }))
    expect(screen.getByRole("button", { name: "Discard changes" })).toBeDisabled()
    expect(screen.getByLabelText("Username")).toHaveValue("new.duck")
    expect(screen.getByRole("button", { name: "Silly" })).toHaveAttribute("aria-pressed", "true")
  })
  it("validates required fields and limits the bio to 160 characters", async () => {
    const { user } = setup()
    await user.clear(screen.getByLabelText("Username"))
    await user.type(screen.getByLabelText("Username"), "a!")
    await user.clear(screen.getByLabelText("Display name"))
    await user.clear(screen.getByLabelText("Bio (optional)"))
    await user.type(screen.getByLabelText("Bio (optional)"), "a".repeat(161))
    await user.click(screen.getByRole("button", { name: "Save changes" }))
    await waitFor(() =>
      expect(screen.getByLabelText("Username")).toHaveAttribute("aria-invalid", "true"),
    )
    expect(screen.getByText("Display name is required")).toBeInTheDocument()
    expect(screen.getByLabelText("Bio (optional)")).toHaveValue("a".repeat(160))
    expect(screen.getByText("160/160 characters")).toBeInTheDocument()
    expect(ProfileApi.saveProfile).not.toHaveBeenCalled()
  })
})
