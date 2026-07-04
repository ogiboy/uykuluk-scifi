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
import {
  isStudioPackageArtifactRevisionState,
  type StudioPackageRevisionSource,
} from "@/lib/revisionSources";
import type { StudioRunDetail } from "@/lib/runSummaries";
import { useStudioGuardedActionSubmit } from "@/lib/useStudioGuardedActionSubmit";
import { StudioMutationResultPanel } from "../studio/StudioMutationResultPanel";
import { RunRevisionConfirmationDialog } from "./RunRevisionConfirmationDialog";

type RunPackageArtifactRevisionActionPanelProps = Readonly<{
  run: Pick<StudioRunDetail, "revisionSources" | "runId" | "state">;
}>;

type FormSubmitEvent = Readonly<{
  preventDefault: () => void;
}>;

type PackageArtifactDrafts = Record<string, string>;

/**
 * Renders bounded production-package artifact revision controls for Studio.
 *
 * @param run - The run detail projection containing package artifact sources.
 */
export function RunPackageArtifactRevisionActionPanel({
  run,
}: RunPackageArtifactRevisionActionPanelProps) {
  if (!isStudioPackageArtifactRevisionState(run.state)) {
    return null;
  }
  return <RunPackageArtifactRevisionForm key={packageSourcesKey(run)} run={run} />;
}

function RunPackageArtifactRevisionForm({ run }: RunPackageArtifactRevisionActionPanelProps) {
  const packageArtifacts = run.revisionSources.packageArtifacts;
  const availableSources = packageArtifacts.filter((source) => source.available);
  const [artifactKey, setArtifactKey] = useState(availableSources[0]?.artifactKey ?? "subtitles");
  const selectedSource =
    availableSources.find((source) => source.artifactKey === artifactKey) ?? availableSources[0];
  const [draftsByArtifactKey, setDraftsByArtifactKey] = useState<PackageArtifactDrafts>(() =>
    draftsFromSources(availableSources),
  );
  const [editor, setEditor] = useState("operator");
  const [reason, setReason] = useState("");
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const { state, submit } = useStudioGuardedActionSubmit(
    "Package artifact revisions refresh manifest evidence and invalidate downstream artifacts.",
  );
  const content = selectedSource
    ? (draftsByArtifactKey[selectedSource.artifactKey] ?? selectedSource.content)
    : "";
  const ready =
    Boolean(selectedSource) &&
    content.trim() !== "" &&
    editor.trim() !== "" &&
    reason.trim() !== "";

  function selectArtifact(nextArtifactKey: string): void {
    const nextSource = availableSources.find((source) => source.artifactKey === nextArtifactKey);
    if (!nextSource) return;
    setArtifactKey(nextSource.artifactKey);
  }

  function requestConfirmation(event: FormSubmitEvent): void {
    event.preventDefault();
    if (!ready) return;
    setConfirmationOpen(true);
  }

  async function confirmRevision(): Promise<void> {
    if (!selectedSource || !ready) return;
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
            onChange={(event) => setArtifactDraft(selectedSource, event.target.value)}
          />
        </label>
        <Button disabled={state.kind === "submitting" || !ready} type='submit'>
          {state.kind === "submitting" ? "Recording..." : "Record package revision"}
        </Button>
      </form>
      <StudioMutationResultPanel state={state} />
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

  function setArtifactDraft(
    source: StudioPackageRevisionSource | undefined,
    nextContent: string,
  ): void {
    if (!source) return;
    setDraftsByArtifactKey((current) => ({
      ...current,
      [source.artifactKey]: nextContent,
    }));
  }
}

function packageSourcesKey(run: RunPackageArtifactRevisionActionPanelProps["run"]): string {
  const sourceKey = run.revisionSources.packageArtifacts
    .map((source) => `${source.artifactKey}:${source.available}:${source.path}:${source.content}`)
    .join("\u0000");
  return `${run.runId}:${sourceKey}`;
}

function draftsFromSources(sources: readonly StudioPackageRevisionSource[]): PackageArtifactDrafts {
  const drafts: PackageArtifactDrafts = {};
  for (const source of sources) {
    drafts[source.artifactKey] = source.content;
  }
  return drafts;
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
