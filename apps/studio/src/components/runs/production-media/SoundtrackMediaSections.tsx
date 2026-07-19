"use client";

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
import type { StudioGuardedActionClientErrorInput } from "@/lib/mutations/useStudioGuardedActionSubmit";
import type { StudioSoundtrackSummary } from "@/lib/runs/soundtrackSummaries";
import { useState } from "react";
import type {
  SoundtrackExpectedBinding,
  SoundtrackRunAction,
  SoundtrackWorkspaceCopy,
} from "./SoundtrackWorkspaceReview";

type SoundtrackMediaSectionsProps = Readonly<{
  busy: boolean;
  copy: SoundtrackWorkspaceCopy;
  expected: SoundtrackExpectedBinding;
  reportError: (input: StudioGuardedActionClientErrorInput) => void;
  runAction: SoundtrackRunAction;
  runId: string;
  summary: StudioSoundtrackSummary;
}>;

export function SoundtrackMediaSections({
  busy,
  copy,
  expected,
  reportError,
  runAction,
  runId,
  summary,
}: SoundtrackMediaSectionsProps) {
  return (
    <>
      <SoundtrackImportSection
        busy={busy}
        copy={copy}
        expected={expected}
        reportError={reportError}
        runAction={runAction}
        runId={runId}
        summary={summary}
      />
      <SoundtrackMixSection
        busy={busy}
        copy={copy}
        expected={expected}
        reportError={reportError}
        runAction={runAction}
        runId={runId}
        summary={summary}
      />
    </>
  );
}

function SoundtrackImportSection(props: SoundtrackMediaSectionsProps) {
  const { busy, copy, expected, reportError, runAction, runId, summary } = props;
  const [importFile, setImportFile] = useState<File | null>(null);
  const [assetId, setAssetId] = useState("");
  const [assetRole, setAssetRole] = useState<"music" | "sfx">("music");
  const [importedBy, setImportedBy] = useState("");
  const [rightsBasis, setRightsBasis] = useState<
    "licensed" | "owned" | "permission-granted" | "public-domain"
  >("licensed");
  const [rightsEvidence, setRightsEvidence] = useState("");
  const action = summary.actions["soundtrack.import"];

  async function importAudio(): Promise<void> {
    if (!action || !importFile) return;
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

  return (
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
      <Button disabled={busy || !importFile || !action} onClick={() => void importAudio()}>
        {copy.import}
      </Button>
    </section>
  );
}

function SoundtrackMixSection(props: SoundtrackMediaSectionsProps) {
  const { busy, copy, expected, reportError, runAction, runId, summary } = props;
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
  const action = summary.actions["soundtrack.configure"];
  const musicAssets = summary.assets.filter((asset) => asset.role === "music");
  const sfxAssets = summary.assets.filter((asset) => asset.role === "sfx");

  async function configureMix(): Promise<void> {
    if (!action) return;
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
      <Button disabled={busy || !action} onClick={() => void configureMix()} variant='outline'>
        {copy.configure}
      </Button>
    </section>
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
