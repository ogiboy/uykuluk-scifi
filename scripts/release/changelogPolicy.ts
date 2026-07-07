export const changelogMarker = "<!-- version list -->";

export type ChangelogReleaseSource = "commit-derived" | "none" | "unreleased";

export type UnreleasedSection = { after: string; before: string; content: string };

export function changelogReleaseSource(
  changelogText: string,
  releaseNeeded: boolean,
): ChangelogReleaseSource {
  assertSingleMarker(changelogText);

  if (!releaseNeeded) {
    return "none";
  }

  const unreleased = splitUnreleasedSection(changelogText);
  return normalizeUnreleasedNotes(unreleased.content) ? "unreleased" : "commit-derived";
}

export function assertSingleMarker(text: string): void {
  const count = text.split(changelogMarker).length - 1;
  if (count !== 1) {
    throw new Error(
      `CHANGELOG.md must contain exactly one ${changelogMarker} marker; found ${count}.`,
    );
  }
}

export function splitUnreleasedSection(text: string): UnreleasedSection {
  const markerIndex = text.indexOf(changelogMarker);
  const unreleasedIndex = text.indexOf("## Unreleased", markerIndex);
  if (unreleasedIndex === -1) {
    throw new Error("CHANGELOG.md must contain a ## Unreleased section after the version marker.");
  }

  const contentStart = text.indexOf("\n", unreleasedIndex);
  const nextVersionIndex = text.indexOf("\n## ", contentStart + 1);
  if (contentStart === -1) {
    throw new Error("CHANGELOG.md ## Unreleased section is malformed.");
  }

  return {
    before: text.slice(0, unreleasedIndex),
    content: text.slice(contentStart + 1, nextVersionIndex === -1 ? text.length : nextVersionIndex),
    after: nextVersionIndex === -1 ? "" : text.slice(nextVersionIndex + 1),
  };
}

export function normalizeUnreleasedNotes(content: string): string {
  const trimmed = content.trim();
  if (!trimmed || trimmed === "_No unreleased changes yet._") {
    return "";
  }
  return trimmed;
}
