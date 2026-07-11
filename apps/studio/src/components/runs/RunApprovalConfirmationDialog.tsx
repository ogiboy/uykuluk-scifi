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
        <div className='bg-muted/30 space-y-4 rounded-lg border p-4'>
          <dl className='grid gap-3 text-sm sm:grid-cols-2'>
            <div className='space-y-1'>
              <dt className='text-muted-foreground font-medium'>Action</dt>
              <dd className='break-all'>{actionId}</dd>
            </div>
            {payloadEntries.map(([key, value]) => (
              <div className='space-y-1' key={key}>
                <dt className='text-muted-foreground font-medium'>{key}</dt>
                <dd className='break-all'>{value}</dd>
              </div>
            ))}
            <div className='space-y-1'>
              <dt className='text-muted-foreground font-medium'>Current state</dt>
              <dd className='break-all'>{currentState}</dd>
            </div>
            <div className='space-y-1'>
              <dt className='text-muted-foreground font-medium'>Run</dt>
              <dd className='break-all'>{runId}</dd>
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
