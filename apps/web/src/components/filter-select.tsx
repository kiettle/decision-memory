import {
  Select,
  SelectContent,
  SelectItem,
  SelectGroup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export type FilterOption = { label: string; value: string }

export function FilterSelect({
  label,
  value,
  options,
  onChange,
  includeAll = true,
}: {
  label: string
  value: string
  options: FilterOption[]
  onChange: (value: string) => void
  includeAll?: boolean
}) {
  const selected = options.find((option) => option.value === value)?.label
  return (
    <Select value={value} onValueChange={(next) => onChange(next ?? "ALL")}>
      <SelectTrigger aria-label={label} className="h-10 min-w-29 rounded-lg px-3">
        <SelectValue>{value === "ALL" ? label : selected}</SelectValue>
      </SelectTrigger>
      <SelectContent align="start">
        <SelectGroup>
        {includeAll ? <SelectItem value="ALL">All {label.toLowerCase()}</SelectItem> : null}
        {options
          .filter((option) => option.value !== "ALL")
          .map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}
