export const scopeHref = (scope: string, decisionState?: "PENDING" | "DECIDED") =>
  decisionState === "PENDING"
    ? `/?${new URLSearchParams({ appliesTo: scope, status: "PENDING" })}`
    : `/scopes?${new URLSearchParams({ scope })}`

export const comparisonHref = (left: string, right: string) =>
  `/compare?${new URLSearchParams({ left, right })}`

export const recordedDate = (date: string) =>
  new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(date))

// Keep the deployed document/base path, replacing query/hash navigation only.
export function decisionUrl(id: string, location = window.location.href) {
  const url = new URL(location)
  url.search = ""
  url.hash = `/decisions/${encodeURIComponent(id)}`
  return url.href
}
