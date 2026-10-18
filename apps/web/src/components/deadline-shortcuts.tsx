import { localCalendarDateAfter } from "../../../../shared/decision-deadlines.js"
import { Button } from "@/components/ui/button"

export function DeadlineShortcuts({
  onChange,
  disabled = false,
}: {
  onChange: (date: string) => void
  disabled?: boolean
}) {
  return (
    <div role="group" aria-label="Quick deadline choices" className="flex flex-wrap gap-2">
      {([["Today", 0], ["Tomorrow", 1], ["In 7 days", 7]] as const).map(([label, days]) => (
        <Button
          key={label}
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled}
          onClick={() => onChange(localCalendarDateAfter(days))}
        >
          {label}
        </Button>
      ))}
    </div>
  )
}
