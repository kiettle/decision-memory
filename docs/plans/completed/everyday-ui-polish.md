# Everyday UI polish

Date: 2026-10-29

## Status

Completed — 2026-10-29

## Outcome

Polish the existing application for comfortable everyday use: understandable
loading/recovery, short mobile capture, visible applicability, scannable briefs,
consistent touch targets and restrained accessible motion. A target score is a
design aim, not a measured user-benefit claim.

## Authority and context

Owner requested implementing the preceding UI review improvements to reach a
9/10 standard. AGENTS.md and docs/WORKFLOW.md apply. Accepted authority:
docs/design/decision-memory-ui.md; docs/product/decision-deadlines.md,
decision-understanding.md and everyday-project-memory.md. Keep required fields,
drafts, exact scopes, owner-only curation, evidence/history, explicit follows,
existing retrieval/provider rules and error recovery intact.

The tree includes earlier unfinished Dashboard foundations and the validated
unread-refresh repair. Preserve them. Analytics policy questions are still open;
this work introduces no collection, permissions or external processing.

## Baseline

Read-only review used the production build with synthetic records. Eight screens
were reviewed at desktop/phone; Library, Scope, Capture and Detail were inspected
at 1440/768/390. No inspector FAIL; label/edge warnings remain. At 390×844 the
Library's first row starts at y433 and the capture field at y533. A simulated slow
search replaces a 298px pending row with a 93px skeleton. Error recovery appears
after question/proposal actions, with Retry partly below the viewport and an
unlabelled old count. Several phone actions are 32px tall. Exact scope appears
below replacement history. Baseline screenshots and measurements are under
/private/tmp/decision-ui-review/ (temporary, may expire).

## Approach and progress

- [x] Read current contracts, implementation, review evidence and frontend skills.
- [x] Improve Library status/count/error/empty hierarchy and accessible loading,
  with realistic skeleton geometry and preserved query/filter recovery.
- [x] Bring capture input up; retain sticky actions, drafts and optional notes;
  make phone controls comfortable without inflating inline metadata.
- [x] Put exact scope beside the choice; make briefs/changes scannable and keep
  all evidence and record navigation available with useful disclosures.
- [x] Add behavior-level browser proof through the existing UI suite, update
  affected product/design documentation and run appropriate repository checks.
- [x] Inspect the final production build at 1440/768/390, including slow/error/
  empty states, keyboard and reduced motion; critique and repair visible issues.
- [x] Clean up owned synthetic resources, report evidence and remaining limits,
  and move this plan to completed only after required proof passes.

## Decisions

- Preserve the existing white/cobalt/Geist system and product identity. Improve
  hierarchy and interaction rather than introduce a new theme or decorative motion.
- Never label a failed or unfinished search as no matches. Show status/retry
  before secondary capture actions; retain manual capture when search fails.
- Keep previous records out of a newly filtered result while loading; skeletons
  may use prior row shape but must not imply old guidance applies to a new scope.
- Keep draft recovery prominent when attention is required; move routine browser
  storage explanation out of the capture introduction. No capture payload changes.
- Exact scope moves up unchanged. Curated brief evidence/history remains linked
  and inspectable without AI; compact repeated important rows in the full list.
- Design reference: editorial-greeting sheet, seed 1080567168, used for editorial
  hierarchy with the repository's white/cobalt/Geist system retained. No greeting,
  chart, theme replacement or new navigation was added: this is a targeted polish
  of existing app screens, not a new dashboard composition.

## Increment evidence

Implemented Library truthful unavailable counts, polite live status and busy
region, structured loading placeholders, recovery before manual capture, compact
successful-search disclosures and retained scoped fallback. Capture now leads
with its input/type, optional pasted notes follow it, and routine draft explanation
follows the fields; actionable recovery/storage errors stay above them. Exact
scope precedes rationale/history; selected brief rows have grouped owner/context,
inspectable evidence and focus-safe in-page jumps. Changes uses paired snapshots.
Phone controls use 44px targets (inline metadata stays compact); existing reduced
motion remains. General labels now use sentence case.

146 unit tests and the native integration suite passed. Lint/typecheck and the
final build passed. The first focused browser run exposed capture
input position above the targeted 330px threshold; removed the redundant form
divider/padding rather than relaxing the threshold. Browser inspection also caught
Empty's utility styles overriding a custom layout class and primitive triggers
not inheriting Button's data-slot; corrected both at their existing owners. No
policy, collection, server, provider or capture payload changes were introduced.

The focused proof passes all checks, including immediate reduced-motion
scroll/focus and disclosed pasted evidence. Final production inspection passed
0 FAIL / 0 WARN for Library, Capture, Scope and Detail at all three widths. Opened
all 24 inspector screenshots, plus phone loading/empty/error and Changes states.
Eight screens were also exercised at 1440/390 with no horizontal overflow or
unexpected console errors. An earlier scope text-overhang warning was corrected
with aligned 18px phone gutters. An earlier inspector failure was solely the
seed's Acme workspace label; renamed the owned synthetic fixture to Atlas
Engineering without exemptions or source-data changes.

