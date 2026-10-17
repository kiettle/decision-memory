import { Copy } from "lucide-react"
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
import type { Decision } from "@/types"

export function CopyDecisionSummary({ decision }: { decision: Decision }) {
  const [copying, setCopying] = useState(false)
  const [manualCopy, setManualCopy] = useState<string | null>(null)

  async function copy() {
    const summary = decisionSummary(decision)
    setCopying(true)
    try {
      await navigator.clipboard.writeText(summary)
      toast.success("Decision summary copied.")
    } catch {
      setManualCopy(summary)
    } finally {
      setCopying(false)
    }
  }

  return (
    <>
      <Button variant="outline" disabled={copying} onClick={() => void copy()}>
        <Copy data-icon="inline-start" />
        {copying ? "Copying…" : "Copy summary"}
      </Button>
      <Dialog
        open={manualCopy !== null}
        onOpenChange={(open) => {
          if (!open) setManualCopy(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Copy decision summary</DialogTitle>
            <DialogDescription>
              Clipboard access is unavailable. Select and copy the text below.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            aria-label="Decision summary"
            readOnly
            value={manualCopy ?? ""}
            className="max-h-[50dvh] min-h-64"
            autoFocus
            onFocus={(event) => event.currentTarget.select()}
          />
          <DialogFooter>
            <Button onClick={() => setManualCopy(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
