"use client";

import { useMemo, useState } from "react";

import { StudioMutationResultPanel } from "@/components/studio/StudioMutationResultPanel";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useStudioGuardedActionSubmit } from "@/lib/useStudioGuardedActionSubmit";

const maxCandidateCount = 12;
const maxCandidateLength = 240;

/**
 * Renders the guarded Studio action that refreshes local model candidate eval evidence.
 */
export function ModelEvalCandidateRunActionPanel() {
  const [candidateText, setCandidateText] = useState("");
  const [includeLocalGguf, setIncludeLocalGguf] = useState(false);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const candidates = useMemo(() => parseCandidateText(candidateText), [candidateText]);
  const validationMessage = candidateValidationMessage(candidates, includeLocalGguf);
  const { state, submit } = useStudioGuardedActionSubmit(
    "Runs candidate local parser-contract eval through the canonical producer CLI.",
  );
  const submitting = state.kind === "submitting";

  async function runCandidateEval(): Promise<void> {
    if (validationMessage) {
      return;
    }
    setConfirmationOpen(false);
    await submit({
      actionId: "model-eval-candidates.run",
      body: { candidates, includeLocalGguf },
      errorToastTitle: "Candidate model evaluation was blocked",
      fallbackError: "Candidate model evaluation could not complete.",
      routePath: "/actions/run-model-eval-candidates",
      submittingMessage: "Running candidate local model evaluation...",
      successMessage:
        "Candidate model evaluation refreshed. Studio is reloading diagnostics artifacts.",
      successToastTitle: "Candidate evaluation refreshed",
    });
  }

  return (
    <div className='bg-muted/20 grid gap-4 rounded-xl p-4'>
      <div className='grid gap-2'>
        <Label htmlFor='model-eval-candidates'>Candidate models</Label>
        <Textarea
          aria-describedby='model-eval-candidates-help model-eval-candidates-error'
          aria-invalid={Boolean(validationMessage)}
          disabled={submitting}
          id='model-eval-candidates'
          placeholder='gemma-3-4b-it-q4_0, llama-3.2-3b-instruct-q4_k_m'
          value={candidateText}
          onChange={(event) => setCandidateText(event.target.value)}
        />
        <p className='text-muted-foreground text-xs' id='model-eval-candidates-help'>
          Separate up to {maxCandidateCount} local provider model names with commas or new lines.
          This does not edit config or download models.
        </p>
        {validationMessage ? (
          <p className='text-destructive text-xs' id='model-eval-candidates-error'>
            {validationMessage}
          </p>
        ) : null}
      </div>
      <div className='flex items-start gap-3'>
        <Checkbox
          checked={includeLocalGguf}
          disabled={submitting}
          id='model-eval-local-gguf'
          onCheckedChange={(checked) => setIncludeLocalGguf(checked === true)}
        />
        <Label className='grid gap-1 leading-snug' htmlFor='model-eval-local-gguf'>
          <span>Include ignored local GGUF discovery</span>
          <span className='text-muted-foreground text-xs font-normal'>
            Adds `--include-local-gguf` so the CLI can include workstation-local GGUF files already
            outside tracked source.
          </span>
        </Label>
      </div>
      <div className='flex flex-wrap items-center gap-3'>
        <Button
          disabled={Boolean(validationMessage) || submitting}
          type='button'
          onClick={() => setConfirmationOpen(true)}
        >
          {submitting ? "Running candidates..." : "Run candidate eval"}
        </Button>
        <p className='text-muted-foreground text-xs'>
          {candidates.length} named candidate{candidates.length === 1 ? "" : "s"} selected
          {includeLocalGguf ? " · local GGUF discovery enabled" : ""}.
        </p>
      </div>
      {state.kind !== "idle" ? <StudioMutationResultPanel state={state} /> : null}
      <Dialog open={confirmationOpen} onOpenChange={setConfirmationOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Run candidate local model evaluation</DialogTitle>
            <DialogDescription>
              Studio will call the guarded candidate-eval route. The command may contact local
              providers and write ignored diagnostics artifacts, but it does not mutate provider
              config, download models, create runs, approve stages, upload media, or publish
              content.
            </DialogDescription>
          </DialogHeader>
          <dl className='grid gap-3 text-sm sm:grid-cols-2'>
            <div>
              <dt className='text-muted-foreground font-medium'>Action</dt>
              <dd className='break-all'>model-eval-candidates.run</dd>
            </div>
            <div>
              <dt className='text-muted-foreground font-medium'>Route</dt>
              <dd className='break-all'>/actions/run-model-eval-candidates</dd>
            </div>
            <div>
              <dt className='text-muted-foreground font-medium'>Named candidates</dt>
              <dd>{candidates.length ? candidates.join(", ") : "none"}</dd>
            </div>
            <div>
              <dt className='text-muted-foreground font-medium'>Local GGUF discovery</dt>
              <dd>{includeLocalGguf ? "enabled" : "disabled"}</dd>
            </div>
          </dl>
          <DialogFooter showCloseButton>
            <Button disabled={submitting} type='button' onClick={() => void runCandidateEval()}>
              Run candidate eval
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function parseCandidateText(value: string): string[] {
  const seen = new Set<string>();
  const candidates: string[] = [];
  for (const candidate of value.split(/[\n,]+/).map((item) => item.trim())) {
    if (!candidate || seen.has(candidate)) {
      continue;
    }
    seen.add(candidate);
    candidates.push(candidate);
  }
  return candidates;
}

function candidateValidationMessage(candidates: readonly string[], includeLocalGguf: boolean) {
  if (candidates.length > maxCandidateCount) {
    return `Use ${maxCandidateCount} or fewer named candidates.`;
  }
  if (candidates.some((candidate) => candidate.length > maxCandidateLength)) {
    return `Each candidate model name must be ${maxCandidateLength} characters or shorter.`;
  }
  if (!includeLocalGguf && candidates.length === 0) {
    return "Add at least one candidate model or enable local GGUF discovery.";
  }
  return null;
}
