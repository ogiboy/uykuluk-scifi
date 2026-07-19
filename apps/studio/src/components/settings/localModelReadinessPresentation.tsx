import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { StudioLocale } from "@/i18n/locales";
import type { StudioLocalModelOverview } from "@/lib/localModels/localModelOverview";
import type { StudioGuardedActionSubmitState } from "@/lib/mutations/useStudioGuardedActionSubmit";
import { RefreshCwIcon, ShieldCheckIcon } from "lucide-react";
import { LocalModelProgress } from "./LocalModelProgress";
import type { LocalModelCopy } from "./localModelReadinessCopy";
import {
  formatLocalModelBytes,
  formatLocalModelDuration,
  localModelReadinessLabel,
} from "./localModelReadinessFormatting";

type Preparation = NonNullable<StudioLocalModelOverview["preparation"]>;

/**
 * Displays the active local-model operation, its progress, and available recovery action.
 *
 * @param elapsed - Optional elapsed-time display for the active operation.
 * @param guidance - Guidance shown while the operation is in progress.
 * @param overview - Current operation progress and recovery availability.
 * @param recovering - Whether recovery is currently being processed.
 * @param onRecover - Called when the user requests recovery and review.
 */
export function LocalModelActivePanel({
  copy,
  elapsed,
  guidance,
  overview,
  recovering,
  onRecover,
}: Readonly<{
  copy: LocalModelCopy;
  elapsed?: string;
  guidance: string;
  overview: StudioLocalModelOverview;
  recovering: boolean;
  onRecover: () => void;
}>) {
  return (
    <div className='bg-background/45 grid gap-3 rounded-xl border border-(--line) p-4'>
      <div className='flex items-start gap-3'>
        <RefreshCwIcon
          aria-hidden='true'
          className='mt-0.5 size-4 animate-spin text-cyan-400 motion-reduce:animate-none'
        />
        <div className='grid gap-1'>
          <p className='font-medium'>{copy.operationActive}</p>
          <p className='text-muted-foreground text-sm'>{guidance}</p>
          {elapsed ? (
            <p className='text-muted-foreground text-xs'>
              {copy.elapsed}: {elapsed}
            </p>
          ) : null}
          <p className='text-muted-foreground text-xs'>{copy.operationSafeToLeave}</p>
        </div>
      </div>
      <LocalModelProgress copy={copy} progress={overview.progress} />
      {overview.recoveryAvailable ? (
        <Button disabled={recovering} variant='secondary' onClick={onRecover}>
          <RefreshCwIcon aria-hidden='true' />
          {copy.recoverAndReview}
        </Button>
      ) : null}
    </div>
  );
}

/**
 * Presents the local-model preflight estimates and approval controls for queuing execution.
 *
 * The execution action is enabled only when the workflow permits execution, the confirmation
 * state is satisfied, and no submission is in progress.
 *
 * @param approvedBy - Identifier of the person approving execution.
 * @param canExecute - Whether the current workflow state permits execution.
 * @param confirmed - Whether execution has been explicitly confirmed.
 * @param locale - Locale used to format the estimated duration.
 * @param onApprovedByChange - Handles changes to the approver identifier.
 * @param onConfirmedChange - Handles changes to the execution confirmation.
 * @param onExecute - Queues the approved execution.
 * @param preparation - Preflight estimates and metadata for the execution.
 * @param submitting - Whether the approval submission is in progress.
 */
export function LocalModelPreparationPanel({
  approvedBy,
  canExecute,
  confirmed,
  copy,
  locale,
  onApprovedByChange,
  onConfirmedChange,
  onExecute,
  preparation,
  submitting,
}: Readonly<{
  approvedBy: string;
  canExecute: boolean;
  confirmed: boolean;
  copy: LocalModelCopy;
  locale: StudioLocale;
  onApprovedByChange: (value: string) => void;
  onConfirmedChange: (value: boolean) => void;
  onExecute: () => void;
  preparation: Preparation;
  submitting: boolean;
}>) {
  return (
    <div className='bg-background/60 grid gap-4 rounded-xl border border-(--line) p-4'>
      <div className='flex flex-wrap items-start justify-between gap-3'>
        <div>
          <p className='font-medium'>{copy.preflightTitle}</p>
          <p className='text-muted-foreground mt-1 text-sm'>{copy.preflightDescription}</p>
        </div>
        <Badge variant='secondary'>{copy.noCost}</Badge>
      </div>
      <div className='grid gap-2 text-sm sm:grid-cols-3'>
        <Fact
          label={copy.duration}
          value={formatLocalModelDuration(preparation.estimatedDurationSeconds, locale)}
        />
        <Fact label={copy.disk} value={formatLocalModelBytes(preparation.estimatedDiskBytes)} />
        <Fact label={copy.cost} value={copy.free} />
      </div>
      <div className='grid gap-2'>
        <Label htmlFor='local-model-approved-by'>{copy.approvedBy}</Label>
        <Input
          id='local-model-approved-by'
          maxLength={160}
          value={approvedBy}
          onChange={(event) => onApprovedByChange(event.target.value)}
        />
        <div className='flex items-start gap-2 text-sm'>
          <Checkbox
            checked={confirmed}
            id='local-model-confirm'
            onCheckedChange={(value) => onConfirmedChange(value === true)}
          />
          <Label className='leading-snug' htmlFor='local-model-confirm'>
            {copy.confirmExecution}
          </Label>
        </div>
      </div>
      <Button disabled={!canExecute || submitting} onClick={onExecute}>
        <ShieldCheckIcon aria-hidden='true' />
        {copy.approveAndQueue}
      </Button>
    </div>
  );
}

