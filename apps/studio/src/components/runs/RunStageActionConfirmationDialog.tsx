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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirm local workflow action</DialogTitle>
          <DialogDescription>
            Studio will run the canonical producer CLI for {runId}. Upload, scheduling, public
            publish, and paid-provider execution remain unavailable from this action.
          </DialogDescription>
        </DialogHeader>
        <div className='confirmation-summary'>
          <dl className='decision-list'>
            <div>
              <dt>Action</dt>
              <dd>{action.actionId}</dd>
            </div>
            <div>
              <dt>Current state</dt>
              <dd>{currentState}</dd>
            </div>
            <div>
              <dt>Run</dt>
              <dd>{runId}</dd>
            </div>
            <div>
              <dt>Route</dt>
              <dd>{action.routePath}</dd>
            </div>
          </dl>
          {nextRecommendedCommand ? (
            <p className='artifact-action'>CLI equivalent: {nextRecommendedCommand}</p>
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
