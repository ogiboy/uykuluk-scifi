"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { StudioPackageRevisionSource } from "@/lib/revisionSources";
import type { StudioRunDetail } from "@/lib/runSummaries";
import { useStudioGuardedActionSubmit } from "@/lib/useStudioGuardedActionSubmit";
import { RunRevisionConfirmationDialog } from "./RunRevisionConfirmationDialog";

type RunPackageArtifactRevisionActionPanelProps = Readonly<{
  run: Pick<StudioRunDetail, "revisionSources" | "runId" | "state">;
}>;

type FormSubmitEvent = Readonly<{
  preventDefault: () => void;
}>;

/**
 * Renders bounded production-package artifact revision controls for Studio.
 *
 * @param run - The run detail projection containing package artifact sources.
 */
export function RunPackageArtifactRevisionActionPanel({
  run,
}: RunPackageArtifactRevisionActionPanelProps) {
  const availableSources = run.revisionSources.packageArtifacts.filter(
    (source) => source.available,
  );
  const [artifactKey, setArtifactKey] = useState(availableSources[0]?.artifactKey ?? "subtitles");
  const selectedSource =
    availableSources.find((source) => source.artifactKey === artifactKey) ?? availableSources[0];
  const [content, setContent] = useState(selectedSource?.content ?? "");
  const [editor, setEditor] = useState("operator");
  const [reason, setReason] = useState("");
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const { state, submit } = useStudioGuardedActionSubmit(
    "Package artifact revisions refresh manifest evidence and invalidate downstream artifacts.",
  );

  if (run.state !== "PRODUCTION_PACKAGE_GENERATED") {
    return null;
  }

  function selectArtifact(nextArtifactKey: string): void {
    const nextSource = availableSources.find((source) => source.artifactKey === nextArtifactKey);
    if (!nextSource) return;
    setArtifactKey(nextSource.artifactKey);
    setContent(nextSource.content);
  }

  function requestConfirmation(event: FormSubmitEvent): void {
    event.preventDefault();
    setConfirmationOpen(true);
  }

  async function confirmRevision(): Promise<void> {
    if (!selectedSource) return;
    setConfirmationOpen(false);
    await submit({
      actionId: "package-artifact.revise",
      body: { artifactKey: selectedSource.artifactKey, content, editor, reason, runId: run.runId },
      errorToastTitle: "Package artifact revision was blocked",
      fallbackError: "Package artifact revision could not be recorded.",
      routePath: "/actions/revise-package-artifact",
      submittingMessage: "Recording package artifact revision...",
      successMessage: "Package artifact revision recorded. Regenerate evidence/readiness next.",
      successToastTitle: "Package artifact revision recorded",
    });
  }

  const ready =
    Boolean(selectedSource) &&
    content.trim() !== "" &&
    editor.trim() !== "" &&
    reason.trim() !== "";

  return (
    <section className='revision-action-panel' aria-labelledby='package-revision-heading'>
      <h3 id='package-revision-heading'>Revise package artifact</h3>
      <p>
        Revisions are limited to immediate post-package state. Downstream render-plan, evidence, and
        readiness artifacts are invalidated by CLI/core.
      </p>
      <form className='studio-form' onSubmit={requestConfirmation}>
        <label>
          Artifact
          <Select value={selectedSource?.artifactKey ?? ""} onValueChange={selectArtifact}>
            <SelectTrigger aria-label='Package artifact revision target'>
              <SelectValue placeholder='Choose artifact' />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {availableSources.map((source) => (
                  <SelectItem key={source.artifactKey} value={source.artifactKey}>
                    {source.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </label>
        {selectedSource ? <p className='artifact-action'>{selectedSource.path}</p> : null}
        <UnavailablePackageSources sources={run.revisionSources.packageArtifacts} />
        <label>
          Editor
          <Input value={editor} onChange={(event) => setEditor(event.target.value)} />
        </label>
        <label>
          Reason
          <Input value={reason} onChange={(event) => setReason(event.target.value)} />
        </label>
        <label>
          Revised content
          <Textarea
            disabled={!selectedSource}
            rows={10}
            value={content}
            onChange={(event) => setContent(event.target.value)}
          />
        </label>
        <Button disabled={state.kind === "submitting" || !ready} type='submit'>
          {state.kind === "submitting" ? "Recording..." : "Record package revision"}
        </Button>
      </form>
      <p className={state.kind === "error" || state.kind === "blocked" ? "blocked" : undefined}>
        {state.message}
      </p>
      <RunRevisionConfirmationDialog
        actionLabel='package-artifact.revise'
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

function UnavailablePackageSources({
  sources,
}: Readonly<{ sources: readonly StudioPackageRevisionSource[] }>) {
  const unavailable = sources.filter((source) => !source.available);
  if (unavailable.length === 0) {
    return null;
  }
  return (
    <p className='artifact-description'>
      Unavailable: {unavailable.map((source) => `${source.label} (${source.message})`).join("; ")}
    </p>
  );
}
