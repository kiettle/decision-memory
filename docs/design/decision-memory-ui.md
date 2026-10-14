# Decision Memory UI Specification

Date: 2026-10-06

## Status

Accepted

## Concept Sources

- [Decision Library — desktop](concepts/decision-library-desktop.png)
- [Decision detail — desktop](concepts/decision-detail-desktop.png)
- [New Decision — desktop](concepts/new-decision-desktop.png)
- [Decision Library — mobile](concepts/decision-library-mobile.png)
- [Slack message shortcut](concepts/slack-message-shortcut.png)
- [Slack `/decide` command](concepts/slack-decide-command.png)

## Direction

Decision Memory is a restrained, retrieval-first product interface. It uses a
true-white content canvas, a light cool-gray navigation rail, deep ink text,
cobalt actions, crisp borders, and minimal elevation. The interface should feel
comfortable inside Jira without copying Jira chrome or drawing Jira's outer
navigation inside the Forge resource.

Avoid marketing layouts, decorative illustration, gradients, KPI cards, bento
grids, graph views, and nested card stacks. The visual signature is the open,
highly scannable decision list and the editorial detail page.

## Design Tokens

Initial implementation targets, subject to screenshot matching:

- Canvas: `#ffffff`.
- Navigation surface: `#f6f8fb`.
- Primary text: `#0f172a`.
- Secondary text: `#526079`.
- Border: `#d9e1ec`.
- Primary accent: `#0c66e4`.
- Primary hover: `#0055cc`.
- Active surface/text: `#dcf7e8` / `#087b4b`.
- Superseded surface/text: `#fff1cc` / `#9a5b00`.
- Selected navigation: `#e9f2ff`.
- Tags: pale blue or neutral gray semantic variants.
- Radius: 8px controls, 10px compact panels, pills only for statuses and tags.
- Border width: 1px.
- Shadow: overlays only; list and page structure rely on borders and whitespace.
- Spacing scale: 4, 8, 12, 16, 24, 32, 40px.
- Motion: 120–180ms for hover, filter, drawer, and modal state; respect reduced
  motion.

## Typography

- Use a modern system sans stack compatible with Jira and Slack embedding.
- Page title: 32px desktop, 28px mobile, 700 weight, tight but readable line
  height.
- Decision title: 16px list, 34px detail, 650–700 weight.
- Body: 14–16px, 1.45–1.6 line height.
- UI controls: deliberate 14px medium treatment; never browser-default sizing.
- Metadata: 12–14px with strong contrast; do not shrink evidence or lifecycle
  links below readable size.

## App Shell

Desktop:

- 228px fixed left rail.
- Decision Memory mark at the top.
- Navigation: Decisions, Scopes, Recent, Settings.
- Workspace and current user at the bottom.
- Main content uses a fluid canvas with a 40px desktop gutter.

Mobile:

- No squeezed sidebar.
- Compact product bar with mark and current-user menu.
- Page actions remain visible near the title and search.
- Filters collapse behind one button; sort remains compact.

## Decision Library

Required copy and controls:

- `Decision Library`
- `New Decision`
- Search placeholder:
  `Search decisions, context, teams, or captured discussion...`
- Filters: Team, Owner, Tag, Status, Applies To, Date Range.
- `Clear filters`
- Result count.
- Sort: `Newest first`.

Use an open list/table hybrid on desktop. Preserve columns for Status, Decision,
Applies to, Why, Team, Owner, Evidence, and Date. Rows are clickable and use
separators rather than floating cards. On mobile each row becomes one open stack
with status, date, ID, title, Applies To, Why, team, tags, evidence, and lifecycle
links.

## Decision Detail

Use an editorial main column and compact metadata rail. Required sections:

- Decision;
- Why;
- Context;
- Options Considered;
- Relevant Discussion;
- Applies To;
- Owner, Team, Tags, Created;
- Sources;
- Related Work;
- Lifecycle.

The page must remain understandable if the Slack source is unavailable. Captured
messages use simple rows with author, timestamp, message text, and an anchor
indicator. Do not introduce a graph.

## Create And Edit

Only Decision is required. Why, Context, Applies To, Owner, Team, Tags, related
work, and source URL are optional. Use a two-column layout where it reduces
scrolling without separating related content. Keep Cancel and Save Decision in a
stable bottom action area.

## Components

