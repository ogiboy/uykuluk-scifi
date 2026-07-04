"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { StudioRunDetail } from "@/lib/runSummaries";
import { useStudioGuardedActionSubmit } from "@/lib/useStudioGuardedActionSubmit";
import { StudioMutationResultPanel } from "../studio/StudioMutationResultPanel";
import { RunRevisionConfirmationDialog } from "./RunRevisionConfirmationDialog";

type RunScriptRevisionActionPanelProps = Readonly<{
  run: Pick<StudioRunDetail, "revisionSources" | "runId" | "state">;
}>;

type FormSubmitEvent = Readonly<{
  preventDefault: () => void;
}>;

const scriptRevisionStates = new Set(["SCRIPT_GENERATED", "SCRIPT_REVIEWED", "SCRIPT_APPROVED"]);

/**
 * Renders a guarded script revision form for states where CLI/core allows script edits.
 *
 * @param run - The run detail projection containing revision source content.
 */
export function RunScriptRevisionActionPanel({ run }: RunScriptRevisionActionPanelProps) {
  const source = run.revisionSources.script;
  const [content, setContent] = useState(source.content);
  const [editor, setEditor] = useState("operator");
  const [reason, setReason] = useState("");
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const { state, submit } = useStudioGuardedActionSubmit(
    "Script revisions write durable before/after evidence and require review again.",
  );

  if (!scriptRevisionStates.has(run.state)) {
    return null;
  }

  function requestConfirmation(event: FormSubmitEvent): void {
    event.preventDefault();
    setConfirmationOpen(true);
  }

  async function confirmRevision(): Promise<void> {
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

  const ready =
    source.available && content.trim() !== "" && editor.trim() !== "" && reason.trim() !== "";

  return (
    <section className='revision-action-panel' aria-labelledby='script-revision-heading'>
      <h3 id='script-revision-heading'>Revise script</h3>
      <p>{source.message}</p>
      <form className='studio-form' onSubmit={requestConfirmation}>
        <label>
          Editor
          <Input value={editor} onChange={(event) => setEditor(event.target.value)} />
        </label>
        <label>
          Reason
          <Input value={reason} onChange={(event) => setReason(event.target.value)} />
        </label>
        <label>
          Script content
          <Textarea
            disabled={!source.available}
            rows={12}
            value={content}
            onChange={(event) => setContent(event.target.value)}
          />
        </label>
        <Button disabled={state.kind === "submitting" || !ready} type='submit'>
          {state.kind === "submitting" ? "Recording..." : "Record script revision"}
        </Button>
      </form>
      <StudioMutationResultPanel state={state} />
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
