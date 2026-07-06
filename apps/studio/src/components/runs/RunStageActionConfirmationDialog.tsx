import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { StudioStageActionConfig } from "@/lib/studioStageAction";

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
  const scopeDescription = action.requiresRunId
    ? `Studio will run the canonical producer CLI for ${runId}.`
    : "Studio will run the canonical producer CLI to create a new local run.";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirm local workflow action</DialogTitle>
          <DialogDescription>
            {scopeDescription} Upload, scheduling, public publish, and paid-provider execution
            remain unavailable from this action.
          </DialogDescription>
        </DialogHeader>
        <div className='space-y-4 rounded-lg border bg-muted/30 p-4'>
          <dl className='grid gap-3 text-sm sm:grid-cols-2'>
            <div className='space-y-1'>
              <dt className='font-medium text-muted-foreground'>Action</dt>
              <dd className='break-all'>{action.actionId}</dd>
            </div>
            <div className='space-y-1'>
              <dt className='font-medium text-muted-foreground'>Current state</dt>
              <dd className='break-all'>{currentState}</dd>
            </div>
            <div className='space-y-1'>
              <dt className='font-medium text-muted-foreground'>Run</dt>
              <dd className='break-all'>{runId}</dd>
            </div>
            <div className='space-y-1'>
              <dt className='font-medium text-muted-foreground'>Route</dt>
              <dd className='break-all'>{action.routePath}</dd>
            </div>
          </dl>
          {nextRecommendedCommand ? (
            <code className='block max-w-full break-all rounded-md bg-background px-2 py-1 text-xs text-muted-foreground'>
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
