import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { StudioVoiceProductionSummary } from "@/lib/runs/voiceAuditionSummaryTypes";
import { Mic2Icon } from "lucide-react";

type VoiceProductionExecutionControlProps = Readonly<{
  alreadyReady: boolean;
  busy: boolean;
  confirmation: StudioVoiceProductionSummary["hostedExecution"];
  confirmed: boolean;
  executionMode: "hosted" | "local" | "unknown";
  submitAvailable: boolean;
  onConfirmedChange: (checked: boolean) => void;
  onSubmit: () => void;
}>;

/** Collects the final explicit confirmation for the exact approved hosted voice operation. */
export function VoiceProductionExecutionControl({
  alreadyReady,
  busy,
  confirmation,
  confirmed,
  executionMode,
  submitAvailable,
  onConfirmedChange,
  onSubmit,
}: VoiceProductionExecutionControlProps) {
  if (executionMode === "unknown" || (executionMode === "hosted" && !confirmation)) return null;
  const hosted = executionMode === "hosted";
  return (
    <section
      className='border-primary/30 bg-primary/5 grid gap-3 rounded-lg border p-4'
      aria-labelledby='voice-production-execution-heading'
    >
      <div>
        <h3 className='font-semibold' id='voice-production-execution-heading'>
          Production voice
        </h3>
        <p className='text-muted-foreground mt-1 text-sm'>
          {hosted
            ? "The selected voice, binding, quote, and approval are ready. Core will compare these exact persisted values again immediately before any new hosted synthesis request."
            : "Generate the configured local voice without a paid-operation confirmation. Core still rechecks readiness and registered inputs."}
        </p>
      </div>
      {hosted ? (
        <div className='grid gap-3'>
          <dl className='bg-background grid gap-2 rounded-md border p-3 text-sm'>
            <VoiceExecutionIdentity label='Approval ID' value={confirmation!.approvalId} />
            <VoiceExecutionIdentity label='Binding digest' value={confirmation!.bindingDigest} />
            <VoiceExecutionIdentity label='Quote digest' value={confirmation!.quoteDigest} />
          </dl>
          <div className='flex items-start gap-2'>
            <Checkbox
              checked={confirmed}
              disabled={alreadyReady || busy}
              id='confirm-paid-voice-operation'
              onCheckedChange={(checked) => onConfirmedChange(checked === true)}
            />
            <Label className='leading-snug' htmlFor='confirm-paid-voice-operation'>
              I confirm the exact approval ID, binding digest, and quote digest shown above.
            </Label>
          </div>
        </div>
      ) : null}
      <div>
        <Button
          disabled={alreadyReady || busy || !submitAvailable || (hosted && !confirmed)}
          type='button'
          onClick={onSubmit}
        >
          <Mic2Icon />
          {alreadyReady
            ? "Production voice ready"
            : hosted
              ? "Synthesize production voice"
              : "Generate local voice"}
        </Button>
      </div>
    </section>
  );
}

function VoiceExecutionIdentity({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className='grid gap-1 sm:grid-cols-[8rem_minmax(0,1fr)]'>
      <dt className='text-muted-foreground'>{label}</dt>
      <dd>
        <code className='break-all'>{value}</code>
      </dd>
    </div>
  );
}
