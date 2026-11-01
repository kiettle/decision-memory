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

### Everyday polish — 2026-10-29

Owner-authorized refinement retains the existing white/cobalt/Geist system.
On phones, bring the capture input ahead of optional pasted notes and routine
draft explanation; keep recoverable drafts/storage errors prominent and Save
fixed in view. Primary controls and popup triggers have 44px phone targets;
inline metadata remains compact. Use sentence-case contextual labels.

Library loading announces its status and marks the results region busy. Replace
records with placeholders shaped like recent rows; placeholders do not count as
records. Failed loads say Unavailable, preserve query/filters and put Retry before
secondary capture actions. Only completed no-match results may say no matches;
neither failure nor loading implies an unanswered question. Manual question
capture remains available after a failed search. Successful results keep current
answer evidence and secondary capture/proposal actions in compact disclosures.

Exact Applies To scope sits beside the choice, before rationale and history.
Scope briefs group choice/reason and owner/contact context; evidence remains
inspectable in a named disclosure, with replacement reasons/record links retained.
The full current list links back to curated brief entries instead of repeating
their full prose. Brief jumps scroll and focus without changing HashRouter's URL.
Changes pairs the previous and recorded choice for scanning. Existing restrained
motion and reduced-motion support remain; no decorative entrance sequence.

### Contest polish — 2026-11-01

Owner-approved restyle from a taste-skill review (`design-taste-frontend`, app
style "achromatic ledger", seed 1225471516, brand palette and Geist kept). This
section supersedes the token values below where they differ.

- **Colour on data, not chrome.**
  - Ink `#171717`; grey text `#5c5c5c`; borders `#e5e5e5`.
  - Sidebar `#fafafa` with a neutral grey active pill (`#ebebeb`).
  - The one filled primary per screen is near-black.
  - Cobalt `#0c66e4` stays only for links, the brand mark, the pending status,
    and the main data element (the current choice in a lineage strip; the
    choices and open bars on the dashboard).
  - Overdue uses the destructive red. Overlays have no blur.
- **One canvas.** Every page starts on the same left edge, at most 1240px wide.
  The h1 is 24px semibold, with no small label above it. Subtitles describe the
  data, not the interface.
- **Navigation.** Decisions, Check a proposal, Team memory, Scopes, Changes and
  Settings. Recent left the nav; the `/recent` route still works. The unread
  count appears as "Changes 3", and the workspace name sits under the mark.
- **Signature element: the decision lineage strip**
  (`components/decision-lineage.tsx`).
  - It shows the earlier choice in grey, then an arrow, then the current choice,
    with a 3px cobalt edge, and the stored "Why it changed".
  - A replacement that was itself replaced is labelled "Later replaced" without
    the hue.
  - It appears in the proposal verdict, Detail "Why did this change?", scope
    history and the proposal page's "Choices the team changed recently".
- **Proposal review.**
  - On screens of 1280px and wider, the form sits beside the results, so the
    verdict is on the first screen.
  - The verdict ("A similar choice was replaced") is the largest block.
  - Before a check, three one-click synthetic examples and the latest
    replacements fill the results column.
- **Library.** The status and key share one line. Tags move to the metadata
  line. A pending row keeps its deadline and its two actions on one line.
  Metadata links are ink, not blue. Find by meaning is an outline button.
- **Detail.** Copy summary, Copy link, Compare, Jira and Supersede are quiet
  text actions beside Edit, and fold under More actions below 1024px. The
  "How to reach the owner" row appears only when one is recorded.
- **Dashboard.** See [the product contract](../product/dashboard.md).
  - A 12-column grid with a 16px gutter: 7 + 5 columns (654 + 16 + 462 = 1132px
    at 1440).
  - Questions and search gaps lead the first screen. The trend chart and the
    most consulted decisions sit below.
  - "About these figures" is a quiet footer with the collection switch.
- **Inspector.** `inspect.mjs --app` at 1440/768/390 gives 0 FAIL on Library,
  Detail, Proposal and Dashboard. Two warnings remain, both defended:
  - **Dev server:** the gate ran on Vite dev, and the production build passed
    separately.
  - **Proposal blank space before a check:** this is the screen's one rest, and
    the verdict fills it once a check runs.

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

