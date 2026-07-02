import { readFile } from "node:fs/promises";
import { z } from "zod";
import { studioRunFilePath } from "./runFilePaths";

const studioGeneratedIdeaSchema = z.strictObject({
  estimatedDifficulty: z.string().optional(),
  fit: z.string().optional(),
  id: z.string().min(1),
  premise: z.string().optional(),
  riskLevel: z.string().optional(),
  style: z.string().optional(),
  targetDuration: z.string().optional(),
  title: z.string().min(1),
});

const ideasArtifactSchema = z.strictObject({
  ideas: z.array(studioGeneratedIdeaSchema),
});

export type StudioGeneratedIdea = z.infer<typeof studioGeneratedIdeaSchema>;

/**
 * Reads generated idea choices for the guarded Studio idea-approval surface.
 *
 * @param root - The project root directory.
 * @param runId - The run identifier whose ideas artifact should be read.
 * @returns The generated ideas, or an empty list when unavailable or invalid.
 */
export async function readStudioGeneratedIdeas(
  root: string,
  runId: string,
): Promise<StudioGeneratedIdea[]> {
  const file = studioRunFilePath(root, runId, "ideas.json");
  if (!file) {
    return [];
  }
  try {
    const payload = JSON.parse(await readFile(file, "utf8")) as unknown;
    const result = ideasArtifactSchema.safeParse(payload);
    return result.success ? result.data.ideas : [];
  } catch {
    return [];
  }
}
