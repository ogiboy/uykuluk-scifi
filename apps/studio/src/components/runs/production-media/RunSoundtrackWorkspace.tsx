"use client";

import { StudioMutationResultPanel } from "@/components/studio/StudioMutationResultPanel";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { StudioLocale } from "@/i18n/locales";
import { useStudioGuardedActionSubmit } from "@/lib/mutations/useStudioGuardedActionSubmit";
import type {
  StudioSoundtrackActionBinding,
  StudioSoundtrackSummary,
} from "@/lib/runs/soundtrackSummaries";
import { useState } from "react";
import { RunDetailCard } from "../RunDetailCard";
import { soundtrackWorkspaceCopy } from "./soundtrackWorkspaceCopy";

type RunSoundtrackWorkspaceProps = Readonly<{
  locale: StudioLocale;
  runId: string;
  summary: StudioSoundtrackSummary;
}>;

/** Operator workspace for revision-bound soundtrack import, mix configuration, and review. */
export function RunSoundtrackWorkspace({ locale, runId, summary }: RunSoundtrackWorkspaceProps) {
  const copy = soundtrackWorkspaceCopy(locale);
  const { reportError, state, submit } = useStudioGuardedActionSubmit(copy.nextAction);
  const [reviewedBy, setReviewedBy] = useState("");
  const [notes, setNotes] = useState("");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [assetId, setAssetId] = useState("");
  const [assetRole, setAssetRole] = useState<"music" | "sfx">("music");
  const [importedBy, setImportedBy] = useState("");
  const [rightsBasis, setRightsBasis] = useState<
    "licensed" | "owned" | "permission-granted" | "public-domain"
  >("licensed");
  const [rightsEvidence, setRightsEvidence] = useState("");
  const [musicAssetId, setMusicAssetId] = useState(summary.mix.music?.assetId ?? "");
  const [musicGainDb, setMusicGainDb] = useState(String(summary.mix.music?.gainDb ?? -18));
  const [musicTrimStart, setMusicTrimStart] = useState(
    String(summary.mix.music?.trimStartSeconds ?? 0),
  );
  const [musicFadeIn, setMusicFadeIn] = useState(String(summary.mix.music?.fadeInSeconds ?? 1));
  const [musicFadeOut, setMusicFadeOut] = useState(String(summary.mix.music?.fadeOutSeconds ?? 1));
  const [sfxAssetId, setSfxAssetId] = useState("");
  const [sfxCueId, setSfxCueId] = useState("");
  const [sfxStart, setSfxStart] = useState("0");
  const [sfxDuration, setSfxDuration] = useState("1");
  const [sfxGainDb, setSfxGainDb] = useState("-12");
  const [sfxFadeIn, setSfxFadeIn] = useState("0");
  const [sfxFadeOut, setSfxFadeOut] = useState("0");
  const busy = state.kind === "submitting";
  const musicAssets = summary.assets.filter((asset) => asset.role === "music");
  const sfxAssets = summary.assets.filter((asset) => asset.role === "sfx");

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

  const expected =
    summary.digest && summary.revision
      ? { expectedManifestDigest: summary.digest, expectedRevision: summary.revision }
      : null;

  async function importAudio(): Promise<void> {
    const action = summary.actions["soundtrack.import"];
    if (!action || !expected || !importFile) return;
    if (!assetId.trim() || !importedBy.trim() || !rightsEvidence.trim()) {
      reportError({
        actionId: action.actionId,
        message: copy.importValidation,
        routePath: action.routePath,
        toastTitle: copy.importBlocked,
      });
      return;
    }
    let contentBase64: string;
    try {
      contentBase64 = await encodeAudioFile(importFile);
    } catch (error) {
      reportError({
        actionId: action.actionId,
        message: error instanceof Error ? error.message : copy.importReadError,
        routePath: action.routePath,
        toastTitle: copy.importBlocked,
      });
      return;
    }
    await runAction(
      action,
      {
        assetId: assetId.trim(),
        contentBase64,
        ...expected,
        provenance: {
          importedAt: new Date().toISOString(),
          importedBy: importedBy.trim(),
          originalFileName: importFile.name,
          rights: {
            attestedAt: new Date().toISOString(),
            attestedBy: importedBy.trim(),
            basis: rightsBasis,
            evidence: rightsEvidence.trim(),
          },
        },
        role: assetRole,
        runId,
        sourceFileName: importFile.name,
      },
      copy.importBlocked,
      copy.importSuccess,
    );
  }

  async function configureMix(): Promise<void> {
    const action = summary.actions["soundtrack.configure"];
    if (!action || !expected) return;
    if (sfxAssetId && !sfxCueId.trim()) {
      reportError({
        actionId: action.actionId,
        message: copy.sfxCueValidation,
        routePath: action.routePath,
        toastTitle: copy.configureBlocked,
      });
      return;
    }
    const music = musicAssetId
      ? {
          assetId: musicAssetId,
          fadeInSeconds: Number(musicFadeIn),
          fadeOutSeconds: Number(musicFadeOut),
          gainDb: Number(musicGainDb),
          trimStartSeconds: Number(musicTrimStart),
        }
      : undefined;
    const sfx = sfxAssetId
      ? [
          ...summary.mix.sfx,
          {
            assetId: sfxAssetId,
            cueId: sfxCueId.trim(),
            durationSeconds: Number(sfxDuration),
            fadeInSeconds: Number(sfxFadeIn),
            fadeOutSeconds: Number(sfxFadeOut),
            gainDb: Number(sfxGainDb),
            startSeconds: Number(sfxStart),
            trimStartSeconds: 0,
          },
        ]
      : summary.mix.sfx;
    await runAction(
      action,
      { ...expected, music, runId, sfx },
      copy.configureBlocked,
      copy.configureSuccess,
    );
  }

  return (
    <RunDetailCard
      headingId='soundtrack-workspace-heading'
      title={copy.panelTitle}
      description={copy.panelDescription}
    >
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

      {summary.kind === "ready" ? (
        <>
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
          <section className='grid gap-4 rounded-lg border border-(--line) p-4'>
            <div>
              <h3 className='font-semibold'>{copy.import}</h3>
              <p className='text-muted-foreground text-sm'>{copy.importHint}</p>
            </div>
            <div className='grid gap-3 sm:grid-cols-2'>
              <div className='grid gap-2 sm:col-span-2'>
                <Label htmlFor='soundtrack-file'>{copy.importFile}</Label>
                <Input
                  accept='audio/wav,audio/mpeg,audio/mp4,audio/ogg,audio/flac,.wav,.mp3,.m4a,.ogg,.flac'
                  id='soundtrack-file'
                  onChange={(event) => setImportFile(event.target.files?.[0] ?? null)}
                  type='file'
                />
              </div>
              <div className='grid gap-2'>
                <Label htmlFor='soundtrack-asset-id'>{copy.assetId}</Label>
                <Input
                  id='soundtrack-asset-id'
                  onChange={(event) => setAssetId(event.target.value)}
                  placeholder='ambient_bed'
                  value={assetId}
                />
              </div>
              <div className='grid gap-2'>
                <Label htmlFor='soundtrack-role'>{copy.role}</Label>
                <Select
                  value={assetRole}
                  onValueChange={(value) => setAssetRole(value as "music" | "sfx")}
                >
                  <SelectTrigger id='soundtrack-role'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='music'>{copy.music}</SelectItem>
                    <SelectItem value='sfx'>SFX</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className='grid gap-2'>
                <Label htmlFor='soundtrack-imported-by'>{copy.reviewer}</Label>
                <Input
                  id='soundtrack-imported-by'
                  onChange={(event) => setImportedBy(event.target.value)}
                  value={importedBy}
                />
              </div>
              <div className='grid gap-2'>
                <Label htmlFor='soundtrack-rights-basis'>{copy.rightsBasis}</Label>
                <Select
                  value={rightsBasis}
                  onValueChange={(value) => setRightsBasis(value as typeof rightsBasis)}
                >
                  <SelectTrigger id='soundtrack-rights-basis'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='licensed'>Licensed</SelectItem>
                    <SelectItem value='owned'>Owned</SelectItem>
                    <SelectItem value='permission-granted'>Permission granted</SelectItem>
                    <SelectItem value='public-domain'>Public domain</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className='grid gap-2 sm:col-span-2'>
                <Label htmlFor='soundtrack-rights-evidence'>{copy.rightsEvidence}</Label>
                <Textarea
                  id='soundtrack-rights-evidence'
                  onChange={(event) => setRightsEvidence(event.target.value)}
                  value={rightsEvidence}
                />
              </div>
            </div>
            <Button
              disabled={busy || !expected || !importFile || !summary.actions["soundtrack.import"]}
              onClick={() => void importAudio()}
            >
              {copy.import}
            </Button>
          </section>
          <section className='grid gap-4 rounded-lg border border-(--line) p-4'>
            <div>
              <h3 className='font-semibold'>{copy.mixSettings}</h3>
              <p className='text-muted-foreground text-sm'>{copy.configureHint}</p>
            </div>
            <div className='grid gap-3 sm:grid-cols-2'>
              <div className='grid gap-2 sm:col-span-2'>
                <Label htmlFor='soundtrack-music'>{copy.musicAsset}</Label>
                <Select
                  value={musicAssetId || "voice-only"}
                  onValueChange={(value) => setMusicAssetId(value === "voice-only" ? "" : value)}
                >
                  <SelectTrigger id='soundtrack-music'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='voice-only'>{copy.clearMusic}</SelectItem>
                    {musicAssets.map((asset) => (
                      <SelectItem key={asset.assetId} value={asset.assetId}>
                        {asset.assetId}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <NumberField
                id='soundtrack-music-gain'
                label={copy.musicGain}
                value={musicGainDb}
                onChange={setMusicGainDb}
              />
              <NumberField
                id='soundtrack-music-trim'
                label={copy.musicTrim}
                value={musicTrimStart}
                onChange={setMusicTrimStart}
              />
              <NumberField
                id='soundtrack-music-fade-in'
                label={copy.musicFadeIn}
                value={musicFadeIn}
                onChange={setMusicFadeIn}
              />
              <NumberField
                id='soundtrack-music-fade-out'
                label={copy.musicFadeOut}
                value={musicFadeOut}
                onChange={setMusicFadeOut}
              />
              <div className='grid gap-2 sm:col-span-2'>
                <Label htmlFor='soundtrack-sfx'>{copy.sfxCues}</Label>
                <Select
                  value={sfxAssetId || "no-sfx"}
                  onValueChange={(value) => setSfxAssetId(value === "no-sfx" ? "" : value)}
                >
                  <SelectTrigger id='soundtrack-sfx'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='no-sfx'>{copy.noNewSfx}</SelectItem>
                    {sfxAssets.map((asset) => (
                      <SelectItem key={asset.assetId} value={asset.assetId}>
                        {asset.assetId}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {sfxAssetId ? (
                <>
                  <div className='grid gap-2 sm:col-span-2'>
                    <Label htmlFor='soundtrack-sfx-cue-id'>{copy.assetId}</Label>
                    <Input
                      id='soundtrack-sfx-cue-id'
                      onChange={(event) => setSfxCueId(event.target.value)}
                      placeholder='arrival_whoosh'
                      value={sfxCueId}
                    />
                  </div>
                  <NumberField
                    id='soundtrack-sfx-start'
                    label={copy.sfxStart}
                    value={sfxStart}
                    onChange={setSfxStart}
                  />
                  <NumberField
                    id='soundtrack-sfx-duration'
                    label={copy.sfxDuration}
                    value={sfxDuration}
                    onChange={setSfxDuration}
                  />
                  <NumberField
                    id='soundtrack-sfx-gain'
                    label={copy.sfxGain}
                    value={sfxGainDb}
                    onChange={setSfxGainDb}
                  />
                  <NumberField
                    id='soundtrack-sfx-fade-in'
                    label={copy.sfxFadeIn}
                    value={sfxFadeIn}
                    onChange={setSfxFadeIn}
                  />
                  <NumberField
                    id='soundtrack-sfx-fade-out'
                    label={copy.sfxFadeOut}
                    value={sfxFadeOut}
                    onChange={setSfxFadeOut}
                  />
                </>
              ) : null}
            </div>
            <Button
              disabled={busy || !expected || !summary.actions["soundtrack.configure"]}
              onClick={() => void configureMix()}
              variant='outline'
            >
              {copy.configure}
            </Button>
          </section>
          <section className='grid gap-3 rounded-lg border border-(--line) p-4'>
            <div className='flex flex-wrap items-center justify-between gap-2'>
              <h3 className='font-semibold'>{copy.analysis}</h3>
              <Badge variant={summary.analysis ? "secondary" : "outline"}>
                {summary.analysis ? copy.analysisComplete : copy.analysisPending}
              </Badge>
            </div>
            {summary.analysis ? (
              <p className='text-muted-foreground text-sm'>{summary.analysis.measuredAt}</p>
            ) : null}
            <Button
              disabled={busy || !expected || !summary.actions["soundtrack.analyze"]}
              onClick={() =>
                expected &&
                void runAction(
                  summary.actions["soundtrack.analyze"],
                  { runId, ...expected },
                  copy.analyzeBlocked,
                  copy.analyzeSuccess,
                )
              }
            >
              {copy.analyze}
            </Button>
          </section>
          <section className='grid gap-3 rounded-lg border border-(--line) p-4'>
            <div className='flex flex-wrap items-center justify-between gap-2'>
              <h3 className='font-semibold'>{copy.decision}</h3>
              <Badge variant={summary.decision?.status === "rejected" ? "destructive" : "outline"}>
                {copy.decisionStatus(summary.decision?.status ?? null)}
              </Badge>
            </div>
            {summary.decision ? (
              <p className='text-muted-foreground text-sm'>
                {summary.decision.reviewedBy}: {summary.decision.notes}
              </p>
            ) : (
              <>
                <Label htmlFor='soundtrack-reviewer'>{copy.reviewer}</Label>
                <Input
                  id='soundtrack-reviewer'
                  value={reviewedBy}
                  onChange={(event) => setReviewedBy(event.target.value)}
                />
                <Label htmlFor='soundtrack-notes'>{copy.notes}</Label>
                <Textarea
                  id='soundtrack-notes'
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                />
                <div className='flex flex-wrap gap-2'>
                  <Button
                    disabled={
                      busy ||
                      !expected ||
                      !summary.analysis ||
                      !reviewedBy.trim() ||
                      !notes.trim() ||
                      !summary.actions["soundtrack.decide"]
                    }
                    onClick={() =>
                      expected &&
                      void runAction(
                        summary.actions["soundtrack.decide"],
                        {
                          runId,
                          ...expected,
                          notes: notes.trim(),
                          reviewedBy: reviewedBy.trim(),
                          status: "approved",
                        },
                        copy.submitBlocked,
                        copy.submitSuccess,
                      )
                    }
                  >
                    {copy.approve}
                  </Button>
                  <Button
                    disabled={
                      busy ||
                      !expected ||
                      !reviewedBy.trim() ||
                      !notes.trim() ||
                      !summary.actions["soundtrack.decide"]
                    }
                    variant='outline'
                    onClick={() =>
                      expected &&
                      void runAction(
                        summary.actions["soundtrack.decide"],
                        {
                          runId,
                          ...expected,
                          notes: notes.trim(),
                          reviewedBy: reviewedBy.trim(),
                          status: "rejected",
                        },
                        copy.submitBlocked,
                        copy.submitSuccess,
                      )
                    }
                  >
                    {copy.reject}
                  </Button>
                </div>
              </>
            )}
          </section>
          <section className='grid gap-3'>
            <h3 className='font-semibold'>{copy.assets}</h3>
            {summary.assets.length === 0 ? (
              <p className='text-muted-foreground text-sm'>{copy.noAssets}</p>
            ) : (
              <div className='grid gap-3 md:grid-cols-2'>
                {summary.assets.map((asset) => (
                  <article
                    className='grid gap-2 rounded-lg border border-(--line) p-3 text-sm'
                    key={asset.assetId}
                  >
                    <div className='flex justify-between gap-2'>
                      <strong>{asset.assetId}</strong>
                      <Badge variant='outline'>{asset.role}</Badge>
                    </div>
                    <p>
                      {copy.imported}: {asset.originalFileName}
                    </p>
                    <p>
                      {copy.rights}: {asset.rights.basis} — {asset.rights.attestedBy}
                    </p>
                    <p className='text-muted-foreground'>{asset.rights.evidence}</p>
                  </article>
                ))}
              </div>
            )}
          </section>
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
          {summary.advanced.paths.map((path) => (
            <li className='break-all' key={path}>
              {path}
            </li>
          ))}
        </ul>
      </details>
    </RunDetailCard>
  );
}

function NumberField({
  id,
  label,
  onChange,
  value,
}: Readonly<{ id: string; label: string; onChange: (value: string) => void; value: string }>) {
  return (
    <div className='grid gap-2'>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        inputMode='decimal'
        onChange={(event) => onChange(event.target.value)}
        type='number'
        value={value}
      />
    </div>
  );
}

function encodeAudioFile(file: File): Promise<string> {
  if (file.size === 0 || file.size > 50 * 1024 * 1024) {
    return Promise.reject(new Error("Soundtrack imports must be between 1 byte and 50 MiB."));
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("error", () =>
      reject(new Error("The selected audio file could not be read.")),
    );
    reader.addEventListener("load", () => {
      const value = typeof reader.result === "string" ? reader.result : "";
      const separator = value.indexOf(",");
      if (separator < 0) reject(new Error("The selected audio file encoding is invalid."));
      else resolve(value.slice(separator + 1));
    });
    reader.readAsDataURL(file);
  });
}
