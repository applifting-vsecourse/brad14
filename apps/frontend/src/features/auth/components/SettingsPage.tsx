import { useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useForm } from "react-hook-form"

import { MoodPicker } from "@/components/MoodPicker"
import { Seo } from "@/components/Seo"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { HTTPError } from "@/lib/api-client"
import { authKeys } from "@/lib/auth-keys"

import type { Session } from "@/features/auth/api/authSessionQueryOptions"
import {
  profileKey,
  profileQueryOptions,
  saveProfile,
  settingsSchema,
  type Profile,
  type Settings,
} from "@/features/auth/api/profile"
import { useSession } from "@/features/auth/hooks/useSession"

const valuesFor = (profile: Profile): Settings => ({
  username: profile.username ?? "",
  name: profile.name,
  bio: profile.bio,
  defaultMood: profile.defaultMood ?? "none",
})

export function SettingsPage({ onSaved }: { onSaved: (profile: Profile) => Promise<void> }) {
  const { user } = useSession()
  const profile = useQuery(profileQueryOptions(user?.id ?? ""))
  return (
    <section className="mx-auto w-full max-w-2xl px-4 py-8">
      <Seo title="Settings" />
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Settings</h1>
      {profile.isPending ? (
        <p role="status">Loading settings…</p>
      ) : profile.isError ? (
        <div role="alert">
          <p>{profile.error.message}</p>
          <Button
            variant="outline"
            onClick={() => void profile.refetch()}
          >
            Try again
          </Button>
        </div>
      ) : (
        <SettingsForm
          key={profile.data.id}
          profile={profile.data}
          onSaved={onSaved}
        />
      )}
    </section>
  )
}

export function SettingsForm({
  profile,
  onSaved,
}: {
  profile: Profile
  onSaved: (profile: Profile) => Promise<void>
}) {
  const client = useQueryClient()
  const [isSaved, setSaved] = useState(false)
  const form = useForm<Settings>({
    resolver: zodResolver(settingsSchema),
    defaultValues: valuesFor(profile),
  })
  const mutation = useMutation({
    mutationFn: saveProfile,
    onSuccess: async (updated) => {
      await Promise.all([
        client.cancelQueries({ queryKey: profileKey(updated.id) }),
        client.cancelQueries({ queryKey: authKeys.session() }),
      ])
      client.setQueryData(profileKey(updated.id), updated)
      client.setQueryData<Session>(authKeys.session(), (session) =>
        session
          ? { user: { ...session.user, name: updated.name, username: updated.username ?? "" } }
          : session,
      )
      await onSaved(updated)
      form.reset(valuesFor(updated))
      setSaved(true)
      void client.invalidateQueries({ queryKey: profileKey(updated.id) })
    },
    onError: (error) => {
      if (error instanceof HTTPError && error.response.status === 409) {
        form.setError("username", { message: "This username is already taken" })
      } else {
        form.setError("root", { message: error.message })
      }
    },
  })
  const discard = () => {
    form.reset(valuesFor(client.getQueryData<Profile>(profileKey(profile.id)) ?? profile))
    setSaved(false)
    mutation.reset()
  }
  return (
    <Form {...form}>
      <form
        noValidate
        className="space-y-6"
        onChange={() => setSaved(false)}
        onSubmit={form.handleSubmit((values) => {
          setSaved(false)
          form.clearErrors("root")
          mutation.mutate(values)
        })}
      >
        <fieldset
          disabled={mutation.isPending}
          className="space-y-6"
        >
          <FormField
            control={form.control}
            name="username"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Username</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    required
                    autoComplete="username"
                  />
                </FormControl>
                <FormDescription>
                  3–30 letters, numbers, dots or underscores. Saved in lowercase.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Display name</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    required
                    autoComplete="name"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="bio"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Bio (optional)</FormLabel>
                <FormControl>
                  <Textarea
                    {...field}
                    rows={3}
                    maxLength={160}
                  />
                </FormControl>
                <FormDescription>{field.value.length}/160 characters</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="defaultMood"
            render={({ field }) => (
              <FormItem>
                <FormLabel
                  id="default-mood-label"
                  htmlFor={undefined}
                >
                  Default mood for new posts
                </FormLabel>
                <MoodPicker
                  value={field.value}
                  labelledBy="default-mood-label"
                  disabled={mutation.isPending}
                  onChange={(mood) => {
                    field.onChange(mood)
                    setSaved(false)
                  }}
                />
                <FormDescription>Click the selected mood again to choose none.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </fieldset>
        {form.formState.errors.root ? (
          <p
            role="alert"
            className="text-sm text-destructive"
          >
            {form.formState.errors.root.message}
          </p>
        ) : null}
        {isSaved ? (
          <p
            role="status"
            className="text-sm"
          >
            Settings saved.
          </p>
        ) : null}
        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            disabled={mutation.isPending || !form.formState.isDirty}
            onClick={discard}
          >
            Discard changes
          </Button>
          <Button
            type="submit"
            disabled={mutation.isPending}
          >
            {mutation.isPending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </form>
    </Form>
  )
}
