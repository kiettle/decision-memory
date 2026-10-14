import { ArrowLeft } from "lucide-react"
import { useEffect, useState } from "react"
import { Link, useLocation, useSearchParams } from "react-router-dom"

import { CompareDecisionsDialog } from "@/components/compare-decisions-dialog"
import { DecisionComparison } from "@/components/decision-comparison"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import { api } from "@/lib/api"
import type { Decision } from "@/types"

export function ComparePage() {
  const [params] = useSearchParams()
  const left = params.get("left") ?? ""
  const right = params.get("right") ?? ""
  return <Comparison key={`${left}:${right}`} left={left} right={right} />
}

function Comparison({ left, right }: { left: string; right: string }) {
  const location = useLocation()
  const [pair, setPair] = useState<[Decision, Decision] | null>(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(
    Boolean(left && right && left !== right)
  )
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    if (!left || !right || left === right) return
    let active = true
    void Promise.all([api.decision(left), api.decision(right)])
      .then((data) => {
        if (active) setPair(data)
      })
      .catch((cause) => {
        if (active)
          setError(
            cause instanceof Error
              ? cause.message
              : "Could not load the comparison."
          )
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [left, right, retry])
  return (
    <div className="page-frame">
      <Button
        className="w-fit"
        variant="ghost"
        render={
          <Link
            to={location.state?.returnUrl ?? "/"}
            state={location.state?.returnState}
          />
        }
        nativeButton={false}
      >
        <ArrowLeft data-icon="inline-start" /> Back
      </Button>
      <div className="page-heading-row">
        <div>
          <p className="eyebrow">Reasons, scope, and evidence</p>
          <h1>Compare decisions</h1>
        </div>
        <CompareDecisionsDialog />
      </div>
      {loading ? (
        <Skeleton className="h-80 w-full" />
      ) : pair ? (
        <DecisionComparison left={pair[0]} right={pair[1]} />
      ) : (
        <Empty className="border-y py-12">
          <EmptyHeader>
            <EmptyTitle>
              {error
                ? "Could not load comparison"
                : "Choose two different Decisions"}
            </EmptyTitle>
            <EmptyDescription>
              {error ||
                "Open the comparison picker to select two stored Decisions."}
            </EmptyDescription>
          </EmptyHeader>
          {error ? (
            <Button
              variant="outline"
              onClick={() => {
                setLoading(true)
                setError("")
                setRetry((value) => value + 1)
              }}
            >
              Try again
            </Button>
          ) : null}
        </Empty>
      )}
    </div>
  )
}
