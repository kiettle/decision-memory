import { useEffect, useState } from "react"
import { Link } from "react-router-dom"

import { headline } from "../../../../shared/decision-deadlines.js"
import { DecisionDeadline } from "@/components/decision-deadline"
import { useLocalDate } from "@/hooks/use-local-date"
import { CopyDecisionSummary } from "@/components/copy-decision-summary"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { api } from "@/lib/api"
import type { DecisionNavigationState } from "@/lib/decision-navigation"
import type { Decision } from "@/types"

export function RelatedDecisionPreview({
  decision,
  origin,
  context = "draft",
}: {
  decision: Decision
  context?: "draft" | "library"
  origin: DecisionNavigationState | null
}) {
  const [open, setOpen] = useState(false)
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={<Button type="button" variant="outline" size="sm" />}
        aria-label={`Preview ${decision.decisionKey}`}
      >
        Preview
      </SheetTrigger>
      <SheetContent className="data-[side=right]:w-full data-[side=right]:sm:max-w-xl">
        <SheetHeader className="pr-12">
          <SheetTitle>Decision preview</SheetTitle>
          <SheetDescription>
            {decision.decisionKey} ·{" "}
            {context === "draft"
              ? "Your unfinished form stays open."
              : "Your library results stay open."}
          </SheetDescription>
        </SheetHeader>
        {open ? (
          <PreviewContent
            key={decision.id}
            id={decision.id}
            context={context}
            origin={origin}
          />
        ) : null}
        <SheetFooter className="border-t">
          <SheetClose render={<Button type="button" />}>
            {context === "draft" ? "Back to draft" : "Back to results"}
          </SheetClose>
          <Button
            variant="outline"
            render={<Link to={`/decisions/${decision.id}`} state={origin} />}
            nativeButton={false}
          >
            Open full decision
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

function PreviewContent({
  id,
  context,
  origin,
}: {
  id: string
  context: "draft" | "library"
  origin: DecisionNavigationState | null
}) {
  const today = useLocalDate()
  const [decision, setDecision] = useState<Decision | null>(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    void api
      .decision(id)
      .then((record) => {
        if (active) setDecision(record)
      })
      .catch(() => {
        if (active) setFailed(true)
      })
    return () => {
      active = false
    }
  }, [id, attempt])

  return (
    <div
      className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 pb-4"
      aria-live="polite"
      aria-busy={!decision && !failed}
    >
      {failed ? (
        <div className="flex flex-col items-start gap-3">
          <p role="alert">
            Could not load this decision.{" "}
            {context === "draft"
              ? "Your draft is unchanged."
              : "Your results are unchanged."}
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setFailed(false)
              setAttempt((value) => value + 1)
            }}
          >
            Retry preview
          </Button>
        </div>
      ) : !decision ? (
        <p>Loading decision…</p>
      ) : (
        <>
          {context === "library" ? (
            <div className="flex">
              <CopyDecisionSummary decision={decision} />
            </div>
          ) : null}
          <div className="flex flex-col gap-2">
            <StatusBadge
              status={decision.status}
              decisionState={decision.decisionState}
            />
            <h2 className="text-lg font-semibold break-words">
              {headline(decision)}
            </h2>
            {decision.status === "SUPERSEDED" ? (
              <section
                aria-label="Current replacements"
                className="flex flex-col gap-2"
              >
                <h3 className="font-semibold">Current replacements</h3>
                {decision.lifecycle?.current?.length ? (
                  decision.lifecycle.current.map((current) => (
                    <Link
                      key={current.id}
                      to={`/decisions/${current.id}`}
                      state={origin}
                      className="break-words text-primary underline"
                    >
                      {current.decisionKey} · {headline(current)}
                    </Link>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No current replacement information is available for this
                    record. Open the full decision to inspect its recorded
                    history.
                  </p>
                )}
              </section>
            ) : null}
          </div>
          <section
            className="flex flex-col gap-2"
            aria-label="Decision ownership and deadline"
          >
            <h3 className="font-semibold">Owner</h3>
            <p className="break-words">
              {decision.owner?.displayName ??
                decision.ownerName ??
                "Unassigned"}
            </p>
            {decision.dueDate ? (
              <>
                <h3 className="font-semibold">Deadline</h3>
                <DecisionDeadline decision={decision} today={today} />
              </>
            ) : null}
          </section>
          <section className="flex flex-col gap-2">
            <h3 className="font-semibold">Why</h3>
            <p className="break-words whitespace-pre-wrap">
              {decision.why || "No rationale recorded."}
            </p>
          </section>
          <section className="flex flex-col gap-2">
            <h3 className="font-semibold">Applies To</h3>
            {decision.appliesTo.length ? (
              <ul className="flex list-inside list-disc flex-col gap-1 break-words">
                {decision.appliesTo.map((scope) => (
                  <li key={scope}>{scope}</li>
                ))}
              </ul>
            ) : (
              <p>No scope recorded.</p>
            )}
          </section>
          <section className="flex flex-col gap-2">
            <h3 className="font-semibold">Evidence</h3>
            {decision.sources?.length ? (
              decision.sources.map((source) => (
                <div
                  key={source.id}
                  className="flex flex-col gap-1 break-words"
                >
                  {source.permalink ? (
                    <a
                      className="text-primary underline"
                      href={source.permalink}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {source.channelName
                        ? `Slack · #${source.channelName}`
                        : "Source discussion"}
                    </a>
                  ) : (
                    <p>Captured discussion · original link unavailable</p>
                  )}
                  {source.sourceContext?.captureStatus === "INCOMPLETE" ? (
                    <p className="text-xs text-muted-foreground">
                      Only part of this discussion was captured.
                    </p>
                  ) : source.sourceContext?.captureTruncated ? (
                    <p className="text-xs text-muted-foreground">
                      The captured discussion was shortened.
                    </p>
                  ) : null}
                </div>
              ))
            ) : (
              <p>No captured discussion attached.</p>
            )}
            {decision.sources?.length ? (
              <p className="text-xs text-muted-foreground">
                Open the full decision to read the saved discussion, including
                when the original link is unavailable.
              </p>
            ) : null}
            {decision.references?.map((reference) => (
              <a
                key={reference.id}
                className="break-words text-primary underline"
                href={reference.url}
                target="_blank"
                rel="noreferrer"
              >
                {reference.label || reference.url}
              </a>
            ))}
          </section>
        </>
      )}
    </div>
  )
}
