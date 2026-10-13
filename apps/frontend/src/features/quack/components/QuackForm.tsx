import { useEffect, useRef } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2, Plus, X } from "lucide-react"
import { useForm, useWatch, type FieldPath } from "react-hook-form"
import { z } from "zod"

import { MoodPicker } from "@/components/MoodPicker"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { HTTPError } from "@/lib/api-client"
import { cn } from "@/lib/utils"

import { pollDraftSchema } from "@/features/quack/api/polls"
import { useAddQuack } from "@/features/quack/hooks/useAddQuack"

// Mirrors the server-side DTO (MaxLength(280)) so the user is told before
// the request is made — the server still validates independently.
const MAX_LENGTH = 280

const schema = z.object({
  text: z
    .string()
    .trim()
    .min(1, "Write something first")
    .max(MAX_LENGTH, `Keep it under ${MAX_LENGTH} characters`),
  mood: z.enum(["none", "happy", "sad", "angry", "silly"]),
  poll: pollDraftSchema.optional(),
})

type FormValues = z.infer<typeof schema>

type QuackFormProps = {
  className?: string
  defaultMood?: FormValues["mood"]
  isProfilePending?: boolean
}

export function QuackForm({
  className,
  defaultMood = "none",
  isProfilePending = false,
}: QuackFormProps) {
  const addQuack = useAddQuack()
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { text: "", mood: defaultMood },
  })

  const { resetField, getFieldState, setFocus } = form
  const pendingAnswerFocus = useRef<number | null>(null)
  useEffect(() => {
    if (!getFieldState("mood").isDirty) resetField("mood", { defaultValue: defaultMood })
  }, [defaultMood, resetField, getFieldState])

  const text = useWatch({ control: form.control, name: "text" })
  const length = text?.length ?? 0
  const poll = useWatch({ control: form.control, name: "poll" })

  useEffect(() => {
    const index = pendingAnswerFocus.current
    if (index !== null && poll && index < poll.options.length) {
      setFocus(`poll.options.${index}.label`)
      pendingAnswerFocus.current = null
    }
  }, [poll, setFocus])

  const handleSubmit = (values: FormValues) => {
    addQuack.mutate(
      {
        text: values.text,
        ...(values.poll
          ? { poll: { options: values.poll.options.map((option) => option.label) } }
          : {}),
        ...(values.mood !== "none" ? { mood: values.mood } : {}),
      },
      {
        onSuccess: () => form.reset({ text: "", mood: defaultMood, poll: undefined }),
        onError: (error) => {
          if (error instanceof HTTPError) {
            void error.response
              .clone()
              .json()
              .then((body: unknown) => {
                const result = z
                  .object({
                    fieldErrors: z.array(z.object({ field: z.string(), message: z.string() })),
                  })
                  .safeParse(body)
                if (result.success) {
                  result.data.fieldErrors.forEach(({ field, message }) => {
                    if (/^poll\.options\.\d+$/.test(field)) {
                      form.setError(`${field}.label` as FieldPath<FormValues>, { message })
                    } else if (field === "poll.options") {
                      form.setError("poll.options", { message })
                    }
                  })
                }
              })
              .catch(() => undefined)
          }
        },
      },
    )
  }

  return (
    <Form {...form}>
      <form
        noValidate
        onSubmit={form.handleSubmit(handleSubmit)}
        className={cn("space-y-3", className)}
      >
        {addQuack.error ? (
          <Alert variant="destructive">
            <AlertDescription>{addQuack.error.message}</AlertDescription>
          </Alert>
        ) : null}

        <div className="space-y-3">
          <FormField
            control={form.control}
            name="text"
            render={({ field }) => (
              <FormItem className="flex-1">
                <FormLabel>New quack</FormLabel>
                <FormControl>
                  <Textarea
                    rows={3}
                    placeholder="Quack something..."
                    disabled={addQuack.isPending || isProfilePending}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="mood"
            render={({ field }) => (
              <FormItem>
                <FormLabel
                  id="quack-mood-label"
                  htmlFor={undefined}
                >
                  Mood (optional)
                </FormLabel>
                <MoodPicker
                  value={field.value}
                  labelledBy="quack-mood-label"
                  disabled={addQuack.isPending || isProfilePending}
                  onChange={field.onChange}
                />
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {poll ? (
          <fieldset
            disabled={addQuack.isPending || isProfilePending}
            className="space-y-3"
          >
            <legend className="mb-3 text-sm font-medium">Poll answers</legend>
            {poll.options.map((_option, index) => (
              <div
                key={index}
                className="flex items-start gap-2"
              >
                <FormField
                  control={form.control}
                  name={`poll.options.${index}.label`}
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormLabel>Answer {index + 1}</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove answer ${index + 1}`}
                  className="mt-6"
                  disabled={poll.options.length <= 2}
                  onClick={() => {
                    form.clearErrors("poll")
                    form.setValue(
                      "poll.options",
                      poll.options.filter((_item, itemIndex) => itemIndex !== index),
                      { shouldDirty: true },
                    )
                  }}
                >
                  <X
                    className="size-4"
                    aria-hidden="true"
                  />
                </Button>
              </div>
            ))}
            {(form.formState.errors.poll?.options?.root?.message ??
            form.formState.errors.poll?.options?.message) ? (
              <p
                role="alert"
                className="text-sm text-destructive"
              >
                {form.formState.errors.poll?.options?.root?.message ??
                  form.formState.errors.poll?.options?.message}
              </p>
            ) : null}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={poll.options.length >= 6}
                onClick={() => {
                  pendingAnswerFocus.current = poll.options.length
                  form.setValue("poll.options", [...poll.options, { label: "" }], {
                    shouldDirty: true,
                  })
                }}
              >
                <Plus
                  className="size-4"
                  aria-hidden="true"
                />
                Add answer
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  form.setValue("poll", undefined, { shouldDirty: true })
                  form.clearErrors("poll")
                }}
              >
                Remove poll
              </Button>
            </div>
          </fieldset>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={addQuack.isPending || isProfilePending}
            onClick={() =>
              form.setValue(
                "poll",
                { options: [{ label: "" }, { label: "" }] },
                { shouldDirty: true },
              )
            }
          >
            <Plus
              className="size-4"
              aria-hidden="true"
            />
            Attach poll
          </Button>
        )}

        <div className="flex items-center justify-end gap-3">
          <span
            className={cn(
              "text-sm",
              length > MAX_LENGTH ? "text-destructive" : "text-muted-foreground",
            )}
          >
            {length}/{MAX_LENGTH}
          </span>
          <Button
            type="submit"
            size="sm"
            disabled={addQuack.isPending || isProfilePending}
          >
            {addQuack.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            Quack
          </Button>
        </div>
      </form>
    </Form>
  )
}
