import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type RunRevisionConfirmationDialogProps = Readonly<{
  actionLabel: string;
  currentState: string;
  isSubmitting: boolean;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  reason: string;
  runId: string;
}>;

/**
 * Confirms a local artifact revision before Studio submits it to CLI/core.
 *
 * @param props - Dialog state, revision summary, and callbacks.
 */
export function RunRevisionConfirmationDialog({
  actionLabel,
  currentState,
  isSubmitting,
  onConfirm,
  onOpenChange,
  open,
  reason,
  runId,
}: RunRevisionConfirmationDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirm local revision</DialogTitle>
          <DialogDescription>
            Studio will record durable before/after revision evidence for {runId}. CLI/core will
            re-check state, artifact, and evidence invalidation rules.
          </DialogDescription>
        </DialogHeader>
        <div className='rounded-lg border bg-muted/30 p-4'>
          <dl className='grid gap-3 text-sm sm:grid-cols-2'>
            <div className='space-y-1'>
              <dt className='font-medium text-muted-foreground'>Action</dt>
              <dd className='break-all'>{actionLabel}</dd>
            </div>
            <div className='space-y-1'>
              <dt className='font-medium text-muted-foreground'>Current state</dt>
              <dd className='break-all'>{currentState}</dd>
            </div>
            <div className='space-y-1 sm:col-span-2'>
              <dt className='font-medium text-muted-foreground'>Reason</dt>
              <dd className='break-words'>{reason}</dd>
            </div>
          </dl>
        </div>
        <DialogFooter showCloseButton>
          <Button disabled={isSubmitting} type='button' onClick={onConfirm}>
            Record revision
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
