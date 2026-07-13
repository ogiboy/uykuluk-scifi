import { SafeExitError } from "../../../core/errors.js";

const maximumPreviewBytes = 5 * 1024 * 1024;
const minimumPreviewBytes = 128;
const previewTimeoutMs = 30_000;
const mpeg1BitratesKbps = {
  1: [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0],
  2: [0, 32, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 384, 0],
  3: [0, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448, 0],
} as const;
const mpeg2BitratesKbps = {
  1: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0],
  2: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0],
  3: [0, 32, 48, 56, 64, 80, 96, 112, 128, 144, 160, 176, 192, 224, 256, 0],
} as const;

export type DownloadedVoicePreview = { audio: Buffer; format: "mp3" | "wav"; requestId?: string };

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

function detectPreviewFormat(audio: Buffer): "mp3" | "wav" {
  if (audio.byteLength < minimumPreviewBytes) {
    throw new SafeExitError("ElevenLabs preview response is too short to be auditable audio.");
  }
  if (hasPlayableMpegFrame(audio)) return "mp3";
  if (hasPlayableWavStructure(audio)) return "wav";
  throw new SafeExitError("ElevenLabs preview response is not recognized MP3 or WAV audio.");
}

function hasPlayableMpegFrame(audio: Buffer): boolean {
  let scanStart = 0;
  if (audio.subarray(0, 3).toString("ascii") === "ID3") {
    if (audio.byteLength < 10 || audio.subarray(6, 10).some((byte) => byte > 0x7f)) return false;
    const tagSize = (audio[6] << 21) | (audio[7] << 14) | (audio[8] << 7) | audio[9];
    scanStart = 10 + tagSize + (audio[5] & 0x10 ? 10 : 0);
  }
  const scanEnd = Math.min(audio.byteLength - 4, scanStart + 4_096);
  for (let index = scanStart; index <= scanEnd; index += 1) {
    const firstFrameBytes = mpegFrameBytes(audio, index);
    if (!firstFrameBytes) continue;
    const secondFrameOffset = index + firstFrameBytes;
    const secondFrameBytes = mpegFrameBytes(audio, secondFrameOffset);
    if (secondFrameBytes && secondFrameOffset + secondFrameBytes <= audio.byteLength) return true;
  }
  return false;
}

function mpegFrameBytes(audio: Buffer, offset: number): number | undefined {
  if (offset < 0 || offset + 4 > audio.byteLength) return undefined;
  const first = audio[offset];
  const second = audio[offset + 1];
  const third = audio[offset + 2];
  if (first !== 0xff || (second & 0xe0) !== 0xe0) return undefined;
  // MPEG header bits: version 3/2/0 mean MPEG-1/2/2.5; layer 3/2/1 mean Layer I/II/III.
  const version = (second >> 3) & 0x03;
  const layer = (second >> 1) & 0x03;
  const bitrateIndex = (third >> 4) & 0x0f;
  const sampleRateIndex = (third >> 2) & 0x03;
  if (version === 1 || layer === 0 || bitrateIndex === 0 || bitrateIndex === 15) return undefined;
  if (sampleRateIndex === 3) return undefined;
  const table = version === 3 ? mpeg1BitratesKbps : mpeg2BitratesKbps;
  const bitrateKbps = table[layer as 1 | 2 | 3][bitrateIndex];
  const sampleRateDivisor = mpegSampleRateDivisor(version);
  const sampleRate = [44_100, 48_000, 32_000][sampleRateIndex] / sampleRateDivisor;
  const padding = (third >> 1) & 0x01;
  if (!bitrateKbps || !sampleRate) return undefined;
  if (layer === 3) {
    return Math.floor((12 * bitrateKbps * 1_000) / sampleRate + padding) * 4;
  }
  const coefficient = layer === 1 && version !== 3 ? 72 : 144;
  return Math.floor((coefficient * bitrateKbps * 1_000) / sampleRate) + padding;
}

function mpegSampleRateDivisor(version: number): number {
  if (version === 3) return 1;
  if (version === 2) return 2;
  return 4;
}

function hasPlayableWavStructure(audio: Buffer): boolean {
  if (
    audio.subarray(0, 4).toString("ascii") !== "RIFF" ||
    audio.subarray(8, 12).toString("ascii") !== "WAVE"
  ) {
    return false;
  }
  const declaredBytes = audio.readUInt32LE(4) + 8;
  if (declaredBytes !== audio.byteLength || declaredBytes < 44) return false;
  let blockAlign = 0;
  let sampleRate = 0;
  let hasAudioData = false;
  for (let offset = 12; offset + 8 <= declaredBytes;) {
    const chunkId = audio.subarray(offset, offset + 4).toString("ascii");
    const chunkBytes = audio.readUInt32LE(offset + 4);
    const nextOffset = offset + 8 + chunkBytes + (chunkBytes % 2);
    if (nextOffset > declaredBytes) return false;
    if (chunkId === "fmt " && chunkBytes >= 16) {
      const formatOffset = offset + 8;
      const audioFormat = audio.readUInt16LE(formatOffset);
      const channels = audio.readUInt16LE(formatOffset + 2);
      sampleRate = audio.readUInt32LE(formatOffset + 4);
      const byteRate = audio.readUInt32LE(formatOffset + 8);
      blockAlign = audio.readUInt16LE(formatOffset + 12);
      const bitsPerSample = audio.readUInt16LE(formatOffset + 14);
      if (
        audioFormat !== 1 ||
        channels < 1 ||
        channels > 8 ||
        sampleRate < 8_000 ||
        sampleRate > 192_000 ||
        ![8, 16, 24, 32].includes(bitsPerSample) ||
        blockAlign !== channels * (bitsPerSample / 8) ||
        byteRate !== sampleRate * blockAlign
      ) {
        return false;
      }
    }
    if (chunkId === "data" && blockAlign > 0 && sampleRate > 0) {
      const minimumAuditablePcmBytes = Math.ceil((sampleRate * blockAlign) / 10);
      hasAudioData = chunkBytes >= minimumAuditablePcmBytes;
    }
    offset = nextOffset;
  }
  return blockAlign > 0 && hasAudioData;
}

function boundedRequestId(value: string | null): string | undefined {
  const normalized = value?.trim();
  return normalized && normalized.length <= 256 ? normalized : undefined;
}
