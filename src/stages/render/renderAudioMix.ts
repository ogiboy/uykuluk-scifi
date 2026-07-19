import { artifactPath } from "../../core/artifacts.js";
import { SafeExitError } from "../../core/errors.js";
import type { DraftRenderTiming } from "./renderTimeline.js";

export type RenderMusicInput = Readonly<{
  path: string;
  gainDb: number;
  trimStartSeconds: number;
  fadeInSeconds: number;
  fadeOutSeconds: number;
}>;

export type RenderSfxInput = Readonly<{
  path: string;
  gainDb: number;
  startSeconds: number;
  trimStartSeconds: number;
  durationSeconds: number;
  fadeInSeconds: number;
  fadeOutSeconds: number;
}>;

export type RenderSoundtrackInputs = Readonly<{
  voiceoverPath: string;
  music?: RenderMusicInput;
  sfx: readonly RenderSfxInput[];
}>;

export type RenderAudioGraph = Readonly<{
  filter: string;
  inputArgs: readonly string[];
  inputCount: number;
}>;

/** Builds bounded audio input arguments and the deterministic voice-forward mix graph. */
export function buildRenderAudioGraph(input: {
  firstAudioInputIndex: number;
  masteringFilter: string;
  runId: string;
  soundtrack: RenderSoundtrackInputs;
  timing: DraftRenderTiming;
}): RenderAudioGraph {
  if (!input.masteringFilter.trim()) {
    throw new SafeExitError("Render audio graph requires an explicit mastering filter.");
  }
  const inputArgs: string[] = [
    "-i",
    resolveRunMediaPath(input.runId, input.soundtrack.voiceoverPath),
  ];
  const filters: string[] = [];
  const mixLabels: string[] = [];
  let nextInputIndex = input.firstAudioInputIndex;

  filters.push(voiceFilter(nextInputIndex, input.timing));
  mixLabels.push("[voiceMix]");
  nextInputIndex += 1;

  if (input.soundtrack.music) {
    const music = input.soundtrack.music;
    inputArgs.push("-stream_loop", "-1", "-i", resolveRunMediaPath(input.runId, music.path));
    filters.push(musicFilter(nextInputIndex, music, input.timing.totalDurationSeconds));
    mixLabels.push("[musicMix]");
    nextInputIndex += 1;
  }

  input.soundtrack.sfx.forEach((sfx, index) => {
    inputArgs.push("-i", resolveRunMediaPath(input.runId, sfx.path));
    const label = `sfxMix${index}`;
    filters.push(sfxFilter(nextInputIndex, label, sfx, input.timing.totalDurationSeconds));
    mixLabels.push(`[${label}]`);
    nextInputIndex += 1;
  });

  const totalDuration = seconds(input.timing.totalDurationSeconds);
  const mixed =
    mixLabels.length === 1
      ? `${mixLabels[0]}anull[mixedAudio]`
      : `${mixLabels.join("")}amix=inputs=${mixLabels.length}:duration=longest:dropout_transition=0:normalize=0[mixedAudio]`;
  filters.push(mixed);
  filters.push(
    `[mixedAudio]apad=whole_dur=${totalDuration},atrim=duration=${totalDuration},${input.masteringFilter}[a]`,
  );
  return {
    filter: filters.join(";"),
    inputArgs,
    inputCount: nextInputIndex - input.firstAudioInputIndex,
  };
}

function voiceFilter(inputIndex: number, timing: DraftRenderTiming): string {
  const sceneDuration = seconds(timing.sceneAudioDurationSeconds);
  const totalDuration = seconds(timing.totalDurationSeconds);
  const delayMs = Math.round(timing.introDurationSeconds * 1_000);
  return `[${inputIndex}:a]atrim=duration=${sceneDuration},asetpts=PTS-STARTPTS,apad=whole_dur=${sceneDuration},atrim=duration=${sceneDuration},adelay=${delayMs}:all=1,apad=whole_dur=${totalDuration},atrim=duration=${totalDuration}[voiceMix]`;
}

function musicFilter(
  inputIndex: number,
  music: RenderMusicInput,
  totalDurationSeconds: number,
): string {
  assertGain(music.gainDb);
  const total = seconds(totalDurationSeconds);
  const fadeOutStart = Math.max(0, totalDurationSeconds - music.fadeOutSeconds);
  return [
    `[${inputIndex}:a]atrim=start=${seconds(music.trimStartSeconds)}:duration=${total}`,
    "asetpts=PTS-STARTPTS",
    `volume=${music.gainDb}dB`,
    `afade=t=in:st=0:d=${seconds(music.fadeInSeconds)}`,
    `afade=t=out:st=${seconds(fadeOutStart)}:d=${seconds(music.fadeOutSeconds)}`,
    `apad=whole_dur=${total}`,
    `atrim=duration=${total}[musicMix]`,
  ].join(",");
}

function sfxFilter(
  inputIndex: number,
  label: string,
  sfx: RenderSfxInput,
  totalDurationSeconds: number,
): string {
  assertGain(sfx.gainDb);
  if (sfx.startSeconds + sfx.durationSeconds > totalDurationSeconds + 0.001) {
    throw new SafeExitError("Sound effect cue exceeds the render duration.");
  }
  const delayMs = Math.round(sfx.startSeconds * 1_000);
  const fadeOutStart = Math.max(0, sfx.durationSeconds - sfx.fadeOutSeconds);
  return [
    `[${inputIndex}:a]atrim=start=${seconds(sfx.trimStartSeconds)}:duration=${seconds(sfx.durationSeconds)}`,
    "asetpts=PTS-STARTPTS",
    `volume=${sfx.gainDb}dB`,
    `afade=t=in:st=0:d=${seconds(sfx.fadeInSeconds)}`,
    `afade=t=out:st=${seconds(fadeOutStart)}:d=${seconds(sfx.fadeOutSeconds)}`,
    `adelay=${delayMs}:all=1`,
    `apad=whole_dur=${seconds(totalDurationSeconds)}`,
    `atrim=duration=${seconds(totalDurationSeconds)}[${label}]`,
  ].join(",");
}

function resolveRunMediaPath(runId: string, relativePath: string): string {
  if (!relativePath.startsWith("production/audio/")) {
    throw new SafeExitError("Soundtrack media must be owned by the run audio artifact tree.");
  }
  return artifactPath(runId, relativePath);
}

function assertGain(gainDb: number): void {
  if (!Number.isFinite(gainDb) || gainDb < -60 || gainDb > 6) {
    throw new SafeExitError("Soundtrack gain must be between -60 dB and +6 dB.");
  }
}

function seconds(value: number): string {
  if (!Number.isFinite(value) || value < 0) {
    throw new SafeExitError("Soundtrack timing must be finite and non-negative.");
  }
  return Number(value.toFixed(3)).toString();
}
