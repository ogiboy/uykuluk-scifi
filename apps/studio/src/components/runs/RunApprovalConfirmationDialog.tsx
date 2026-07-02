import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type RunApprovalConfirmationDialogProps = Readonly<{
  actionId: string;
  buttonLabel: string;
  currentState: string;
  isSubmitting: boolean;
  nextRecommendedCommand: string | null;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  runId: string;
}>;

export function RunApprovalConfirmationDialog({
  actionId,
  buttonLabel,
  currentState,
  isSubmitting,
  nextRecommendedCommand,
  onConfirm,
  onOpenChange,
  open,
  runId,
}: RunApprovalConfirmationDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirm local approval evidence</DialogTitle>
          <DialogDescription>
            This records an explicit local approval for {runId}. It does not upload, publish, or
            schedule content.
          </DialogDescription>
        </DialogHeader>
        <div className='confirmation-summary'>
          <dl className='decision-list'>
            <div>
              <dt>Action</dt>
              <dd>{actionId}</dd>
            </div>
            <div>
              <dt>Current state</dt>
              <dd>{currentState}</dd>
            </div>
            <div>
              <dt>Run</dt>
              <dd>{runId}</dd>
            </div>
          </dl>
          {nextRecommendedCommand ? (
            <p className='artifact-action'>CLI equivalent: {nextRecommendedCommand}</p>
          ) : null}
        </div>
        <DialogFooter showCloseButton>
          <Button disabled={isSubmitting} type='button' onClick={onConfirm}>
            Confirm {buttonLabel.toLowerCase()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
