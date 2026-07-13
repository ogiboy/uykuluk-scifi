import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const mediaRequiredArtifacts = [
  "production/render_plan.json",
  "production/storyboard_contact_sheet.md",
  "production/asset_provenance.json",
  "production/audio/voiceover.wav",
  "production/audio/voiceover.meta.json",
  "production/audio/voiceover_review.md",
  "production/render/draft.mp4",
  "production/render/render_manifest.json",
  "production/render/draft_review.md",
  "production/render/youtube_chapters.json",
  "production/render/youtube_chapters.md",
];

/**
 * Enables deterministic local text-to-speech in the producer configuration.
 * @param {string} workdir - Workspace directory containing `producer.config.json`.
 */
export async function enableDeterministicTts({ workdir }) {
  await setDeterministicTtsEnabled({ workdir, enabled: true });
}

/**
 * Temporarily disables deterministic local text-to-speech without changing its selected mode.
 * @param {string} workdir - Workspace directory containing `producer.config.json`.
 */
export async function disableDeterministicTts({ workdir }) {
  await setDeterministicTtsEnabled({ workdir, enabled: false });
}

async function setDeterministicTtsEnabled({ workdir, enabled }) {
  const target = path.join(workdir, "producer.config.json");
  const config = JSON.parse(await readFile(target, "utf8"));
  config.providers.tts = { enabled, mode: "deterministic-local" };
  await writeFile(target, `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

/**
 * Runs the local media smoke workflow.
 * @param {Function} run - Executes a command and checks its output.
 * @param {string} pnpm - Path to the pnpm executable.
 * @param {string} workdir - Workspace directory containing the run state.
 * @param {string} runId - Identifier of the run to exercise.
 * @param {Function} assertFile - Verifies that a file exists.
 * @param {Function} assert - Assertion function used for state checks.
 */
export async function runLocalMediaSmoke({ run, pnpm, workdir, runId, assertFile, assert }) {
  run([pnpm, "producer", "evidence", "--run", runId], {
    label: "evidence recommends deterministic voice",
  });
  await assertEvidenceNextCommand({
    workdir,
    runId,
    expected: `pnpm producer voice --run ${runId}`,
    message: "evidence recommends voice after deterministic TTS is enabled",
    assert,
  });
  run([pnpm, "producer", "voice", "--run", runId], {
    label: "deterministic voice",
    expectOutput: "Voiceover generated",
  });
  run([pnpm, "producer", "render", "--run", runId], {
    label: "render blocked before explicit render approval",
    expectFailure: true,
    expectOutput: "requires explicit render approval",
  });
  run([pnpm, "producer", "evidence", "--run", runId], {
    label: "evidence recommends render approval",
  });
  await assertEvidenceNextCommand({
    workdir,
    runId,
    expected: `pnpm producer review voice --run ${runId}`,
    message: "evidence routes reference audio through voice review before render approval",
    assert,
  });
  const voiceReview = run([pnpm, "producer", "review", "voice", "--run", runId], {
    label: "reference voice review handoff",
    expectOutput: "Production voice candidate: false",
  });
  assert(
    voiceReview.stdout.includes("Render approval scope: timing-draft-only"),
    "reference voice review marks render approval as timing draft only",
  );
  assert(
    voiceReview.stdout.includes(
      `Render approval command: pnpm producer approve render --run ${runId}`,
    ),
    "reference voice review prints exact render approval command",
  );
  run([pnpm, "producer", "approve", "render", "--run", runId], {
    label: "approve render",
    expectOutput: "Render approval recorded",
  });
  const fakeMediaTools = await createFakeMediaTools(workdir);
  run([pnpm, "producer", "render", "--run", runId], {
    label: "fake ffmpeg draft render",
    expectOutput: "Draft render available",
    env: { PATH: `${fakeMediaTools.binDir}${path.delimiter}${process.env.PATH ?? ""}` },
  });
  const review = run([pnpm, "producer", "review", "render", "--run", runId], {
    label: "render review handoff",
    expectOutput: "FFmpeg review command:",
  });
  assert(
    review.stdout.includes("production/render/draft.mp4"),
    "render review handoff points at the final draft artifact",
  );
  assert(
    !review.stdout.includes(".draft."),
    "render review handoff does not point at the temporary render output",
  );
  assert(
    review.stdout.includes("upload and publish remain disabled"),
    "render review handoff keeps upload and publish disabled",
  );
  run([pnpm, "producer", "evidence", "--run", runId], { label: "rendered evidence" });
  run([pnpm, "producer", "readiness", "--run", runId], {
    label: "rendered readiness",
    expectOutput: "Readiness passed",
  });
  run([pnpm, "producer", "status", "--run", runId], {
    label: "rendered status",
    expectOutput: "RENDERED",
  });

  for (const artifact of mediaRequiredArtifacts) {
    await assertFile(path.join("runs", runId, artifact));
  }

  await assertRenderedEvidence({ workdir, runId, assert });

  run([pnpm, "producer", "upload", "private", "--run", runId], {
    label: "upload blocked without approval",
    expectFailure: true,
    expectOutput: "requires explicit upload approval",
  });
  run([pnpm, "producer", "publish", "schedule", "--run", runId], {
    label: "publish blocked without approval",
    expectFailure: true,
    expectOutput: "requires explicit publish approval",
  });
}

/**
 * Checks the next recommended command recorded in a run's evidence bundle.
 * @param {string} workdir - The working directory containing the run data.
 * @param {string} runId - The run identifier.
 * @param {string} expected - The expected command string.
 * @param {string} message - The assertion message to use if the command does not match.
 */
async function assertEvidenceNextCommand({ workdir, runId, expected, message, assert }) {
  const evidence = JSON.parse(
    await readFile(path.join(workdir, "runs", runId, "evidence_bundle.json"), "utf8"),
  );
  assert(evidence.nextRecommendedCommand === expected, message);
}

/**
 * Verifies the rendered run's state, evidence, and render manifest.
 * @param {string} workdir - Base working directory containing the run data.
 * @param {string} runId - Run identifier used to locate the generated files.
 */
async function assertRenderedEvidence({ workdir, runId, assert }) {
  const renderedState = JSON.parse(
    await readFile(path.join(workdir, "runs", runId, "state.json"), "utf8"),
  );
  const renderedEvidence = JSON.parse(
    await readFile(path.join(workdir, "runs", runId, "evidence_bundle.json"), "utf8"),
  );
  const renderManifest = JSON.parse(
    await readFile(
      path.join(workdir, "runs", runId, "production", "render", "render_manifest.json"),
      "utf8",
    ),
  );
  assert(renderedState.state === "RENDERED", "final state is RENDERED after local draft render");
  assert(renderedEvidence.currentState === renderedState.state, "rendered evidence matches state");
  assert(renderedEvidence.voiceoverAudio.status === "pass", "voiceover evidence passes");
  assert(renderedEvidence.draftRender.status === "pass", "draft render evidence passes");
  assert(
    renderedEvidence.draftRender.voiceoverProductionVoiceCandidate === false,
    "draft render evidence preserves reference audio classification",
  );
  assert(
    typeof renderedEvidence.draftRender.ffmpegReviewCommand === "string" &&
      renderedEvidence.draftRender.ffmpegReviewCommand.includes("production/render/draft.mp4"),
    "draft render evidence records final-artifact FFmpeg review command",
  );
  assert(
    renderedEvidence.nextRecommendedCommand === `pnpm producer review render --run ${runId}`,
    "rendered evidence keeps deterministic draft audio out of final production review",
  );
  assert(
    renderManifest.voiceoverAudio?.productionVoiceCandidate === false,
    "render manifest records reference audio classification",
  );
  assert(
    renderManifest.schemaVersion === 8 &&
      typeof renderManifest.ffmpeg?.reviewCommand === "string" &&
      renderManifest.ffmpeg.reviewCommand.includes("production/render/draft.mp4"),
    "render manifest records final-artifact FFmpeg review command",
  );
  assert(
    renderManifest.chapterDraft?.markdownPath === "production/render/youtube_chapters.md" &&
      renderManifest.chapterDraft?.jsonPath === "production/render/youtube_chapters.json",
    "render manifest records chapter draft artifacts",
  );
  assert(
    renderManifest.ffmpeg.reviewCommand.includes(" -f null -") &&
      !renderManifest.ffmpeg.reviewCommand.includes(".draft."),
    "render manifest review command validates the final draft without rewriting temp output",
  );
  assert(
    renderManifest.mediaProbe?.video?.width === 1280 &&
      renderManifest.mediaProbe?.video?.height === 720 &&
      renderManifest.mediaProbe?.audio?.codecName === "aac",
    "render manifest records ffprobe video and audio evidence",
  );
}

/**
 * Creates fake media tool executables for local rendering tests.
 * @param {string} workdir - The working directory where the fake tools are written.
 * @return {Promise<{ binDir: string }>} The directory containing the generated executables.
 */
async function createFakeMediaTools(workdir) {
  const binDir = path.join(workdir, "fake-bin");
  await mkdir(binDir, { recursive: true });
  const ffmpeg = path.join(binDir, "ffmpeg");
  const ffprobe = path.join(binDir, "ffprobe");
  await writeFile(
    ffmpeg,
    [
      "#!/usr/bin/env node",
      'import { writeFileSync } from "node:fs";',
      "const output = process.argv.at(-1);",
      'writeFileSync(output, Buffer.from(`fake mp4\\n${process.argv.slice(2).join("\\n")}`));',
    ].join("\n"),
    "utf8",
  );
  await writeFile(ffprobe, fakeFfprobeSource(), "utf8");
  await chmod(ffmpeg, 0o755);
  await chmod(ffprobe, 0o755);
  return { binDir };
}

/**
 * Builds a fake `ffprobe` that reports the duration requested by fake FFmpeg.
 * @return {string} A Node.js script that prints fixed media probe JSON.
 */
function fakeFfprobeSource() {
  return [
    "#!/usr/bin/env node",
    'import { readFileSync } from "node:fs";',
    "const media = readFileSync(process.argv.at(-1), 'utf8');",
    String.raw`const args = media.split('\n');`,
    "const durationIndex = args.lastIndexOf('-t');",
    "const duration = durationIndex >= 0 ? args[durationIndex + 1] : '8.000000';",
    "console.log(JSON.stringify({",
    "  format: { duration, format_name: 'mov,mp4,m4a,3gp,3g2,mj2' },",
    "  streams: [",
    "    { codec_type: 'video', codec_name: 'h264', width: 1280, height: 720, duration },",
    "    { codec_type: 'audio', codec_name: 'aac', sample_rate: '48000', channels: 2, duration }",
    "  ]",
    "}));",
  ].join("\n");
}
