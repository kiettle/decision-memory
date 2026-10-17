import { useState } from "react"

import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
  useComboboxAnchor,
} from "@/components/ui/combobox"
import { FieldDescription } from "@/components/ui/field"

export function ScopePicker({
  value,
  options,
  onChange,
}: {
  value: string[]
  options: string[]
  onChange: (value: string[]) => void
}) {
  const [query, setQuery] = useState("")
  const anchor = useComboboxAnchor()
  const candidate = query.trim()
  const known = [...new Set([...options, ...value])]
  const canAdd =
    Boolean(candidate) && candidate.length <= 200 && !known.includes(candidate)
  const items = canAdd ? [...known, candidate] : known
  const limit = value.length >= 30

  return (
    <>
      <Combobox
        multiple
        items={items}
        value={value}
        inputValue={query}
        onInputValueChange={setQuery}
        filter={(item, search) =>
          item.toLowerCase().includes(search.trim().toLowerCase())
        }
        onValueChange={(next) => {
          if (
            next.length > 30 ||
            next.some((scope) => !scope.trim() || scope.length > 200)
          )
            return
          onChange([...new Set(next)])
          setQuery("")
        }}
      >
        <ComboboxChips ref={anchor}>
          <ComboboxValue>
            {value.map((scope) => (
              <ComboboxChip key={scope} removeLabel={`Remove scope ${scope}`}>
                <span className="min-w-0 break-words whitespace-normal">
                  {scope}
                </span>
              </ComboboxChip>
            ))}
          </ComboboxValue>
          <ComboboxChipsInput
            id="appliesTo"
            aria-label="Applies To"
            aria-describedby="scope-help"
            placeholder="Find or add a scope…"
          />
        </ComboboxChips>
        <ComboboxContent anchor={anchor} aria-label="Scope options">
          <ComboboxEmpty>No matching scopes.</ComboboxEmpty>
          <ComboboxList>
            <ComboboxGroup>
              <ComboboxCollection>
                {(scope: string) => (
                  <ComboboxItem
                    key={scope}
                    value={scope}
                    disabled={limit && !value.includes(scope)}
                  >
                    <span className="min-w-0 break-words whitespace-normal">
                      {canAdd && scope === candidate ? `Add “${scope}”` : scope}
                    </span>
                  </ComboboxItem>
                )}
              </ComboboxCollection>
            </ComboboxGroup>
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
      <FieldDescription id="scope-help" aria-live="polite">
        {candidate.length > 200
          ? "Use 200 characters or fewer for a scope."
          : limit
            ? "30 scopes selected. Remove one to add another."
            : "Pick existing scopes or type a new one."}
      </FieldDescription>
    </>
  )
}
