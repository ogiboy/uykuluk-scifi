"use client";

import { StudioMutationResultPanel } from "@/components/studio/StudioMutationResultPanel";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { StudioLocale } from "@/i18n/locales";
import { useStudioGuardedActionSubmit } from "@/lib/mutations/useStudioGuardedActionSubmit";
import type {
  StudioSoundtrackActionBinding,
  StudioSoundtrackSummary,
} from "@/lib/runs/soundtrackSummaries";
import { RunDetailCard } from "../RunDetailCard";
import { SoundtrackMediaSections } from "./SoundtrackMediaSections";
import {
  SoundtrackReviewSections,
  soundtrackWorkspaceCopy,
  type SoundtrackExpectedBinding,
} from "./SoundtrackWorkspaceReview";

type RunSoundtrackWorkspaceProps = Readonly<{
  locale: StudioLocale;
  runId: string;
  summary: StudioSoundtrackSummary;
}>;

/** Operator workspace for revision-bound soundtrack import, mix configuration, and review. */
export function RunSoundtrackWorkspace({ locale, runId, summary }: RunSoundtrackWorkspaceProps) {
  const copy = soundtrackWorkspaceCopy(locale);
  const { reportError, state, submit } = useStudioGuardedActionSubmit(copy.nextAction);
  const busy = state.kind === "submitting";
  const expected = soundtrackExpectedBinding(summary);

  async function runAction(
    action: StudioSoundtrackActionBinding | null,
    body: unknown,
    title: string,
    success: string,
  ): Promise<void> {
    if (!action) return;
    await submit({
      actionId: action.actionId,
      body,
      errorToastTitle: title,
      fallbackError: summary.message,
      routePath: action.routePath,
      submittingMessage: title,
      successMessage: success,
      successToastTitle: title,
    });
  }

  return (
    <RunDetailCard
      headingId='soundtrack-workspace-heading'
      title={copy.panelTitle}
      description={copy.panelDescription}
    >
      <SoundtrackStatus copy={copy} summary={summary} />
      {summary.kind === "invalid" ? (
        <Alert variant='destructive'>
          <AlertTitle>{copy.invalid}</AlertTitle>
          <AlertDescription>{summary.message}</AlertDescription>
        </Alert>
      ) : null}
      {summary.kind === "missing" ? (
        <Button
          disabled={busy || !summary.actions["soundtrack.prepare"]}
          onClick={() =>
            void runAction(
              summary.actions["soundtrack.prepare"],
              { runId },
              copy.prepareBlocked,
              copy.prepareSuccess,
            )
          }
        >
          {copy.prepare}
        </Button>
      ) : null}
      {summary.kind === "ready" && expected ? (
        <>
          <SoundtrackMixSummary copy={copy} summary={summary} />
          <SoundtrackMediaSections
            busy={busy}
            copy={copy}
            expected={expected}
            reportError={reportError}
            runAction={runAction}
            runId={runId}
            summary={summary}
          />
          <SoundtrackReviewSections
            busy={busy}
            copy={copy}
            expected={expected}
            runAction={runAction}
            runId={runId}
            summary={summary}
          />
        </>
      ) : null}
      <Alert>
        <AlertTitle>{copy.nextAction}</AlertTitle>
        <AlertDescription>{summary.nextAction}</AlertDescription>
      </Alert>
      <StudioMutationResultPanel state={state} />
      <details className='text-muted-foreground text-xs'>
        <summary className='cursor-pointer font-medium'>{copy.advanced}</summary>
        <ul className='mt-2 grid gap-1 font-mono'>
          {summary.advanced.paths.map((artifactPath) => (
            <li className='break-all' key={artifactPath}>
              {artifactPath}
            </li>
          ))}
        </ul>
      </details>
    </RunDetailCard>
  );
}

function SoundtrackStatus({
  copy,
  summary,
}: Readonly<{
  copy: ReturnType<typeof soundtrackWorkspaceCopy>;
  summary: StudioSoundtrackSummary;
}>) {
  return (
    <div className='flex flex-wrap items-center gap-2'>
      <Badge variant={summary.kind === "invalid" ? "destructive" : "secondary"}>
        {copy.status(summary.kind, summary.mode)}
      </Badge>
      {summary.revision ? (
        <Badge variant='outline'>
          {copy.revision} {summary.revision}
        </Badge>
      ) : null}
      {summary.digest ? (
        <span className='text-muted-foreground font-mono text-xs break-all'>
          {copy.digest}: {summary.digest}
        </span>
      ) : null}
    </div>
  );
}

function SoundtrackMixSummary({
  copy,
  summary,
}: Readonly<{
  copy: ReturnType<typeof soundtrackWorkspaceCopy>;
  summary: StudioSoundtrackSummary;
}>) {
  return (
    <section className='grid gap-3 rounded-lg border border-(--line) p-4'>
      <h3 className='font-semibold'>{copy.mix}</h3>
      <p className='text-muted-foreground text-sm'>
        {summary.mix.music
          ? `${copy.music}: ${summary.mix.music.assetId} (${summary.mix.music.gainDb} dB)`
          : copy.voiceOnly}
      </p>
      <p className='text-muted-foreground text-sm'>
        {copy.sfxCues}: {summary.mix.sfxCueCount}
      </p>
      {summary.mix.sfx.length > 0 ? (
        <ul className='text-muted-foreground grid gap-1 text-sm'>
          {summary.mix.sfx.map((cue) => (
            <li key={cue.cueId}>
              {cue.cueId}: {cue.assetId} · {cue.startSeconds}s · {cue.durationSeconds}s
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function soundtrackExpectedBinding(
  summary: StudioSoundtrackSummary,
): SoundtrackExpectedBinding | null {
  if (!summary.digest || !summary.revision) return null;
  return { expectedManifestDigest: summary.digest, expectedRevision: summary.revision };
}
