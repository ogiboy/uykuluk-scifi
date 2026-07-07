"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { StudioRunDetail } from "@/lib/runSummaries";
import { isStudioScriptRevisionState } from "@/lib/studioRevisionEligibility";
import { useStudioGuardedActionSubmit } from "@/lib/useStudioGuardedActionSubmit";
import { useState } from "react";
import { StudioMutationResultPanel } from "../studio/StudioMutationResultPanel";
import { RunRevisionConfirmationDialog } from "./RunRevisionConfirmationDialog";

type RunScriptRevisionActionPanelProps = Readonly<{
  run: Pick<StudioRunDetail, "revisionSources" | "runId" | "state">;
}>;

type FormSubmitEvent = Readonly<{ preventDefault: () => void }>;

/**
 * Renders a guarded script revision form for states where CLI/core allows script edits.
 *
 * @param run - The run detail projection containing revision source content.
 */
export function RunScriptRevisionActionPanel({ run }: RunScriptRevisionActionPanelProps) {
  if (!isStudioScriptRevisionState(run.state)) {
    return null;
  }
  return (
    <RunScriptRevisionForm key={`${run.runId}:${run.revisionSources.script.content}`} run={run} />
  );
}

function RunScriptRevisionForm({ run }: RunScriptRevisionActionPanelProps) {
  const source = run.revisionSources.script;
  const [content, setContent] = useState(source.content);
  const [editor, setEditor] = useState("operator");
  const [reason, setReason] = useState("");
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const { state, submit } = useStudioGuardedActionSubmit(
    "Script revisions write durable before/after evidence and require review again.",
  );
  const ready =
    source.available && content.trim() !== "" && editor.trim() !== "" && reason.trim() !== "";

  function requestConfirmation(event: FormSubmitEvent): void {
    event.preventDefault();
    if (!ready) return;
    setConfirmationOpen(true);
  }

  async function confirmRevision(): Promise<void> {
    if (!ready) return;
    setConfirmationOpen(false);
    await submit({
      actionId: "script.revise",
      body: { content, editor, reason, runId: run.runId },
      errorToastTitle: "Script revision was blocked",
      fallbackError: "Script revision could not be recorded.",
      routePath: "/actions/revise-script",
      submittingMessage: "Recording script revision...",
      successMessage: "Script revision recorded. Review and approval are required again.",
      successToastTitle: "Script revision recorded",
    });
  }

  return (
    <section aria-labelledby='script-revision-heading'>
      <Card className='bg-card/70 border-dashed shadow-none'>
        <CardHeader>
          <CardTitle id='script-revision-heading'>Revise script</CardTitle>
          <CardDescription>{source.message}</CardDescription>
        </CardHeader>
        <CardContent>
          <form className='grid gap-4' onSubmit={requestConfirmation}>
            <Label className='grid gap-2'>
              <span>Editor</span>
              <Input value={editor} onChange={(event) => setEditor(event.target.value)} />
            </Label>
            <Label className='grid gap-2'>
              <span>Reason</span>
              <Input value={reason} onChange={(event) => setReason(event.target.value)} />
            </Label>
            <Label className='grid gap-2'>
              <span>Script content</span>
              <Textarea
                disabled={!source.available}
                rows={12}
                value={content}
                onChange={(event) => setContent(event.target.value)}
              />
            </Label>
            <Button disabled={state.kind === "submitting" || !ready} type='submit'>
              {state.kind === "submitting" ? "Recording..." : "Record script revision"}
            </Button>
          </form>
        </CardContent>
        <CardFooter className='block'>
          <StudioMutationResultPanel state={state} />
        </CardFooter>
      </Card>
      <RunRevisionConfirmationDialog
        actionLabel='script.revise'
        currentState={run.state}
        isSubmitting={state.kind === "submitting"}
        open={confirmationOpen}
        reason={reason}
        runId={run.runId}
        onConfirm={() => void confirmRevision()}
        onOpenChange={setConfirmationOpen}
      />
    </section>
  );
}