At 390×844, the Library first row now starts at y405 (was y433), capture input at
approximately y274 (was y533), and Save is 44px tall (was 32px). Retry fits fully
in the first phone viewport on a failed search. New browser proof checks shaped
placeholders within 64px of the preceding pending row, truthful busy/unavailable
states, preserved query/scope fallback, capture reading order, brief evidence,
route-safe keyboard jumps, exact applicability and reduced motion. Drawer motion
remains 200ms normally and approximately 0.01ms with reduced motion; focus returns
to its trigger. No decorative motion was added.

Native lint/typecheck and final production build passed. Build retains the
existing >500kB chunk warning (609.60kB / 192.56kB gzip); no threshold changed.
Design source lint has 0 FAIL and four defended warnings: Search options shadow
belongs to an actual overlay; two eyebrow matches are plain sentence-case
context labels after the CSS change; the existing blur is confined to the fixed
Save bar. No inspector exemptions were added.

The complete native `npm run test:ui` passed, including project-memory capture/
draft recovery/follows, the earlier unread-badge race regression, and new polish
assertions. It used owned API 3013 with blank integrations and actual production
assets through a temporary transport adapter (fixed default endpoints forwarded
to owned services; native assertions retained). Desktop/tablet/phone responsive,
keyboard, loading/empty/error, retry, evidence and reduced motion passed. Product
and design documentation plus the coworker study script match the new behavior.

Visual server 5175 is stopped; exactly its three created decisions and synthetic
owner were removed, restoring the 12 seed records. After full UI verification,
confirmed that all native UI fixtures were removed and 12 seed decisions remained.
Stopped verified owned API 3013, dropped only decision_ui_polish_20261029_01 and
removed its settings encryption key. The user's normal services/database were
left running and unchanged by this task. Temporary evidence is under
/private/tmp/decision-ui-polish/ and may expire; the native browser assertions
live in scripts/verify-ui-polish.mjs and run from scripts/visual-qa.mjs.

## Final visual critique

ROUND 3
Seen in one second: the decision list, the capture field, the scoped choice, or
the project brief, depending on the current task.
Idea (one sentence): show the recorded choice and its applicability first, with
evidence and recovery close enough to inspect without losing the task.
Live thing: existing search/filter/capture, evidence disclosure and brief jump.
Layout words by section: Library=list / capture=form / detail=editorial /
brief=grouped choices / changes=paired snapshots.
Scores: design 8.5 · usability 9 · creativity 7 · content 9 → overall 8.4.
Caps applied: app-screen rules apply; no picture or motion floor. This subjective
craft score is not a measured teammate usability score or a claim of benefit.
Top three problems (most visible first), each with the screenshot and fix:
1. Phone capture input previously below y533: final-form/mobile-fold.jpg now
   leads with the input at approximately y274; routine explanation moved down.
2. Retry previously below secondary actions and partly off-screen:
   after/library-error-390.png now shows Unavailable and fully visible Retry.
3. Brief previously repeated rationale in multiple lists:
   final-scope/mobile-page-01.jpg groups the selected choice and provides a
   focus-safe jump from the full list. Evidence is a named disclosure.

App-screen checks: biggest content answers each task; equal page gutters and
shared edges remain; cobalt/Geist/product mark retained; counts come from the
same response (the scope fixture shows 1 important choice, 2 open questions and
2 active/2 superseded records consistently); missing rationale/contact is named;
no charts/legends were added; phone navigation folds and controls remain usable.
Questions answered first: Library—what records apply? Capture—what needs to be
recorded? Detail—what is the choice and exact scope? Brief—what should a newcomer
know? Changes—what changed in followed guidance?

Remaining design tradeoffs: filters still occupy two phone rows; inline metadata
targets stay compact; long briefs/history require scrolling. These preserve
existing discovery and evidence access. Validate their real task cost with the
updated coworker script rather than adding more interface preemptively.

## Risks and recovery

Do not change the user's records or collect coworker activity. Run against an
owned disposable database/API with synthetic fixtures and blank external keys.
Preserve all existing assertions except those deliberately updated for the new
visible hierarchy, and add proof of the resulting behavior. No real messages,
notifications or external AI calls. Revert only this plan's edits if needed;
preserve prior uncommitted work. Stop/drop only resources created for this run.

## Validation

Native browser suite: status/count correctness, retry visible on phone, no
premature no-answer messaging, query/scope capture fallback, loading announcements,
stable row geometry, early capture field, draft/notes/save recovery, exact scope,
brief disclosures/navigation, touch/focus and reduced motion. Run lint,
typecheck, build, unit and required integration/UI checks. Browser plugin absent;
use the repository's Playwright/Chrome workflow and production design inspector.
Do not infer first-time usability from automated tests; retain coworker validation.

## Result

Implemented and validated the requested everyday UI polish. Required scope is
complete; no new policy, tracking, data sharing or external notification behavior.
Prior unfinished Dashboard foundations and the authorized unread repair remain
preserved in the working tree; the separate Dashboard plan stays active pending
its unanswered analytics policy questions. No commit was created for this pass.

Limitations: the existing bundle-size warning remains. Synthetic browser checks
do not establish first-time usability, perceived speed on slow devices or a
measured 9/10 user rating. Live integrations were intentionally not exercised.
Use docs/presentation/study/everyday-project-memory.md with real teammates to
measure correct scope/answer, completion, assistance and capture/recovery effort.
