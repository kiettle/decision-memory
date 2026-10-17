import type { ReactNode } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { Decision } from "@/types"

export type MetadataFilter = "tag" | "ownerId" | "appliesTo" | "channel"
export type ApplyMetadataFilter = (field: MetadataFilter, value: string) => void

export function ownerFilter(decision: Decision) {
  return (
    decision.owner?.id ??
    decision.ownerId ??
    (decision.ownerName ? `name:${decision.ownerName}` : "UNASSIGNED")
  )
}

export function LibraryMetadataFilter({
  field,
  value,
  label,
  children,
  onFilter,
}: {
  field: MetadataFilter
  value: string
  label: string
  children: ReactNode
  onFilter: ApplyMetadataFilter
}) {
  const props = {
    "aria-label": `Filter ${label}`,
    onClick: () => onFilter(field, value),
  }
  return field === "tag" ? (
    <Badge
      variant="secondary"
      render={<button type="button" />}
      className="h-auto max-w-full min-w-0 text-left break-words whitespace-normal"
      {...props}
    >
      <span className="min-w-0 break-words whitespace-normal">{children}</span>
    </Badge>
  ) : (
    <Button
      type="button"
      variant="link"
      size="sm"
      className="h-auto max-w-full min-w-0 shrink justify-start p-0 text-left break-words whitespace-normal"
      {...props}
    >
      <span className="min-w-0 break-words whitespace-normal">{children}</span>
    </Button>
  )
}
