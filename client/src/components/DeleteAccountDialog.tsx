import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Trash2 } from "lucide-react"

const CONFIRM_WORD = "DELETE"

interface DeleteAccountDialogProps {
  onConfirm: () => Promise<void>
  loading?: boolean
}

export function DeleteAccountDialog({ onConfirm, loading }: DeleteAccountDialogProps) {
  const [open, setOpen] = useState(false)
  const [confirmText, setConfirmText] = useState("")

  const canDelete = confirmText.trim().toUpperCase() === CONFIRM_WORD && !loading

  const handleConfirm = async () => {
    if (!canDelete) return
    await onConfirm()
    setOpen(false)
    setConfirmText("")
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setConfirmText("")
      }}
    >
      <DialogTrigger asChild>
        <Button variant="destructive">
          <Trash2 className="h-4 w-4 mr-2" />
          Delete Account
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-red-600">Delete your account?</DialogTitle>
          <DialogDescription>
            This permanently deletes your account and all related data. This action cannot be undone. To confirm, type{" "}
            <span className="font-semibold">{CONFIRM_WORD}</span> below.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="confirm-delete">Type {CONFIRM_WORD} to confirm</Label>
          <Input
            id="confirm-delete"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={CONFIRM_WORD}
            autoComplete="off"
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={!canDelete}>
            <Trash2 className="h-4 w-4 mr-2" />
            {loading ? "Deleting..." : "Delete Account"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
