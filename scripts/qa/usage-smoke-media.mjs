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
];

export async function enableDeterministicTts({ workdir }) {
  const target = path.join(workdir, "producer.config.json");
  const config = JSON.parse(await readFile(target, "utf8"));
  config.providers.tts = { enabled: true, mode: "deterministic-local" };
  await writeFile(target, `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

export async function runLocalMediaSmoke({ run, pnpm, workdir, runId, assertFile, assert }) {
  run([pnpm, "producer", "evidence", "--run", runId], {
    label: "evidence recommends deterministic voice",
  });
  await assertEvidenceNextCommand({
    workdir,
    runId,
    expected: "pnpm producer voice --run <run_id>",
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
    expected: "pnpm producer approve render --run <run_id>",
    message: "evidence recommends render approval after voiceover evidence exists",
    assert,
  });
  run([pnpm, "producer", "approve", "render", "--run", runId], {
    label: "approve render",
    expectOutput: "Render approval recorded",
  });
  const fakeMediaTools = await createFakeMediaTools(workdir);
  run([pnpm, "producer", "render", "--run", runId], {
    label: "fake ffmpeg draft render",
    expectOutput: "Draft render generated",
    env: {
      PATH: `${fakeMediaTools.binDir}${path.delimiter}${process.env.PATH ?? ""}`,
    },
  });
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

async function assertEvidenceNextCommand({ workdir, runId, expected, message, assert }) {
  const evidence = JSON.parse(
    await readFile(path.join(workdir, "runs", runId, "evidence_bundle.json"), "utf8"),
  );
  assert(evidence.nextRecommendedCommand === expected, message);
}

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
    renderedEvidence.nextRecommendedCommand ===
      "Manual final draft review. Upload remains approval-gated.",
    "rendered evidence keeps upload gated behind manual review",
  );
  assert(
    renderManifest.mediaProbe?.video?.width === 1280 &&
      renderManifest.mediaProbe?.video?.height === 720 &&
      renderManifest.mediaProbe?.audio?.codecName === "aac",
    "render manifest records ffprobe video and audio evidence",
  );
}

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

function fakeFfprobeSource() {
  return [
    "#!/usr/bin/env node",
    "console.log(JSON.stringify({",
    "  format: { duration: '8.000000', format_name: 'mov,mp4,m4a,3gp,3g2,mj2' },",
    "  streams: [",
    "    { codec_type: 'video', codec_name: 'h264', width: 1280, height: 720, duration: '8.000000' },",
    "    { codec_type: 'audio', codec_name: 'aac', sample_rate: '48000', channels: 2, duration: '8.000000' }",
    "  ]",
    "}));",
  ].join("\n");
}
