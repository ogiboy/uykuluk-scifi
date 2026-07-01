import { readFile } from "node:fs/promises";
import { artifactPath, writeRunJson, writeRunText } from "../core/artifacts.js";
import { SafeExitError } from "../core/errors.js";
import { appendLedgerEvent } from "../core/ledger.js";
import { loadRun, saveRun } from "../core/runStore.js";
import { pathExists } from "../utils/fs.js";
import { sha256 } from "../utils/hash.js";
import { bulletList, table } from "../utils/markdown.js";
import { nowIso } from "../utils/time.js";
import { channelHandoffJsonPath } from "./channelHandoffContracts.js";
import { readChannelHandoffStatus } from "./channelHandoffStatus.js";
import { readFinalReviewBundleStatus } from "./finalReviewBundleStatus.js";
import {
  channelHandoffDecisionInputSchema,
  channelHandoffDecisionJsonPath,
  channelHandoffDecisionMarkdownPath,
  type ChannelHandoffDecision,
  type ChannelHandoffDecisionInput,
  type ChannelHandoffDecisionRecord,
  type SelectedThumbnailCandidate,
} from "./channelHandoffDecisionContracts.js";
import {
  thumbnailCandidatePackSchema,
  thumbnailCandidatesJsonPath,
} from "./thumbnailCandidateContracts.js";

export {
  channelHandoffDecisionInputSchema,
  channelHandoffDecisionJsonPath,
  channelHandoffDecisionMarkdownPath,
  channelHandoffDecisionRecordSchema,
  channelHandoffDecisionValues,
  type ChannelHandoffDecision,
  type ChannelHandoffDecisionInput,
  type ChannelHandoffDecisionRecord,
} from "./channelHandoffDecisionContracts.js";

export async function recordChannelHandoffDecision(
  input: ChannelHandoffDecisionInput,
): Promise<ChannelHandoffDecisionRecord> {
  const parsed = channelHandoffDecisionInputSchema.parse(input);
  let run = await loadRun(parsed.runId);
  if (await pathExists(artifactPath(run.runId, channelHandoffDecisionJsonPath))) {
    throw new SafeExitError("Channel handoff decision already exists for this run.");
  }
  const finalReview = await readFinalReviewBundleStatus(run);
  const channelHandoff = await readChannelHandoffStatus(run, finalReview);
  if (channelHandoff.kind !== "present") {
    throw new SafeExitError("Channel handoff decision requires trusted channel handoff evidence.");
  }
  const selectedThumbnailCandidate = await selectThumbnailCandidate(
    run.runId,
    parsed.decision,
    parsed.thumbnailCandidateId,
  );
  const channelHandoffJson = await readFile(
    artifactPath(run.runId, channelHandoffJsonPath),
    "utf8",
  );
  const record: ChannelHandoffDecisionRecord = {
    blockedActions: [
      "This decision does not call YouTube APIs or create a private upload.",
      "This decision does not approve public or scheduled publishing.",
    ],
    channelHandoff: {
      digest: sha256(channelHandoffJson),
      path: channelHandoffJsonPath,
      status: channelHandoff.handoff.status,
    },
    createdAt: nowIso(),
    decision: parsed.decision,
    manualOnly: true,
    nextSafeAction: nextSafeAction(parsed.decision),
    notes: parsed.notes,
    reviewedBy: parsed.reviewedBy,
    runId: run.runId,
    schemaVersion: 1,
    selectedThumbnailCandidate,
    youtube: {
      metadataPath: channelHandoff.handoff.youtube.metadataPath,
      title: channelHandoff.handoff.youtube.title,
    },
  };
  run = await writeRunJson(run, "decide-channel-handoff", channelHandoffDecisionJsonPath, record);
  run = await writeRunText(
    run,
    "decide-channel-handoff",
    channelHandoffDecisionMarkdownPath,
    renderChannelHandoffDecisionMarkdown(record),
  );
  await saveRun(run);
  await appendLedgerEvent({
    runId: run.runId,
    type: "REVIEW_DECISION_RECORDED",
    stage: "decide-channel-handoff",
    message: `Channel handoff decision recorded: ${record.decision}.`,
    data: {
      decision: record.decision,
      reviewedBy: record.reviewedBy,
      selectedThumbnailCandidateId: record.selectedThumbnailCandidate?.candidateId ?? null,
    },
  });
  return record;
}

export function renderChannelHandoffDecisionMarkdown(record: ChannelHandoffDecisionRecord): string {
  return [
    "# Manual Channel Handoff Decision",
    "",
    `Run: ${record.runId}`,
    `Decision: ${record.decision}`,
    `Reviewed by: ${record.reviewedBy}`,
    `Created at: ${record.createdAt}`,
    "",
    "## Selected Thumbnail",
    "",
    renderSelectedThumbnail(record.selectedThumbnailCandidate),
    "",
    "## YouTube Draft",
    "",
    table(
      ["Field", "Value"],
      [
        ["Metadata path", record.youtube.metadataPath],
        ["Title", record.youtube.title],
      ],
    ),
    "",
    "## Notes",
    "",
    record.notes,
    "",
    "## Next Safe Action",
    "",
    record.nextSafeAction,
    "",
    "## Still Blocked",
    "",
    bulletList(record.blockedActions),
  ].join("\n");
}

async function selectThumbnailCandidate(
  runId: string,
  decision: ChannelHandoffDecision,
  candidateId: string | undefined,
): Promise<SelectedThumbnailCandidate | null> {
  if (decision !== "accepted-for-manual-channel-prep") {
    return null;
  }
  if (!candidateId) {
    throw new SafeExitError("Accepted channel handoff decisions require --thumbnail-candidate.");
  }
  const pack = thumbnailCandidatePackSchema.parse(
    JSON.parse(await readFile(artifactPath(runId, thumbnailCandidatesJsonPath), "utf8")) as unknown,
  );
  const candidate = pack.candidates.find((item) => item.id === candidateId);
  if (!candidate) {
    throw new SafeExitError(`Unknown thumbnail candidate: ${candidateId}`);
  }
  return {
    candidateId: candidate.id,
    templatePath: candidate.template.path,
    templateSha256: candidate.template.digest,
    textSafeOverlayPath: candidate.textSafeOverlay?.path,
    textSafeOverlaySha256: candidate.textSafeOverlay?.digest,
  };
}

function renderSelectedThumbnail(candidate: SelectedThumbnailCandidate | null): string {
  if (!candidate) {
    return "No thumbnail candidate selected for this decision outcome.";
  }
  return table(
    ["Field", "Value"],
    [
      ["Candidate", candidate.candidateId],
      ["Template", candidate.templatePath],
      ["Template SHA-256", candidate.templateSha256],
      ["Text-safe overlay", candidate.textSafeOverlayPath ?? "-"],
    ],
  );
}

function nextSafeAction(decision: ChannelHandoffDecision): string {
  if (decision === "accepted-for-manual-channel-prep") {
    return "Keep the selected thumbnail, metadata, chapters, subtitles, and MP4 together for manual review. Private upload remains disabled until a future explicit upload approval/config path exists.";
  }
  if (decision === "needs-revision") {
    return "Revise the channel handoff inputs, then regenerate the manual channel handoff package before deciding again.";
  }
  return "Do not use this channel handoff package. Revise upstream artifacts before any upload-prep work.";
}
