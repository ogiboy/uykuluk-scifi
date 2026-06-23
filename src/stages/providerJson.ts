import { SafeExitError } from "../core/errors.js";

export function parseProviderJson(text: string, label: string): unknown {
  const normalized = stripProviderThinking(text);
  const jsonText = stripJsonFence(normalized);
  try {
    return JSON.parse(jsonText) as unknown;
  } catch {
    const extracted = extractFirstJsonPayload(jsonText);
    if (extracted) {
      try {
        return JSON.parse(extracted) as unknown;
      } catch {
        // Fall through to the canonical provider error below.
      }
    }
    throw new SafeExitError(`Invalid ${label} provider response: expected JSON.`);
  }
}

export function stripProviderThinking(text: string): string {
  return text
    .trim()
    .replace(/^(?:<think>[\s\S]*?<\/think>\s*)+/i, "")
    .trim();
}

function stripJsonFence(text: string): string {
  const match = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return match ? match[1].trim() : text;
}

function extractFirstJsonPayload(text: string): string | undefined {
  const objectStart = text.indexOf("{");
  const arrayStart = text.indexOf("[");
  const starts = [objectStart, arrayStart].filter((index) => index >= 0);
  const start = starts.length ? Math.min(...starts) : -1;
  if (start < 0) return undefined;
  const opener = text[start];
  const closer = opener === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    if (inString) {
      escaped = char === "\\" && !escaped;
      if (char === '"' && !escaped) inString = false;
      if (char !== "\\") escaped = false;
      continue;
    }
    if (char === '"') inString = true;
    if (char === opener) depth += 1;
    if (char === closer) depth -= 1;
    if (depth === 0) return text.slice(start, index + 1);
  }
  return undefined;
}
