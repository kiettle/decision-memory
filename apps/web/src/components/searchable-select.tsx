import { useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Combobox,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
} from "@/components/ui/combobox"

export type SearchOption = { label: string; value: string }

export function SearchableSelect({
  label,
  id,
  value,
  options,
  onChange,
  className,
  disabled = false,
}: {
  label: string
  id?: string
  value: string
  options: SearchOption[]
  onChange: (value: string) => void
  className?: string
  disabled?: boolean
}) {
  const [query, setQuery] = useState("")
  // A saved/bookmarked value must remain visible even while metadata is unavailable.
  const selected = options.find((option) => option.value === value) ?? {
    value,
    label: value,
  }
  const items = options.some((option) => option.value === value)
    ? options
    : [selected, ...options]
  return (
    <Combobox
      disabled={disabled}
      items={items}
      value={selected}
      inputValue={query}
      onInputValueChange={setQuery}
      isItemEqualToValue={(a, b) => a.value === b.value}
      onOpenChange={() => setQuery("")}
      onValueChange={(next) => {
        if (next) onChange(next.value)
      }}
    >
      <ComboboxTrigger
        id={id}
        aria-label={label}
        render={<Button type="button" variant="outline" />}
        className={className ?? "h-10 max-w-full min-w-29 justify-between"}
      >
        <span className="min-w-0 truncate">{selected.label}</span>
      </ComboboxTrigger>
      <ComboboxContent aria-label={`${label} options`}>
        <ComboboxInput
          aria-label={`Search ${label.toLowerCase()}`}
          placeholder={`Search ${label.toLowerCase()}…`}
          showTrigger={false}
        />
        <ComboboxEmpty>No matching options.</ComboboxEmpty>
        <ComboboxList>
          <ComboboxGroup>
            <ComboboxListItems />
          </ComboboxGroup>
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}

// Collection consumes the root's filtered items, including keyboard navigation.
function ComboboxListItems() {
  return (
    <ComboboxCollection>
      {(option: SearchOption) => (
        <ComboboxItem key={option.value} value={option}>
          <span className="min-w-0 break-words whitespace-normal">
            {option.label}
          </span>
        </ComboboxItem>
      )}
    </ComboboxCollection>
  )
}
