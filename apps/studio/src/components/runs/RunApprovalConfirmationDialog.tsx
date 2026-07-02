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
  pendingPayload: Record<string, boolean | string> | null;
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
  pendingPayload,
  runId,
}: RunApprovalConfirmationDialogProps) {
  const payloadEntries = pendingPayloadEntries(pendingPayload);

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
            {payloadEntries.map(([key, value]) => (
              <div key={key}>
                <dt>{key}</dt>
                <dd>{value}</dd>
              </div>
            ))}
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

function pendingPayloadEntries(
  pendingPayload: Record<string, boolean | string> | null,
): Array<[string, string]> {
  if (!pendingPayload) {
    return [];
  }
  return Object.entries(pendingPayload)
    .filter(([key]) => key !== "runId")
    .map(([key, value]) => [key, String(value)]);
}