Use a compact open list at desktop and mobile widths, with separators rather
than floating cards. Show status, choice, ID, tags and optional rationale first;
wrap scope, owner, created date and available channel/evidence metadata together.
Title links open full detail independently from pending-record action buttons.
Omit empty channel/source/rationale placeholders from this scanning view.

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
- Selecting a record title opens Decision detail; pending actions remain independent.
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

- Library actions expose Compare decisions; scopes open from navigation (the library Explore scopes button was removed on 2026-10-17).
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

Owner-approved (updated 2026-10-16): show primary local **Find by meaning** and
secondary **Search with Gemini** inside a compact **Search options** disclosure. Disclose Gemini's query/candidate transfer
and approximate ranking beside its action. Identify the chosen provider in
results; explain Gemini's newest-200 filtered cap separately from local indexing
coverage. Keep disabled configuration, loading, retry/fallback, cached navigation
and stale-response behavior clear on desktop and mobile.

## Deadline views extension — 2026-10-14

Owner-approved: retain Flat by default and add Kanban using the same records,
search and filters. This explicitly permits compact board cards alongside the
existing open flat rows. Keep All/Pending/Decided/Superseded Status
available in More filters. Pending question, direct recorded choice and completion each require
one text field. Optional creation details collapse under More details. Dates and
owners remain optional. Preserve the original question when recording an outcome.

Board columns: Overdue, Due soon (today through +7), Upcoming, No deadline,
Decided. Group automatically using the viewer's local date. Exact dates accompany
textual urgency; completed deadlines are historical. Show full filtered counts;
Decided initially shows ten and reveals ten more per Show more. Keep mobile
horizontal scrolling inside the board. Flat/Kanban switches preserve URL filters,
sort and cached memory results. Use accessible date/completion dialogs and retain
drafts on failed saves. No dragging or scheduled reminders.

## Library workflow convenience extension — 2026-10-16

Owner-approved: reuse the existing searchable picker, buttons and named dialog
for browser-local saved views; disclose browser storage beside the controls.
Provide actionable empty states for both Flat and fully empty Kanban results.
Use the existing Empty component and explicit actions, retaining provider choice.
Keep the current header, open list and responsive filter vocabulary.

Saved view editing (2026-10-17) retains the selected view during filter edits.
Use an explicit Update view button and visible Unsaved changes text, Save as new,
and compact labeled rename/delete icon buttons. Reuse the named dialog for
renaming, with browser-local storage errors visible. Detail actions include Copy
summary; let the action bar wrap on narrow screens. Clipboard failure uses a
read-only textarea in an existing dialog, selected on focus for manual copying.

Library discovery (2026-10-17) reuses the capture preview sheet from Flat rows
and Kanban cards, with Back to results and Copy summary for the loaded full
record. Keep title links and row/card actions independently focusable. Reuse
the searchable picker in Compare and Supersede. Add Unassigned inside the Owner
filter rather than another toolbar shortcut. Scope-filtered creation carries
the scope into the existing editable field. Review this choice is a secondary
new-form action; proposal review explains that the original draft is retained,
offers Back to draft and returns to that draft rather than opening a second
capture. Retain existing explicit local/Gemini actions and disclosure.

Show browser draft Restore/Discard controls above new/edit forms with clear
storage feedback. Block restoration over a newer server revision and retain a
copyable draft. Put optional rationale immediately beside an already-decided
choice; keep remaining supporting fields progressively disclosed.

## Everyday convenience — 2026-10-16

Keep quick filters, Assigned to me and Applies To visible. Reuse the filter sheet
for the six detailed controls; count only those active fields and keep all chips
outside. Flat pending rows use independent title links and secondary existing
outcome/deadline buttons, without nested interactive controls. New forms offer
optional explicit local related lookup with stored content, scope and coverage
explanations. Keep the existing visual system and draft-recovery controls.

### Compact library and related previews (2026-10-16)

