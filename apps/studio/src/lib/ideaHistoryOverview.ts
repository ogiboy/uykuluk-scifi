import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

import { projectRoot } from "./projectRoot";
import { studioRunFilePath } from "./runs/runFilePaths";
import { isRunId, readRunRecord, safeReaddir } from "./runs/runSummaryFiles";

const studioIdeaHistoryItemSchema = z.object({
  id: z.string().min(1),
  premise: z.string().optional(),
  title: z.string().min(1),
});

const studioIdeaHistoryArtifactSchema = z.object({
  history: z
    .object({
      approvedTitlesConsidered: z.number().int().nonnegative().optional(),
      generatedTitlesConsidered: z.number().int().nonnegative().optional(),
      source: z.string().optional(),
    })
    .optional(),
  ideas: z.array(studioIdeaHistoryItemSchema),
});

export type StudioIdeaHistoryEntry = Readonly<{
  createdAt: string;
  ideaId: string;
  premise?: string;
  runId: string;
  state: string;
  status: "approved" | "generated";
  title: string;
  titleSignature: string;
  updatedAt: string;
}>;

export type StudioIdeaHistoryOverview = Readonly<{
  approvedCount: number;
  duplicateTitleCount: number;
  entries: readonly StudioIdeaHistoryEntry[];
  generatedOnlyCount: number;
  lastUpdated: string | null;
  policy: {
    hardBlock: "generated-and-approved";
    promptContext: "title-only";
    source: "runtime-ideas-json";
  };
  runCount: number;
  totalCount: number;
}>;

/**
 * Reads the Studio idea-history overview from runtime run artifacts.
 *
 * @returns Title-only idea history used to explain originality guard behavior in Studio.
 */
export async function getStudioIdeaHistoryOverview(): Promise<StudioIdeaHistoryOverview> {
  const root = projectRoot();
  const entries = await readIdeaHistoryEntries(root);
  const duplicateTitleCount = duplicateSignatureCount(entries);
  return {
    approvedCount: entries.filter((entry) => entry.status === "approved").length,
    duplicateTitleCount,
    entries,
    generatedOnlyCount: entries.filter((entry) => entry.status === "generated").length,
    lastUpdated: entries[0]?.updatedAt ?? null,
    policy: {
      hardBlock: "generated-and-approved",
      promptContext: "title-only",
      source: "runtime-ideas-json",
    },
    runCount: new Set(entries.map((entry) => entry.runId)).size,
    totalCount: entries.length,
  };
}

async function readIdeaHistoryEntries(root: string): Promise<StudioIdeaHistoryEntry[]> {
  const runsDir = path.join(root, "runs");
  const entries = await safeReaddir(runsDir);
  const history = (
    await Promise.all(
      entries
        .filter((entry) => entry.isDirectory() && isRunId(entry.name))
        .map((entry) => readRunIdeaHistory(root, entry.name)),
    )
  ).flat();
  return history.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

async function readRunIdeaHistory(root: string, runId: string): Promise<StudioIdeaHistoryEntry[]> {
  const record = await readRunRecord(root, runId);
  if (!record) {
    return [];
  }
  const file = studioRunFilePath(root, runId, "ideas.json");
  if (!file) {
    return [];
  }
  try {
    const artifact = studioIdeaHistoryArtifactSchema.parse(
      JSON.parse(await readFile(file, "utf8")) as unknown,
    );
    return artifact.ideas.map((idea) => ({
      createdAt: record.createdAt ?? "",
      ideaId: idea.id,
      premise: idea.premise,
      runId,
      state: record.state,
      status: record.approvedIdeaId === idea.id ? "approved" : "generated",
      title: idea.title,
      titleSignature: ideaTitleSignature(idea.title),
      updatedAt: record.updatedAt ?? record.createdAt ?? "",
    }));
  } catch (error) {
    if (
      (error as NodeJS.ErrnoException).code === "ENOENT" ||
      error instanceof SyntaxError ||
      error instanceof z.ZodError
    ) {
      return [];
    }
    throw error;
  }
}

function duplicateSignatureCount(entries: readonly StudioIdeaHistoryEntry[]): number {
  const signatures = new Map<string, number>();
  for (const entry of entries) {
    signatures.set(entry.titleSignature, (signatures.get(entry.titleSignature) ?? 0) + 1);
  }
  return Array.from(signatures.values()).filter((count) => count > 1).length;
}

function ideaTitleSignature(title: string): string {
  return title
    .toLocaleLowerCase("tr")
    .replaceAll(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}
