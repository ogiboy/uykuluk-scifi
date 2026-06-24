export function stripLeadingMarkdownHeading(text: string): string {
  const trimmed = text.trim();
  const firstLineEnd = trimmed.indexOf("\n");
  const firstLine = firstLineEnd >= 0 ? trimmed.slice(0, firstLineEnd) : trimmed;
  if (!isMarkdownHeading(firstLine)) {
    return trimmed;
  }
  return firstLineEnd >= 0 ? trimmed.slice(firstLineEnd + 1).trim() : "";
}

function isMarkdownHeading(line: string): boolean {
  const markerCount = countLeadingHeadingMarkers(line);
  return markerCount >= 1 && markerCount <= 3 && line[markerCount] === " ";
}

function countLeadingHeadingMarkers(line: string): number {
  let count = 0;
  while (line[count] === "#") {
    count += 1;
  }
  return count;
}
