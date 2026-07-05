import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ChannelHandoffDecisionValue } from "./RunChannelHandoffDecisionSelector";

export type PendingChannelHandoffDecisionPayload = Readonly<{
  decision: ChannelHandoffDecisionValue;
  notes: string;
  reviewedBy: string;
  runId: string;
  thumbnailCandidateId?: string;
}>;

type RunChannelHandoffDecisionConfirmationDialogProps = Readonly<{
  decision: ChannelHandoffDecisionValue;
  isSubmitting: boolean;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  pendingPayload: PendingChannelHandoffDecisionPayload | null;
  reviewedBy: string;
  runId: string;
}>;

/**
 * Confirms a local channel handoff decision before Studio writes durable evidence.
 *
 * @param props - Dialog state, current form values, and confirmation callbacks.
 */
export function RunChannelHandoffDecisionConfirmationDialog({
  decision,
  isSubmitting,
  onConfirm,
  onOpenChange,
  open,
  pendingPayload,
  reviewedBy,
  runId,
}: RunChannelHandoffDecisionConfirmationDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirm local channel handoff decision</DialogTitle>
          <DialogDescription>
            This writes local review evidence for {runId}. Upload and public publish stay disabled.
          </DialogDescription>
        </DialogHeader>
        <div className='space-y-4 rounded-lg border bg-muted/30 p-4'>
          <dl className='grid gap-3 text-sm sm:grid-cols-2'>
            <div className='space-y-1'>
              <dt className='font-medium text-muted-foreground'>Decision</dt>
              <dd className='break-all'>{pendingPayload?.decision ?? decision}</dd>
            </div>
            <div className='space-y-1'>
              <dt className='font-medium text-muted-foreground'>Thumbnail</dt>
              <dd className='break-all'>
                {pendingPayload?.thumbnailCandidateId ?? "not selected for this decision"}
              </dd>
            </div>
            <div className='space-y-1'>
              <dt className='font-medium text-muted-foreground'>Reviewed by</dt>
              <dd className='break-all'>{pendingPayload?.reviewedBy ?? reviewedBy}</dd>
            </div>
            <div className='space-y-1'>
              <dt className='font-medium text-muted-foreground'>Run</dt>
              <dd className='break-all'>{runId}</dd>
            </div>
          </dl>
          <p className='text-sm text-muted-foreground'>
            Notes are required and will be persisted with the local channel handoff decision.
          </p>
        </div>
        <DialogFooter showCloseButton>
          <Button disabled={isSubmitting} type='button' onClick={onConfirm}>
            Confirm local decision
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
