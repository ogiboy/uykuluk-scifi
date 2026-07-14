import { createHash } from "node:crypto";

import { readRegisteredArtifactBytesAtProjectRoot } from "../../../../../src/core/artifactRevision";
import type { VoiceAuditionRun } from "./voiceAuditionSummaryTypes";

/** Reads exact bytes only when the artifact remains registered and filesystem-contained. */
export async function requireRegisteredBytes(
  root: string,
  run: VoiceAuditionRun,
  relativePath: string,
): Promise<Buffer> {
  const bytes = await readRegisteredArtifactBytesAtProjectRoot(root, run, relativePath);
  if (!bytes) throw new Error(`registered artifact is missing: ${relativePath}`);
  return bytes;
}

export function sha256(value: Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

export function objectRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function stringField(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export function numberField(record: Record<string, unknown>, key: string): number | undefined {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
