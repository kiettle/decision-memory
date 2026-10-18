import { Copy, Link2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { decisionSummary } from "@/lib/decision-summary"
import { decisionUrl } from "@/lib/decision-links"
import type { Decision } from "@/types"

export function CopyDecisionSummary({
  decision,
  linkOnly = false,
}: {
  decision: Decision
  linkOnly?: boolean
}) {
  const [copying, setCopying] = useState(false)
  const [manualCopy, setManualCopy] = useState<string | null>(null)

  async function copy() {
    const summary = linkOnly
      ? decisionUrl(decision.id)
      : decisionSummary(decision)
    setCopying(true)
    try {
      await navigator.clipboard.writeText(summary)
      toast.success(linkOnly ? "Decision link copied." : "Decision summary copied.")
    } catch {
      setManualCopy(summary)
    } finally {
      setCopying(false)
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size={linkOnly ? "sm" : "default"}
        disabled={copying}
        onClick={() => void copy()}
      >
        {linkOnly ? (
          <Link2 data-icon="inline-start" />
        ) : (
          <Copy data-icon="inline-start" />
        )}
        {copying ? "Copying…" : linkOnly ? "Copy link" : "Copy summary"}
      </Button>
      <Dialog
        open={manualCopy !== null}
        onOpenChange={(open) => {
          if (!open) setManualCopy(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {linkOnly ? "Copy decision link" : "Copy decision summary"}
            </DialogTitle>
            <DialogDescription>
              Clipboard access is unavailable. Select and copy the text below.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            aria-label={linkOnly ? "Decision link" : "Decision summary"}
            readOnly
            value={manualCopy ?? ""}
            className={linkOnly ? "min-h-24" : "max-h-[50dvh] min-h-64"}
            autoFocus
            onFocus={(event) => event.currentTarget.select()}
          />
          <DialogFooter>
            <Button type="button" onClick={() => setManualCopy(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
