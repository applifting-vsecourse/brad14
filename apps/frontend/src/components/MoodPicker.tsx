import { Angry, Frown, Laugh, Smile } from "lucide-react"

import { Button } from "@/components/ui/button"

const options = [
  { value: "happy", label: "Happy", Icon: Smile },
  { value: "sad", label: "Sad", Icon: Frown },
  { value: "angry", label: "Angry", Icon: Angry },
  { value: "silly", label: "Silly", Icon: Laugh },
] as const

type Mood = "none" | (typeof options)[number]["value"]

export function MoodPicker({
  value,
  onChange,
  disabled: isDisabled,
  labelledBy,
}: {
  value: Mood
  onChange: (value: Mood) => void
  disabled?: boolean
  labelledBy: string
}) {
  return (
    <div
      role="group"
      aria-labelledby={labelledBy}
      className="flex gap-2"
    >
      {options.map(({ value: mood, label, Icon }) => (
        <Button
          key={mood}
          type="button"
          size="icon"
          variant={value === mood ? "secondary" : "outline"}
          aria-label={label}
          aria-pressed={value === mood}
          disabled={isDisabled}
          onClick={() => onChange(value === mood ? "none" : mood)}
        >
          <Icon
            aria-hidden="true"
            className="size-5"
          />
        </Button>
      ))}
    </div>
  )
}
