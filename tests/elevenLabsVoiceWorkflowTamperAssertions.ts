import { readFile, writeFile } from "node:fs/promises";
import { expect } from "vitest";

import { artifactPath } from "../src/core/artifacts";
import type { RunRecord } from "../src/core/state";
import { readVoiceoverAudioEvidence } from "../src/stages/voice/voiceoverEvidence";
import { sha256 } from "../src/utils/hash";

/**
 * Verifies that persisted paid-voice evidence fails closed after approval, binding, cost, or
 * alignment tampering.
 */
export async function verifyWorkflowEvidenceTamperGuards(options: {
  runId: string;
  run: RunRecord;
  originalMetaText: string;
  originalAlignmentText: string;
}): Promise<void> {
  const { runId, run, originalMetaText, originalAlignmentText } = options;
  const metaPath = artifactPath(runId, "production/audio/voiceover.meta.json");
  const tamperedMeta = JSON.parse(originalMetaText) as { paidExecution: { approvalId: string } };
  tamperedMeta.paidExecution.approvalId = "approval_forged";
  await writeFile(metaPath, `${JSON.stringify(tamperedMeta, null, 2)}\n`, "utf8");
  await expect(readVoiceoverAudioEvidence(run)).resolves.toMatchObject({
    status: "block",
    message: expect.stringMatching(/paid execution.*approval|approval.*reservation/i),
  });
  await writeFile(metaPath, originalMetaText, "utf8");

  const tamperedBindingMeta = JSON.parse(originalMetaText) as {
    paidExecution: { binding: { voice: { voiceId: string } } };
  };
  tamperedBindingMeta.paidExecution.binding.voice.voiceId = "forged_voice";
  await writeFile(metaPath, `${JSON.stringify(tamperedBindingMeta, null, 2)}\n`, "utf8");
  await expect(readVoiceoverAudioEvidence(run)).resolves.toMatchObject({
    status: "block",
    message: expect.stringMatching(/binding digest|pinned voice binding|selection artifact/i),
  });
  await writeFile(metaPath, originalMetaText, "utf8");

  const costLedgerPath = artifactPath(runId, "costs/ledger.jsonl");
  const originalCostLedger = await readFile(costLedgerPath, "utf8");
  await writeFile(costLedgerPath, "", "utf8");
  await expect(readVoiceoverAudioEvidence(run)).resolves.toMatchObject({
    status: "block",
    message: expect.stringMatching(/reservation-linked cost event|cost event/i),
  });
  await writeFile(costLedgerPath, originalCostLedger, "utf8");

  await writeFile(
    artifactPath(runId, "production/audio/alignment.json"),
    '{"characters":["tampered"]}\n',
    "utf8",
  );
  await expect(readVoiceoverAudioEvidence(run)).resolves.toMatchObject({
    status: "block",
    message: expect.stringContaining("alignment digest"),
  });

  const tamperedAlignment = JSON.parse(originalAlignmentText) as {
    characters: string[];
    characterStartTimesSeconds: number[];
    characterEndTimesSeconds: number[];
  };
  tamperedAlignment.characterStartTimesSeconds[0] += 0.001;
  const tamperedAlignmentText = `${JSON.stringify(tamperedAlignment, null, 2)}\n`;
  await writeFile(
    artifactPath(runId, "production/audio/alignment.json"),
    tamperedAlignmentText,
    "utf8",
  );
  const alignmentRehashedMeta = JSON.parse(originalMetaText) as { alignment: { sha256: string } };
  alignmentRehashedMeta.alignment.sha256 = sha256(tamperedAlignmentText);
  await writeFile(metaPath, `${JSON.stringify(alignmentRehashedMeta, null, 2)}\n`, "utf8");
  await expect(readVoiceoverAudioEvidence(run)).resolves.toMatchObject({
    status: "block",
    message: expect.stringMatching(/provider spool.*alignment|alignment.*spool/i),
  });
}