/**
 * Displays the latest guarded action result with severity appropriate to its state.
 *
 * @param state - The submission state and message to display; idle state produces no output.
 * @returns An alert for non-idle states, or `null` when no action result is available.
 */
export function LocalModelActionStatus({
  copy,
  state,
}: Readonly<{ copy: LocalModelCopy; state: StudioGuardedActionSubmitState }>) {
  if (state.kind === "idle") return null;
  const isProblem = state.kind === "blocked" || state.kind === "error";
  return (
    <Alert
      aria-live={isProblem ? "assertive" : "polite"}
      variant={isProblem ? "destructive" : "default"}
    >
      <AlertTitle className='flex items-center justify-between gap-3'>
        {copy.latestResult}
        <Badge variant={isProblem ? "destructive" : "secondary"}>
          {copy.actionStatus[state.kind]}
        </Badge>
      </AlertTitle>
      <AlertDescription>{state.message}</AlertDescription>
    </Alert>
  );
}

export function Fact({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className='grid gap-0.5'>
      <dt className='text-muted-foreground text-xs'>{label}</dt>
      <dd className='font-medium'>{value}</dd>
    </div>
  );
}

export function LocalModelFacts({
  copy,
  overview,
}: Readonly<{ copy: LocalModelCopy; overview: StudioLocalModelOverview }>) {
  const diskEstimate = overview.preparation
    ? formatLocalModelBytes(overview.preparation.estimatedDiskBytes)
    : copy.diskEstimate;

  return (
    <div className='grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4'>
      <Fact label={copy.model} value='FLUX.2 Klein 4B · q4' />
      <Fact label={copy.runtime} value='MFLUX 0.18.0 · Python 3.12' />
      <Fact label={copy.disk} value={diskEstimate} />
      <Fact label={copy.progress} value={localModelReadinessLabel(copy, overview)} />
    </div>
  );
}

export function LocalModelAdvancedDetails({
  copy,
  overview,
  packageId,
}: Readonly<{ copy: LocalModelCopy; overview: StudioLocalModelOverview; packageId: string }>) {
  return (
    <details className='text-muted-foreground text-xs'>
      <summary className='cursor-pointer font-medium'>{copy.advanced}</summary>
      <dl className='mt-3 grid gap-1 break-all'>
        <div>
          {copy.package}: {packageId}
        </div>
        <div>
          {copy.runtimePath}: {overview.runtimePath}
        </div>
        {overview.latestOperation ? (
          <>
            <div>
              {copy.latestOperation}: {overview.latestOperation.operationId} ·{" "}
              {overview.latestOperation.status}
            </div>
            {overview.latestOperation.message ? (
              <div>
                {copy.latestDiagnostic}: {overview.latestOperation.message}
              </div>
            ) : null}
          </>
        ) : null}
        {overview.preparation ? (
          <div>
            {copy.binding}: {overview.preparation.bindingDigest}
          </div>
        ) : null}
      </dl>
    </details>
  );
}

export function ReadinessBadge({
  label,
  readiness,
}: Readonly<{ label: string; readiness: StudioLocalModelOverview["readiness"] }>) {
  return <Badge variant={readinessVariant(readiness)}>{label}</Badge>;
}

function readinessVariant(
  readiness: StudioLocalModelOverview["readiness"],
): "destructive" | "outline" | "secondary" {
  if (readiness === "failed") return "destructive";
  if (readiness === "ready") return "secondary";
  return "outline";
}
