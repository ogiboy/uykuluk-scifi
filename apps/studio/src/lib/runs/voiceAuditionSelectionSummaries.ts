import {
  isVoiceSelectionArtifactPath,
  voiceSelectionSchema,
  type VoiceSelection,
} from "../../../../../src/stages/voice/catalog/voiceAuditionContracts";
import { canonicalVoiceEvidenceDigest } from "../../../../../src/stages/voice/catalog/voiceCatalogDigest";
import {
  errorMessage,
  objectRecord,
  requireRegisteredBytes,
  stringField,
} from "./voiceAuditionArtifactReads";
import type {
  StudioVoiceSelectionHistoryItem,
  VoiceAuditionRun,
} from "./voiceAuditionSummaryTypes";

export async function readVoiceSelectionHistory(
  root: string,
  run: VoiceAuditionRun,
): Promise<{ diagnostics: string[]; history: StudioVoiceSelectionHistoryItem[] }> {
  const diagnostics: string[] = [];
  const selectionPaths = run.artifacts.filter(isVoiceSelectionArtifactPath);
  const selections = await Promise.all(
    selectionPaths.map(async (artifactPath) => {
      try {
        const selection = await readSelection(root, run, artifactPath);
        return selectionHistoryItem(selection, artifactPath, "superseded");
      } catch (error) {
        diagnostics.push(
          `Selection ${artifactPath} could not be validated: ${errorMessage(error)}`,
        );
        return null;
      }
    }),
  );
  const currentPath = selectionPaths.at(-1);
  const history: StudioVoiceSelectionHistoryItem[] = selections
    .filter((item): item is StudioVoiceSelectionHistoryItem => Boolean(item))
    .map((item) =>
      item.artifactPath === currentPath ? { ...item, status: "current" as const } : item,
    );
  await addArchivedSelections(root, run, history, diagnostics);
  history.sort((left, right) => right.selectedAt.localeCompare(left.selectedAt));
  return { diagnostics, history };
}

async function addArchivedSelections(
  root: string,
  run: VoiceAuditionRun,
  history: StudioVoiceSelectionHistoryItem[],
  diagnostics: string[],
): Promise<void> {
  const knownDigests = new Set(history.map((item) => item.selectionDigest));
  const revisionPaths = run.artifacts.filter((artifact) =>
    /^revisions\/voice-selection\/[A-Za-z0-9._-]+\/revision\.json$/u.test(artifact),
  );
  for (const revisionPath of revisionPaths) {
    try {
      const revision = JSON.parse(
        (await requireRegisteredBytes(root, run, revisionPath)).toString("utf8"),
      ) as unknown;
      const record = objectRecord(revision);
      const archived = Array.isArray(record.archivedArtifacts) ? record.archivedArtifacts : [];
      const selectionArchive = archived
        .map(objectRecord)
        .find(
          (item) =>
            typeof item.sourcePath === "string" && isVoiceSelectionArtifactPath(item.sourcePath),
        );
      if (!selectionArchive || typeof selectionArchive.archivedPath !== "string") continue;
      const selection = await readSelection(root, run, selectionArchive.archivedPath);
      if (knownDigests.has(selection.selectionDigest)) continue;
      history.push({
        ...selectionHistoryItem(selection, selectionArchive.archivedPath, "reselected"),
        reason: stringField(record, "reason"),
        reviewedBy: stringField(record, "reviewedBy") ?? selection.selectedBy,
      });
      knownDigests.add(selection.selectionDigest);
    } catch (error) {
      diagnostics.push(`Voice reselection history is invalid: ${errorMessage(error)}`);
    }
  }
}

async function readSelection(
  root: string,
  run: VoiceAuditionRun,
  artifactPath: string,
): Promise<VoiceSelection> {
  const selection = voiceSelectionSchema.parse(
    JSON.parse((await requireRegisteredBytes(root, run, artifactPath)).toString("utf8")) as unknown,
  );
  const { selectionDigest, ...digestInput } = selection;
  if (
    selection.runId !== run.runId ||
    canonicalVoiceEvidenceDigest(digestInput) !== selectionDigest
  ) {
    throw new Error("selection identity or digest does not match");
  }
  return selection;
}

function selectionHistoryItem(
  selection: VoiceSelection,
  artifactPath: string,
  status: StudioVoiceSelectionHistoryItem["status"],
): StudioVoiceSelectionHistoryItem {
  return {
    artifactPath,
    name: selection.voice.name,
    notes: selection.notes,
    productionRightsConfirmed: selection.productionRights.confirmed,
    reviewedBy: selection.selectedBy,
    selectedAt: selection.selectedAt,
    selectionDigest: selection.selectionDigest,
    status,
    voiceId: selection.voice.voiceId,
  };
}
