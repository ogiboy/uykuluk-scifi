import { readFile } from "node:fs/promises";
import { z } from "zod";

import { artifactPath } from "../core/artifacts.js";
import { listRuns } from "../core/runStore.js";
import type { RunRecord } from "../core/state.js";
import { pathExists } from "../utils/fs.js";
import { ideaSignature } from "./providerIdeaQuality.js";
import type { VideoIdea } from "./types.js";

export type IdeaHistoryStatus = "approved" | "generated";

export type IdeaHistoryEntry = Readonly<{
  createdAt: string;
  ideaId: string;
  runId: string;
  status: IdeaHistoryStatus;
  title: string;
  titleSignature: string;
}>;

export type IdeaHistoryPromptSummary = Readonly<{
  approvedTitles: readonly string[];
  generatedTitles: readonly string[];
}>;

const persistedIdeaSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
});

const ideasArtifactSchema = z.object({
  ideas: z.array(persistedIdeaSchema),
});

const maxHistoryPromptTitles = 16;
const maxIdeaHistoryEntries = 120;

/**
 * Reads title-only idea history from persisted run artifacts.
 *
 * This intentionally avoids script bodies and `.ai` state so idea originality context remains
 * compact, local-first, and derived from runtime artifacts only.
 *
 * @param options.excludeRunId - Optional current run id to omit while generating ideas.
 * @returns Recent idea titles with approval status derived from run state.
 */
export async function readIdeaHistory(
  options: {
    excludeRunId?: string;
  } = {},
): Promise<IdeaHistoryEntry[]> {
  const entries: IdeaHistoryEntry[] = [];
  for (const run of await listRuns()) {
    if (run.runId === options.excludeRunId) {
      continue;
    }
    entries.push(...(await ideaHistoryEntriesForRun(run)));
    if (entries.length >= maxIdeaHistoryEntries) {
      return entries.slice(0, maxIdeaHistoryEntries);
    }
  }
  return entries;
}

/**
 * Builds a compact title-only prompt block for avoiding recent channel repeats.
 *
 * @param history - Persisted idea history entries.
 * @returns A prompt block, or undefined when no history exists.
 */
export function ideaHistoryPromptBlock(history: readonly IdeaHistoryEntry[]): string | undefined {
  const summary = ideaHistoryPromptSummary(history);
  if (!summary.approvedTitles.length && !summary.generatedTitles.length) {
    return undefined;
  }
  return [
    "## Recent UykulukSciFi Idea History",
    "",
    "Use this title-only history to avoid repeating the channel's previous idea space. Do not continue, rewrite, or lightly rename these ideas.",
    "",
    summary.approvedTitles.length
      ? `Previously approved titles to avoid closely: ${summary.approvedTitles.join("; ")}.`
      : "Previously approved titles to avoid closely: none recorded.",
    summary.generatedTitles.length
      ? `Recent generated titles to avoid repeating when possible: ${summary.generatedTitles.join(
          "; ",
        )}.`
      : "Recent generated titles to avoid repeating when possible: none recorded.",
  ].join("\n");
}

/**
 * Validates a new idea slate against previously generated or approved titles.
 *
 * Generated titles are also hard blockers because unused local drafts still occupy channel idea
 * space and should not be resurfaced as fresh candidates.
 *
 * @param ideas - Newly parsed ideas.
 * @param history - Existing title-only idea history.
 * @returns A provider-validation style issue string when a duplicate is found.
 */
export function historicalIdeaTitleIssue(
  ideas: readonly VideoIdea[],
  history: readonly IdeaHistoryEntry[],
): string | undefined {
  const historicalBySignature = historicalIdeaTitleMap(history);
  for (const [index, idea] of ideas.entries()) {
    const historicalEntry = historicalBySignature.get(ideaSignature(idea.title));
    if (historicalEntry) {
      return `ideas.${index}.title: Repeats previously ${historicalEntry.status} idea "${historicalEntry.title}" from ${historicalEntry.runId}; generate a genuinely different title and premise.`;
    }
  }
  return undefined;
}

function historicalIdeaTitleMap(
  history: readonly IdeaHistoryEntry[],
): Map<string, IdeaHistoryEntry> {
  const entries = new Map<string, IdeaHistoryEntry>();
  for (const entry of history) {
    if (!entries.has(entry.titleSignature)) {
      entries.set(entry.titleSignature, entry);
    }
  }
  return entries;
}

/**
 * Produces evidence metadata for the idea artifact without persisting large history bodies.
 *
 * @param history - Existing title-only idea history.
 * @returns Counts and title samples used for operator/debug evidence.
 */
export function ideaHistoryEvidence(history: readonly IdeaHistoryEntry[]): {
  approvedTitlesConsidered: number;
  generatedTitlesConsidered: number;
  promptTitles: IdeaHistoryPromptSummary;
  source: "runs/ideas.json";
} {
  const approvedTitlesConsidered = history.filter((entry) => entry.status === "approved").length;
  return {
    source: "runs/ideas.json",
    approvedTitlesConsidered,
    generatedTitlesConsidered: history.length - approvedTitlesConsidered,
    promptTitles: ideaHistoryPromptSummary(history),
  };
}

function ideaHistoryPromptSummary(history: readonly IdeaHistoryEntry[]): IdeaHistoryPromptSummary {
  return {
    approvedTitles: uniqueTitles(
      history.filter((entry) => entry.status === "approved").map((entry) => entry.title),
    ).slice(0, maxHistoryPromptTitles),
    generatedTitles: uniqueTitles(
      history.filter((entry) => entry.status === "generated").map((entry) => entry.title),
    ).slice(0, maxHistoryPromptTitles),
  };
}

async function ideaHistoryEntriesForRun(run: RunRecord): Promise<IdeaHistoryEntry[]> {
  const target = artifactPath(run.runId, "ideas.json");
  if (!(await pathExists(target))) {
    return [];
  }
  try {
    const artifact = ideasArtifactSchema.parse(JSON.parse(await readFile(target, "utf8")));
    return artifact.ideas.map((idea) => ({
      createdAt: run.createdAt,
      ideaId: idea.id,
      runId: run.runId,
      status: run.approvedIdeaId === idea.id ? "approved" : "generated",
      title: idea.title,
      titleSignature: ideaSignature(idea.title),
    }));
  } catch (error) {
    if (!(error instanceof SyntaxError) && !(error instanceof z.ZodError)) {
      throw error;
    }
    return [];
  }
}

function uniqueTitles(titles: readonly string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const title of titles) {
    const signature = ideaSignature(title);
    if (seen.has(signature)) {
      continue;
    }
    seen.add(signature);
    unique.push(title);
  }
  return unique;
}
