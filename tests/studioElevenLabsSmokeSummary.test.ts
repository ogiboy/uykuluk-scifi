import { createHash } from "node:crypto";
import { link, mkdtemp, rm, symlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  elevenLabsSmokeAudioUrl,
  readElevenLabsSmokeAudio,
  readLatestElevenLabsSmoke,
} from "../apps/studio/src/lib/providers/elevenLabsSmokeSummary";
import { writeBinaryFile } from "../src/utils/fs";
import { writeJsonFile } from "../src/utils/json";

const roots: string[] = [];
const operationId = "provider_smoke_20260718000500_abcdef";

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("Studio ElevenLabs diagnostic summary", () => {
  it("serves only digest-verified diagnostic audio referenced by valid evidence", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "studio-elevenlabs-smoke-"));
    roots.push(root);
    const audio = Buffer.from("diagnostic wav fixture");
    const relativeAudioPath = `diagnostics/provider-smokes/elevenlabs/${operationId}.wav`;
    await writeBinaryFile(path.join(root, relativeAudioPath), audio);
    await writeJsonFile(
      path.join(root, "diagnostics", "provider-smokes", "elevenlabs", `${operationId}.json`),
      successEvidence(relativeAudioPath, audio),
    );

    await expect(readLatestElevenLabsSmoke(root)).resolves.toMatchObject({
      operationId,
      status: "succeeded",
    });
    await expect(readElevenLabsSmokeAudio(root, operationId)).resolves.toEqual(audio);
    expect(elevenLabsSmokeAudioUrl(operationId)).toBe(
      `/provider-smokes/elevenlabs/${operationId}/audio`,
    );

    await writeBinaryFile(path.join(root, relativeAudioPath), Buffer.from("tampered"));
    await expect(readElevenLabsSmokeAudio(root, operationId)).resolves.toBeNull();
    await expect(readElevenLabsSmokeAudio(root, "../producer.config.json")).resolves.toBeNull();
  });

  it("rejects linked diagnostic audio even when its bytes match the evidence digest", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "studio-elevenlabs-smoke-"));
    roots.push(root);
    const audio = Buffer.from("linked diagnostic wav fixture");
    const relativeAudioPath = `diagnostics/provider-smokes/elevenlabs/${operationId}.wav`;
    const source = path.join(root, "outside.wav");
    await writeBinaryFile(source, audio);
    await writeJsonFile(
      path.join(root, "diagnostics", "provider-smokes", "elevenlabs", `${operationId}.json`),
      successEvidence(relativeAudioPath, audio),
    );

    await symlink(source, path.join(root, relativeAudioPath));
    await expect(readElevenLabsSmokeAudio(root, operationId)).resolves.toBeNull();

    await rm(path.join(root, relativeAudioPath));
    await link(source, path.join(root, relativeAudioPath));
    await expect(readElevenLabsSmokeAudio(root, operationId)).resolves.toBeNull();

    const evidencePath = path.join(
      root,
      "diagnostics",
      "provider-smokes",
      "elevenlabs",
      `${operationId}.json`,
    );
    const evidenceSource = path.join(root, "outside.json");
    await writeJsonFile(evidenceSource, successEvidence(relativeAudioPath, audio));
    await rm(evidencePath);
    await symlink(evidenceSource, evidencePath);
    await expect(readLatestElevenLabsSmoke(root)).resolves.toBeNull();

    await rm(evidencePath);
    await link(evidenceSource, evidencePath);
    await expect(readLatestElevenLabsSmoke(root)).resolves.toBeNull();
  });
});

function successEvidence(relativeAudioPath: string, audio: Buffer) {
  return {
    schemaVersion: 1,
    provider: "elevenlabs",
    capability: "text-to-speech-with-timestamps",
    operationId,
    usage: "diagnostic-only",
    productionEligible: false,
    createdAt: "2026-07-18T00:05:00.000Z",
    completedAt: "2026-07-18T00:05:01.000Z",
    modelId: "eleven_v3",
    voiceId: "voice_test",
    inputDigest: "a".repeat(64),
    inputCharacterCount: 12,
    requestSent: true,
    status: "succeeded",
    audio: {
      path: relativeAudioPath,
      digest: createHash("sha256").update(audio).digest("hex"),
      durationSeconds: 1,
      sampleRateHz: 24_000,
      channels: 1,
    },
    alignmentDigest: "b".repeat(64),
    reportedBillableCredits: 12,
  };
}
