import { readFile } from "node:fs/promises";

/**
 * Reads a text file and truncates the returned content to a character limit.
 *
 * @param target - The file path to read.
 * @param characterLimit - The maximum number of characters to return.
 * @returns The optional text payload plus truncation metadata.
 */
export async function readOptionalText(
  target: string,
  characterLimit: number,
): Promise<{ text: string | null; truncated: boolean }> {
  try {
    const content = await readFile(target, "utf8");
    return {
      text: content.slice(0, characterLimit),
      truncated: content.length > characterLimit,
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { text: null, truncated: false };
    }
    throw error;
  }
}

/**
 * Parses a JSON artifact while preserving a specific malformed-JSON error type.
 *
 * @param rawJson - Raw persisted JSON artifact content.
 * @param artifactPath - The operator-facing artifact path.
 * @returns The parsed JSON value.
 */
export function parseArtifactJson(rawJson: string, artifactPath: string): unknown {
  try {
    return JSON.parse(rawJson) as unknown;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new ArtifactJsonParseError(artifactPath, error.message);
    }
    throw error;
  }
}

export class ArtifactJsonParseError extends Error {
  readonly artifactPath: string;

  constructor(artifactPath: string, message: string) {
    super(message);
    this.artifactPath = artifactPath;
    this.name = "ArtifactJsonParseError";
  }
}
