export const scopeHref = (scope: string) =>
  `/scopes?${new URLSearchParams({ scope })}`

export const comparisonHref = (left: string, right: string) =>
  `/compare?${new URLSearchParams({ left, right })}`

export const recordedDate = (date: string) =>
  new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(date))