The approved follow-up uses compact Flat records at all widths instead of the
wide nine-column table/laptop metadata stack. Status, choice, rationale and
pending actions lead; scope, owner, created date and available channel/evidence
metadata wrap together. Library-only spacing is reduced without shrinking form
or detail layouts. Related creation results use the existing Sheet for a fresh,
read-only detail preview, preserving the form underneath. Its body scrolls while
Back to draft/Open full decision remain available. No generated summary is added.

## Practical discovery and completion — 2026-10-17

Make existing Flat metadata individually actionable with short accessible Filter
names and wrapping controls, using the same exact URL filters/chips. Kanban only
adds an Owner filter affordance where Owner is already displayed. Selecting the
same value does nothing. Keep title, preview and mutation controls independent.

Extend the same lazy preview in library and drafts with loaded Owner, optional
existing deadline rendering, and all current lifecycle replacement links. Keep
immediate/current history distinct and retain source content and close wording.
For multi-scope drafts, reuse the searchable single-select for Search within;
its value is lookup-only and changing it never starts retrieval.

Pending completion dialogs reuse Review this choice and existing proposal review,
with raw input in identity-bound navigation state. Restore at the page level so
filter membership changes cannot lose the dialog or bypass conflict handling.
Use the existing dialogs, fields, sheets and narrow completion endpoint. No new
visual system, provider, recommendation framework or automatic write is added.

## Demo polish — 2026-10-17

Owner-approved after a hands-on review; it updates earlier sections where they
conflict:

- Library controls are four rows: header (Compare decisions, New Decision),
  search (Find by meaning, Search options), one filter toolbar (quick filters,
  Assigned to me, Applies To, More filters; Flat/Kanban at the right), then the
  count with sort and saved views. Active filter chips appear only when needed.
  The duplicate sort label and the library **Explore scopes** button are removed;
  **Scopes** stays in the sidebar and mobile menu.
- **Search options** opens as an overlay anchored under its button, so the search
  row keeps its height. Outside clicks and Escape close it; its Gemini disclosure
  is unchanged.
- Detail pages show no deadline action for decided records (historical deadlines
  still display) and no separate Decision section, because the title is the
  choice. Original question appears only when it differs.
- Kanban columns share the available width (minimum 12rem each), so all five fit
  a laptop screen; narrower screens keep horizontal scrolling inside the board.
- Helper text keeps required disclosures (local vs Google, coverage, excerpt
  limits) and drops repeated reassurance.

## Stable discovery, sharing links and pending scopes — 2026-10-17

Keep Search within and expansion with the current form visit. Text edits clear
transient results while retaining lookup selection; scope edits retain valid
values and mode changes reset lookup defaults. Keep the local debounce and
manual retry without duplicate scheduled requests. Show two compact matches,
then an accessible Show all N / Show fewer control; use the lazy preview for
long rationale and evidence.

Reuse the clipboard control for compact Copy link beside Copy summary on detail
and inside the shared preview. Summary includes the decision URL and all known
current successor URLs. Preserve real base paths/HashRouter and exclude transient
query/draft state. Clipboard failure retains a selected read-only manual copy.

Scope overviews link Pending questions (N) to exact-scope Pending library filters
rather than rendering another pending list. Show active/superseded counts for
recorded choices separately. Omit zero pending links; pending-only scopes say No
recorded choices yet and omit Latest recorded dates. Preserve alphabetical
ordering, error/retry states and superseded-only history explanations.

## Small library and deadline shortcuts — 2026-10-18

Show Reset to saved view beside Update view only for a modified selected view;
reuse existing application without persisting. Let this action wrap with the
existing saved-view controls on mobile.

Scope directory has one With pending questions toggle beside name search. Use
separate scope-name and positive-pending-count links inside a noninteractive row;
keep counts distinct and independently clear empty-state controls. Do not add
sorting or another pending list.

Identifier-only empty keyword results use No matching decision under these
filters, with Clear filters and keep this key when applicable. Keep manual
provider controls unchanged; only automatic local fallback is suppressed.

Pending deadline fields reuse compact Today/Tomorrow/In 7 days buttons in a
wrapping group, preserving arbitrary date input and explicit Save. Use the shared
calendar helper at click time. Hide shortcuts for decided historical deadlines.
