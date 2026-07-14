import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { StudioStageActionConfig } from "@/lib/actions/studioStageAction";

type RunStageActionConfirmationDialogProps = Readonly<{
  action: StudioStageActionConfig;
  currentState: string;
  isSubmitting: boolean;
  nextRecommendedCommand: string | null;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  runId: string;
}>;

/**
 * Confirms a guarded local workflow-stage action before Studio calls the producer CLI.
 *
 * @param props - The action, run state, and dialog callbacks.
 */
export function RunStageActionConfirmationDialog({
  action,
  currentState,
  isSubmitting,
  nextRecommendedCommand,
  onConfirm,
  onOpenChange,
  open,
  runId,
}: RunStageActionConfirmationDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirm local workflow action</DialogTitle>
          <DialogDescription>
            Studio will run the canonical producer CLI for {runId}. Upload, scheduling, and public
            publishing remain unavailable. Any hosted voice call still requires the exact persisted
            selection, quote, approval, reservation, and budget checks.
          </DialogDescription>
        </DialogHeader>
        <div className='bg-muted/30 space-y-4 rounded-lg border p-4'>
          <dl className='grid gap-3 text-sm sm:grid-cols-2'>
            <div className='space-y-1'>
              <dt className='text-muted-foreground font-medium'>Action</dt>
              <dd className='break-all'>{action.actionId}</dd>
            </div>
            <div className='space-y-1'>
              <dt className='text-muted-foreground font-medium'>Current state</dt>
              <dd className='break-all'>{currentState}</dd>
            </div>
            <div className='space-y-1'>
              <dt className='text-muted-foreground font-medium'>Run</dt>
              <dd className='break-all'>{runId}</dd>
            </div>
            <div className='space-y-1'>
              <dt className='text-muted-foreground font-medium'>Route</dt>
              <dd className='break-all'>{action.routePath}</dd>
            </div>
          </dl>
          {nextRecommendedCommand ? (
            <code className='bg-background text-muted-foreground block max-w-full rounded-md px-2 py-1 text-xs break-all'>
              CLI equivalent: {nextRecommendedCommand}
            </code>
          ) : null}
        </div>
        <DialogFooter showCloseButton>
          <Button disabled={isSubmitting} type='button' onClick={onConfirm}>
            {isSubmitting ? "Running..." : action.buttonLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
