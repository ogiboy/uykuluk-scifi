import { SafeExitError } from "../../../core/errors.js";
import { detectPreviewFormat } from "./voicePreviewAudioValidation.js";

const maximumPreviewBytes = 5 * 1024 * 1024;
const previewTimeoutMs = 30_000;

export type DownloadedVoicePreview = { audio: Buffer; format: "mp3" | "wav"; requestId?: string };

/**
 * Downloads and validates an ElevenLabs audio preview.
 *
 * @param previewUrl - The preview URL to download.
 * @param sourceClass - The approved URL source boundary to enforce.
 * @returns The downloaded audio, detected format, and optional bounded request ID.
 * @throws SafeExitError If the URL, response, size, or audio format is invalid.
 */
export async function downloadElevenLabsPreview(
  previewUrl: string,
  sourceClass: "elevenlabs" | "eleven-public-prod",
  fetcher: typeof fetch = fetch,
): Promise<DownloadedVoicePreview> {
  const url = requireAllowedPreviewUrl(previewUrl, sourceClass);
  const response = await fetcher(url, {
    redirect: "manual",
    signal: AbortSignal.timeout(previewTimeoutMs),
  });
  if (response.status >= 300 && response.status < 400) {
    await response.body?.cancel();
    throw new SafeExitError("ElevenLabs preview redirects are not allowed.");
  }
  if (!response.ok || !response.body) {
    await response.body?.cancel();
    throw new SafeExitError("ElevenLabs preview download did not return bounded audio.");
  }
  const declaredLength = response.headers.get("content-length");
  if (declaredLength && Number(declaredLength) > maximumPreviewBytes) {
    await response.body.cancel();
    throw new SafeExitError("ElevenLabs preview exceeds the maximum allowed size.");
  }
  const audio = await readBoundedBody(response.body);
  return {
    audio,
    format: detectPreviewFormat(audio),
    requestId: boundedRequestId(response.headers.get("request-id")),
  };
}

/**
 * Validates an ElevenLabs preview URL against the approved HTTPS boundary and source host.
 *
 * @param value - The preview URL to validate.
 * @param sourceClass - The catalog source that determines the permitted host or bucket path.
 * @returns The parsed and validated preview URL.
 * @throws SafeExitError If the URL is invalid, uses a disallowed HTTPS configuration, or does not match the source class.
 */
function requireAllowedPreviewUrl(
  value: string,
  sourceClass: "elevenlabs" | "eleven-public-prod",
): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new SafeExitError("ElevenLabs preview URL is invalid.");
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.hash ||
    (url.port && url.port !== "443")
  ) {
    throw new SafeExitError("ElevenLabs preview URL is outside the approved HTTPS boundary.");
  }
  const elevenLabsHost =
    url.hostname === "elevenlabs.io" || url.hostname.endsWith(".elevenlabs.io");
  const publicBucket =
    url.hostname === "storage.googleapis.com" && url.pathname.startsWith("/eleven-public-prod/");
  if (
    (sourceClass === "elevenlabs" && !elevenLabsHost) ||
    (sourceClass === "eleven-public-prod" && !publicBucket)
  ) {
    throw new SafeExitError("ElevenLabs preview URL host does not match catalog evidence.");
  }
  return url;
}

/**
 * Reads a preview response body into a buffer while enforcing the maximum allowed size.
 *
 * @param body - The response stream containing the preview data
 * @returns The complete preview data
 */
async function readBoundedBody(body: ReadableStream<Uint8Array>): Promise<Buffer> {
  const reader = body.getReader();
  const chunks: Buffer[] = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maximumPreviewBytes) {
        throw new SafeExitError("ElevenLabs preview exceeds the maximum allowed size.");
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
  if (bytes === 0) throw new SafeExitError("ElevenLabs preview response is empty.");
  return Buffer.concat(chunks, bytes);
}

/**
 * Normalizes a request ID and limits its length.
 *
 * @param value - The request ID to normalize, or `null`
 * @returns The trimmed request ID when non-empty and at most 256 characters; `undefined` otherwise
 */
function boundedRequestId(value: string | null): string | undefined {
  const normalized = value?.trim();
  return normalized && normalized.length <= 256 ? normalized : undefined;
}
