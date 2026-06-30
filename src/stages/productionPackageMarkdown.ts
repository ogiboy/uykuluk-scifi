import { readFile } from "node:fs/promises";
import { artifactPath } from "../core/artifacts.js";

/**
 * Reads popup-card copy from the generated production package Markdown.
 *
 * @param runId - The run identifier.
 * @returns Popup-card bullet text in package order.
 */
export async function readProductionPackagePopupCards(runId: string): Promise<string[]> {
  const markdown = await readFile(artifactPath(runId, "production/production_package.md"), "utf8");
  return extractMarkdownBullets(markdown, "Popup Cards");
}

function extractMarkdownBullets(markdown: string, heading: string): string[] {
  const lines = markdown.split(/\r?\n/u);
  const headingPattern = new RegExp(`^##\\s+${escapeRegExp(heading)}\\s*$`, "iu");
  const bullets: string[] = [];
  let insideSection = false;

  for (const line of lines) {
    if (headingPattern.test(line.trim())) {
      insideSection = true;
      continue;
    }
    if (insideSection && /^##\s+/u.test(line.trim())) {
      break;
    }
    const bulletMatch = insideSection ? /^-\s+(.+)$/u.exec(line.trim()) : null;
    if (bulletMatch?.[1]) {
      bullets.push(bulletMatch[1].trim());
    }
  }
  return bullets;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}
