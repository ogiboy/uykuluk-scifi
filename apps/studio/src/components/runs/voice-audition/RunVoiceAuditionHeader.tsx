"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { StudioVoiceAuditionSummary } from "@/lib/runs/voiceAuditionSummaries";
import { RefreshCwIcon, ShieldCheckIcon } from "lucide-react";

type RunVoiceAuditionHeaderProps = Readonly<{
  busy: boolean;
  summary: StudioVoiceAuditionSummary;
  onRequestCandidates: () => void;
}>;

/** Presents catalog status and the explicit operator-triggered refresh boundary. */
export function RunVoiceAuditionHeader({
  busy,
  summary,
  onRequestCandidates,
}: RunVoiceAuditionHeaderProps) {
  return (
    <>
      <div className='flex flex-wrap items-start justify-between gap-3'>
        <div className='grid gap-1'>
          <div className='flex flex-wrap items-center gap-2'>
            <Badge variant={catalogVariant(summary.catalog.kind)}>{summary.catalog.kind}</Badge>
            {summary.catalog.modelId ? (
              <Badge variant='outline'>{summary.catalog.modelId}</Badge>
            ) : null}
            <Badge variant='outline'>{summary.candidates.length}/24 candidates</Badge>
          </div>
          <p className='text-muted-foreground text-sm'>{summary.catalog.message}</p>
        </div>
        <Button
          disabled={busy || !summary.actions["voice.candidates"]}
          type='button'
          variant='secondary'
          onClick={onRequestCandidates}
        >
          <RefreshCwIcon />
          {summary.catalog.kind === "missing" ? "Fetch candidates" : "Refresh candidates"}
        </Button>
      </div>

      <Alert>
        <ShieldCheckIcon />
        <AlertTitle>
          {summary.executionMode === "local" ? "Local TTS fallback" : "Explicit provider boundary"}
        </AlertTitle>
        <AlertDescription>
          {summary.executionModeMessage} Opening this page performs no provider request; playback is
          limited to validated local run media.
        </AlertDescription>
      </Alert>
    </>
  );
}

function catalogVariant(
  kind: StudioVoiceAuditionSummary["catalog"]["kind"],
): "destructive" | "outline" | "secondary" {
  if (kind === "invalid") return "destructive";
  if (kind === "ready") return "secondary";
  return "outline";
}
