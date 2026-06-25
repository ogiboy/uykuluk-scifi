import { z } from "zod";
import { SafeExitError } from "../core/errors.js";
import { parseProviderJson, stripProviderThinking } from "./providerJson.js";

export const scriptContinuationMaxLength = 2400;
const scriptContinuationPayloadSchema = z.strictObject({
  text: z.string().min(1).max(scriptContinuationMaxLength),
});

export function parseScriptContinuationProviderPayload(text: string): string {
  const parsedText = parseScriptContinuationJsonPayload(text) ?? parseRawScriptContinuation(text);
  const trimmed = trimToLastCompleteSentence(parsedText);
  if (!trimmed) {
    throw new SafeExitError(
      "Invalid script continuation provider response: continuation has no complete sentence.",
    );
  }
  return trimmed;
}

function parseScriptContinuationJsonPayload(text: string): string | undefined {
  try {
    const result = scriptContinuationPayloadSchema.safeParse(
      parseProviderJson(text, "script continuation"),
    );
    if (!result.success) {
      throw invalidScriptContinuationPayload(result.error);
    }
    return stripProviderThinking(result.data.text).trim();
  } catch (error) {
    if (error instanceof SafeExitError && /expected JSON/i.test(error.message)) {
      return undefined;
    }
    throw error;
  }
}

function parseRawScriptContinuation(text: string): string {
  const raw = rawContinuationCandidate(text);
  const continuation = malformedTextWrapperCandidate(raw) ?? raw;
  return validateRawScriptContinuation(continuation);
}

function validateRawScriptContinuation(raw: string): string {
  if (raw.length > scriptContinuationMaxLength) {
    throw new SafeExitError(
      "Invalid script continuation provider response: raw continuation is too long.",
    );
  }
  if (startsLikeMalformedJson(raw) || raw.includes('"text"')) {
    throw new SafeExitError("Invalid script continuation provider response: expected JSON.");
  }
  if (raw.includes("SCRIPT_CONTINUATION_JSON") || raw.includes("## Current Script")) {
    throw new SafeExitError(
      "Invalid script continuation provider response: raw continuation echoed the prompt.",
    );
  }
  if (!/(?:Anlatıcı|Görsel):/u.test(raw)) {
    throw new SafeExitError(
      "Invalid script continuation provider response: raw continuation must use Turkish production labels.",
    );
  }
  return raw;
}

function malformedTextWrapperCandidate(text: string): string | undefined {
  if (!startsLikeMalformedJson(text) || !text.includes('"text"')) {
    return undefined;
  }
  const match = /"text"\s*:\s*"/u.exec(text.trim());
  if (!match) {
    return undefined;
  }
  const bodyAndTail = text.trim().slice(match.index + match[0].length);
  const closingIndex = malformedTextClosingIndex(bodyAndTail);
  const candidate =
    closingIndex >= 0 ? bodyAndTail.slice(0, closingIndex) : stripDanglingJsonWrapper(bodyAndTail);
  return candidate.trim();
}

function malformedTextClosingIndex(value: string): number {
  for (let index = value.length - 1; index >= 0; index -= 1) {
    if (value[index] === '"' && isMalformedWrapperTail(value.slice(index + 1))) {
      return index;
    }
  }
  return -1;
}

function isMalformedWrapperTail(value: string): boolean {
  const tail = stripOptionalWrapperClose(value);
  return tail.length === 0 || isShortExternalNote(tail);
}

function stripOptionalWrapperClose(value: string): string {
  let tail = value.trim();
  if (tail.startsWith(",")) {
    tail = tail.slice(1).trim();
  }
  if (tail.startsWith("}")) {
    tail = tail.slice(1).trim();
  }
  return tail.startsWith("```") ? tail.slice(3).trim() : tail;
}

function isShortExternalNote(value: string): boolean {
  return (
    value.length <= 160 &&
    !value.includes("{") &&
    !value.includes("[") &&
    !value.includes("SCRIPT_CONTINUATION_JSON")
  );
}

function stripDanglingJsonWrapper(value: string): string {
  let candidate = value.trim();
  while (candidate.endsWith("}") || candidate.endsWith("]") || candidate.endsWith(",")) {
    candidate = candidate.slice(0, -1).trim();
  }
  return candidate;
}

function rawContinuationCandidate(text: string): string {
  const raw = stripProviderThinking(text).trim();
  return stripMarkdownFence(raw).trim();
}

function stripMarkdownFence(text: string): string {
  if (!text.startsWith("```") || !text.endsWith("```")) {
    return text;
  }
  const firstLineEnd = text.indexOf("\n");
  if (firstLineEnd < 0) {
    return text;
  }
  return text.slice(firstLineEnd + 1, -3);
}

function startsLikeMalformedJson(text: string): boolean {
  return text.startsWith("{") || text.startsWith("[");
}

function invalidScriptContinuationPayload(error: z.ZodError): Error {
  const summary = error.issues
    .slice(0, 5)
    .map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`)
    .join("; ");
  return new Error(`Invalid script continuation provider response: ${summary}`);
}

function trimToLastCompleteSentence(text: string): string {
  let lastCompleteSentenceEnd = -1;
  const sentenceEndPattern = /[.!?…](?=\s|$)/g;
  let match: RegExpExecArray | null;
  while ((match = sentenceEndPattern.exec(text)) !== null) {
    lastCompleteSentenceEnd = match.index + 1;
  }
  return lastCompleteSentenceEnd >= 0 ? text.slice(0, lastCompleteSentenceEnd).trim() : "";
}