Use shadcn/ui components where they fit and compose them without restyling their
internals ad hoc:

- Button;
- Input and Textarea;
- FieldGroup and Field;
- Select or Combobox;
- Badge;
- Avatar with fallback;
- Popover and Command for filters/searchable selection;
- Dialog or Sheet for responsive filters and lifecycle actions;
- AlertDialog for destructive confirmation;
- Separator;
- Skeleton;
- Empty;
- Sonner for success/error feedback.

Lists and editorial sections should remain semantic custom composition rather
than being forced into Card components.

## Icon Inventory

Use one thin-stroke icon family consistently:

- Decision document / product mark;
- Search;
- Plus;
- Clock / Recent;
- Settings;
- Building / workspace;
- User and team;
- Tag;
- Calendar;
- Package/component for Applies To;
- Slack and Jira brand marks;
- Chevron-right and chevron-down;
- Pencil / Edit;
- Ellipsis;
- External link;
- Link and document;
- Lifecycle/supersession.

Icons inside buttons inherit component sizing and use the component's icon slot.

## Slack Surfaces

Slack capture uses native Block Kit rather than the web design system. The two
entry points share field order and submission behavior:

- message shortcut: captured source summary, anchor quote, and thread count;
- `/decide`: channel/user summary and explicit `No Slack message thread is
  attached.` message.

Only Decision is required. Footer notes describe exactly what source information
will be stored. Both end with Cancel and Save.

## Interaction Inventory

- Search updates the result set without losing active filters.
- Filters can be combined and cleared.
- Selecting a row opens Decision detail.
- New Decision opens the creation route.
- Save validates Decision, persists, shows success feedback, and navigates to
  detail.
- Edit reuses the form with populated values.
- Supersede selects an eligible active Decision, updates both records, and shows
  bidirectional lifecycle links.
- Source and related-work actions open external URLs safely.
- Mobile filters open in a sheet and preserve the result count.

## Fidelity Gates

- True-white canvas remains true white.
- Desktop list remains a table/list, never a card grid.
- Only Decision is required in create and Slack capture forms.
- No outer Jira navigation is implemented inside the app resource.
- No invented navigation items, KPI panels, graph, AI control, or decorative
  content.
- Desktop and mobile screenshots must be compared directly with the accepted
  concepts before handoff.


## Decision understanding extension — 2026-10-12

Approved in the owner's feature request. Extend the existing restrained design:

- Library actions expose Explore scopes and Compare decisions on desktop/mobile.
- Replacement confirmation previews the earlier and replacing choice and adds
  an optional What changed field. The recorded reason appears with lifecycle.
- Comparison uses two editorial columns on desktop and stacks the complete
  records on mobile; links lead to saved evidence and scope overviews.
- Scope directory and active decisions use open rows, not dashboard KPI cards.
  Replacement history is chronological with human-written explanations.
- Existing buttons, fields, selects, dialogs, empty states and loading patterns
  remain the component vocabulary. All new routes have explicit failure/retry
  states and fit a 390px viewport.

## Dual memory search extension — 2026-10-13

Owner-approved: show separate local **Search by memory** and **Search with Gemini**
actions next to the same query/filters. Disclose Gemini's query/candidate transfer
and approximate ranking beside its action. Identify the chosen provider in
results; explain Gemini's newest-200 filtered cap separately from local indexing
coverage. Keep disabled configuration, loading, retry/fallback, cached navigation
and stale-response behavior clear on desktop and mobile.

## Deadline views extension — 2026-10-14

Owner-approved: retain Flat by default and add Kanban using the same records,
search and filters. This explicitly permits compact board cards alongside the
existing open flat rows. Use one visible All/Pending/Decided/Superseded Status
filter. Pending question, direct recorded choice and completion each require
one text field. Optional creation details collapse under More details. Dates and
owners remain optional. Preserve the original question when recording an outcome.

Board columns: Overdue, Due soon (today through +7), Upcoming, No deadline,
Decided. Group automatically using the viewer's local date. Exact dates accompany
textual urgency; completed deadlines are historical. Show full filtered counts;
Decided initially shows ten and reveals ten more per Show more. Keep mobile
horizontal scrolling inside the board. Flat/Kanban switches preserve URL filters,
sort and cached memory results. Use accessible date/completion dialogs and retain
drafts on failed saves. No dragging or scheduled reminders.
