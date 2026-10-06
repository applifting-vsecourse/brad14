import { zodResolver } from "@hookform/resolvers/zod"
import { Angry, Frown, Laugh, Loader2, Smile } from "lucide-react"
import { useForm, useWatch } from "react-hook-form"
import { z } from "zod"

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
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

import { useAddQuack } from "@/features/quack/hooks/useAddQuack"

// Mirrors the server-side DTO (MaxLength(280)) so the user is told before
// the request is made — the server still validates independently.
const MAX_LENGTH = 280

const MOOD_OPTIONS = [
  { value: "happy", label: "Happy", Icon: Smile },
  { value: "sad", label: "Sad", Icon: Frown },
  { value: "angry", label: "Angry", Icon: Angry },
  { value: "silly", label: "Silly", Icon: Laugh },
] as const

const schema = z.object({
  text: z
    .string()
    .trim()
    .min(1, "Write something first")
    .max(MAX_LENGTH, `Keep it under ${MAX_LENGTH} characters`),
  mood: z.enum(["none", "happy", "sad", "angry", "silly"]),
})

type FormValues = z.infer<typeof schema>

type QuackFormProps = { className?: string }

export function QuackForm({ className }: QuackFormProps) {
  const addQuack = useAddQuack()
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { text: "", mood: "none" },
  })

  const text = useWatch({ control: form.control, name: "text" })
  const length = text?.length ?? 0

  const handleSubmit = (values: FormValues) => {
    addQuack.mutate(
      {
        text: values.text,
        ...(values.mood !== "none" ? { mood: values.mood } : {}),
      },
      { onSuccess: () => form.reset() },
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
                    disabled={addQuack.isPending}
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
                <div
                  role="group"
                  aria-labelledby="quack-mood-label"
                  className="flex gap-2"
                >
                  {MOOD_OPTIONS.map(({ value, label, Icon }) => {
                    const isSelected = field.value === value

                    return (
                      <Button
                        key={value}
                        type="button"
                        size="icon"
                        variant={isSelected ? "secondary" : "outline"}
                        aria-label={label}
                        aria-pressed={isSelected}
                        disabled={addQuack.isPending}
                        onClick={() => field.onChange(isSelected ? "none" : value)}
                      >
                        <Icon
                          aria-hidden="true"
                          className="size-5"
                        />
                      </Button>
                    )
                  })}
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

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
            disabled={addQuack.isPending}
          >
            {addQuack.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            Quack
          </Button>
        </div>
      </form>
    </Form>
  )
}
