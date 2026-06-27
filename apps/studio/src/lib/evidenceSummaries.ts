import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  materializeRunCommand,
  staticEvidenceNextCommand,
} from "../../../../src/stages/evidenceNextCommand";
import type { EvidenceStatus } from "../../../../src/stages/statusMedia";

export type StudioEvidenceSummary = {
  message: string;
  nextAction?: string;
  snapshot: EvidenceStatus | null;
  status: "available" | "invalid" | "missing" | "stale";
};

export async function readStudioEvidenceSummary(
  root: string,
  runId: string,
  state: string,
): Promise<StudioEvidenceSummary> {
  try {
    const file = path.join(root, "runs", runId, "evidence_bundle.json");
    return summarizeEvidenceSnapshot(JSON.parse(await readFile(file, "utf8")), runId, state);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return {
        message: "Evidence bundle has not been generated.",
        nextAction: evidenceNextAction(runId),
        snapshot: null,
        status: "missing",
      };
    }
    return invalidEvidence(runId, "Evidence bundle could not be parsed.");
  }
}

export function evidenceNextRecommendedCommand(
  evidence: StudioEvidenceSummary,
  state: string,
  runId: string,
): string | null {
  if (evidence.status === "invalid" || evidence.status === "stale") {
    return evidence.nextAction ?? null;
  }
  return typeof evidence.snapshot?.nextRecommendedCommand === "string"
    ? materializeRunCommand(evidence.snapshot.nextRecommendedCommand, runId)
    : materializeStaticNextCommand(state, runId);
}

function summarizeEvidenceSnapshot(
  evidence: unknown,
  runId: string,
  state: string,
): StudioEvidenceSummary {
  if (!evidence || typeof evidence !== "object") {
    return invalidEvidence(runId, "Evidence bundle is not an object.");
  }
  const snapshot = evidence as EvidenceStatus;
  if (snapshot.runId !== runId) {
    return staleEvidence(runId, "Evidence bundle belongs to a different run.");
  }
  if (snapshot.currentState !== state) {
    return staleEvidence(
      runId,
      `Evidence bundle was generated for ${String(snapshot.currentState)}, but the run is ${state}.`,
    );
  }
  return {
    message: "Evidence bundle is current.",
    snapshot,
    status: "available",
  };
}

function invalidEvidence(runId: string, message: string): StudioEvidenceSummary {
  return { message, nextAction: evidenceNextAction(runId), snapshot: null, status: "invalid" };
}

function staleEvidence(runId: string, message: string): StudioEvidenceSummary {
  return { message, nextAction: evidenceNextAction(runId), snapshot: null, status: "stale" };
}

function evidenceNextAction(runId: string): string {
  return `pnpm producer evidence --run ${runId}`;
}

function materializeStaticNextCommand(state: string, runId: string): string | null {
  const command = staticEvidenceNextCommand(state);
  return command ? materializeRunCommand(command, runId) : null;
}
