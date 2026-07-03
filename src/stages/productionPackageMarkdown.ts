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
  const normalizedHeading = heading.toLocaleLowerCase("en-US");
  const bullets: string[] = [];
  let insideSection = false;

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (isSecondLevelHeading(trimmedLine, normalizedHeading)) {
      insideSection = true;
      continue;
    }
    if (insideSection && trimmedLine.startsWith("## ")) {
      break;
    }
    const bulletText = insideSection ? markdownBulletText(trimmedLine) : null;
    if (bulletText) {
      bullets.push(bulletText);
    }
  }
  return bullets;
}

function isSecondLevelHeading(trimmedLine: string, normalizedHeading: string): boolean {
  if (!trimmedLine.startsWith("## ")) {
    return false;
  }
  return trimmedLine.slice(3).trim().toLocaleLowerCase("en-US") === normalizedHeading;
}

function markdownBulletText(trimmedLine: string): string | null {
  if (!trimmedLine.startsWith("- ")) {
    return null;
  }
  const bulletText = trimmedLine.slice(2).trim();
  return bulletText.length > 0 ? bulletText : null;
}
