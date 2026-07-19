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
import { formatLocalModelBytes, formatLocalModelDuration } from "./localModelReadinessFormatting";

type Preparation = NonNullable<StudioLocalModelOverview["preparation"]>;

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
