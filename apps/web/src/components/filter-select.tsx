import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export type FilterOption = { label: string; value: string }

export function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: FilterOption[]
  onChange: (value: string) => void
}) {
  const selected = options.find((option) => option.value === value)?.label
  return (
    <Select value={value} onValueChange={(next) => onChange(next ?? "ALL")}>
      <SelectTrigger className="h-10 min-w-29 rounded-lg px-3">
        <SelectValue>{value === "ALL" ? label : selected}</SelectValue>
      </SelectTrigger>
      <SelectContent align="start">
        <SelectItem value="ALL">All {label.toLowerCase()}</SelectItem>
        {options
          .filter((option) => option.value !== "ALL")
          .map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
      </SelectContent>
    </Select>
  )
}
