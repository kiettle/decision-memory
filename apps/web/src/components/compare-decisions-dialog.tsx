import { headline } from "../../../../shared/decision-deadlines.js"
import { Columns2 } from "lucide-react"
import { useEffect, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { api } from "@/lib/api"
import { comparisonHref } from "@/lib/decision-links"
import type { Decision } from "@/types"

export function CompareDecisionsDialog({ decision }: { decision?: Decision }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState<Decision[]>([])
  const [left, setLeft] = useState(decision?.id ?? "")
  const [right, setRight] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    if (!open) return
    let active = true
    void api
      .decisions()
      .then((data) => {
        if (active) setRows(data)
      })
      .catch((cause) => {
        if (active)
          setError(
            cause instanceof Error ? cause.message : "Could not load Decisions."
          )
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [open, retry])

  function changeOpen(next: boolean) {
    setOpen(next)
    if (next) {
      setLeft(decision?.id ?? "")
      setRight("")
      setError("")
      setRows([])
      setLoading(true)
    }
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger render={<Button variant="outline" />}>
        <Columns2 data-icon="inline-start" /> Compare decisions
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Compare two Decisions</DialogTitle>
          <DialogDescription>
            See their reasons, scope, alternatives, and saved evidence together.
          </DialogDescription>
        </DialogHeader>
        <FieldGroup>
          {(["First Decision", "Second Decision"] as const).map(
            (label, index) => {
              const selected = index === 0 ? left : right
              const selectedRow = rows.find((item) => item.id === selected)
              return (
                <Field key={label}>
                  <FieldLabel>{label}</FieldLabel>
                  <Select
                    value={selected}
                    disabled={loading || (index === 0 && Boolean(decision))}
                    onValueChange={(value) =>
                      index === 0 ? setLeft(value ?? "") : setRight(value ?? "")
                    }
                  >
                    <SelectTrigger aria-label={label} className="w-full">
                      <SelectValue>
                        {(selectedRow ? headline(selectedRow) : null) ??
                          (index === 0 ? (decision ? headline(decision) : null) : null) ??
                          (loading
                            ? "Loading Decisions…"
                            : "Choose a Decision")}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {rows
                          .filter(
                            (item) => item.id !== (index === 0 ? right : left)
                          )
                          .map((item) => (
                            <SelectItem key={item.id} value={item.id}>
                              {item.decisionKey} · {headline(item)}
                            </SelectItem>
                          ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
              )
            }
          )}
        </FieldGroup>
        {error ? (
          <>
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
            <Button
              variant="outline"
              onClick={() => {
                setError("")
                setLoading(true)
                setRetry((value) => value + 1)
              }}
            >
              Try again
            </Button>
          </>
        ) : null}
        {!loading && !error && rows.length < 2 ? (
          <p className="text-sm text-muted-foreground">
            Record at least two Decisions to compare them.
          </p>
        ) : null}
        <DialogFooter>
          <Button
            disabled={
              loading || Boolean(error) || !left || !right || left === right
            }
            onClick={() => {
              setOpen(false)
              void navigate(comparisonHref(left, right), {
                state: {
                  returnUrl: location.pathname + location.search,
                  returnState: location.state,
                },
              })
            }}
          >
            Open comparison
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
