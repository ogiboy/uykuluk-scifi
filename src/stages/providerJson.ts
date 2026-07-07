import { SafeExitError } from "../core/errors.js";

type JsonScanState = { depth: number; escaped: boolean; inString: boolean };

export function parseProviderJson(text: string, label: string): unknown {
  const normalized = stripProviderThinking(text);
  const jsonText = stripJsonFence(normalized);
  const directParse = tryParseJson(jsonText);
  if (directParse.success) {
    return directParse.value;
  }

  const extracted = extractFirstJsonPayload(jsonText);
  const extractedParse = extracted ? tryParseJson(extracted) : undefined;
  if (extractedParse?.success) {
    return extractedParse.value;
  }

  throw new SafeExitError(`Invalid ${label} provider response: expected JSON.`);
}

export function stripProviderThinking(text: string): string {
  let remaining = text.trim();
  while (/^<think>/iu.test(remaining)) {
    const withoutThinking = remaining.replace(/^<think>[\s\S]*?<\/think>\s*/iu, "").trim();
    if (withoutThinking === remaining) {
      return remaining;
    }
    remaining = withoutThinking;
  }
  return remaining;
}

function stripJsonFence(text: string): string {
  const trimmed = text.trim();
  if (!trimmed.startsWith("```") || !trimmed.endsWith("```")) {
    return text;
  }
  const firstLineEnd = trimmed.indexOf("\n");
  if (firstLineEnd < 0) {
    return text;
  }
  const fenceInfo = trimmed.slice(3, firstLineEnd).trim().toLocaleLowerCase("en-US");
  if (fenceInfo !== "" && fenceInfo !== "json") {
    return text;
  }
  return trimmed.slice(firstLineEnd + 1, -3).trim();
}

type JsonParseResult = { success: true; value: unknown } | { success: false };

function tryParseJson(text: string): JsonParseResult {
  try {
    return { success: true, value: JSON.parse(text) as unknown };
  } catch {
    return { success: false };
  }
}

function extractFirstJsonPayload(text: string): string | undefined {
  const start = firstJsonPayloadStart(text);
  if (start < 0) {
    return undefined;
  }
  const end = firstJsonPayloadEnd(text, start);
  return end ? text.slice(start, end) : undefined;
}

function firstJsonPayloadStart(text: string): number {
  const objectStart = text.indexOf("{");
  const arrayStart = text.indexOf("[");
  const starts = [objectStart, arrayStart].filter((index) => index >= 0);
  return starts.length ? Math.min(...starts) : -1;
}

function firstJsonPayloadEnd(text: string, start: number): number | undefined {
  const container = jsonContainer(text[start]);
  if (!container) {
    return undefined;
  }
  const state: JsonScanState = { depth: 0, escaped: false, inString: false };
  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    if (state.inString) {
      scanJsonStringCharacter(state, char);
      continue;
    }
    scanJsonContainerCharacter(state, char, container);
    if (state.depth === 0) {
      return index + 1;
    }
  }
  return undefined;
}

function jsonContainer(opener: string): { opener: string; closer: string } | undefined {
  if (opener === "{") {
    return { opener, closer: "}" };
  }
  if (opener === "[") {
    return { opener, closer: "]" };
  }
  return undefined;
}

function scanJsonStringCharacter(state: JsonScanState, char: string): void {
  if (state.escaped) {
    state.escaped = false;
    return;
  }
  if (char === "\\") {
    state.escaped = true;
    return;
  }
  if (char === '"') {
    state.inString = false;
  }
}

function scanJsonContainerCharacter(
  state: JsonScanState,
  char: string,
  container: { opener: string; closer: string },
): void {
  if (char === '"') {
    state.inString = true;
    return;
  }
  if (char === container.opener) {
    state.depth += 1;
    return;
  }
  if (char === container.closer) {
    state.depth -= 1;
  }
}
