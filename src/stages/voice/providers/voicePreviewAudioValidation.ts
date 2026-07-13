import { SafeExitError } from "../../../core/errors.js";

const minimumPreviewBytes = 128;
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

/**
 * Determines whether preview audio is a recognized MP3 or WAV file.
 *
 * @param audio - Audio data to inspect
 * @returns The detected audio format
 */
export function detectPreviewFormat(audio: Buffer): "mp3" | "wav" {
  if (audio.byteLength < minimumPreviewBytes) {
    throw new SafeExitError("ElevenLabs preview response is too short to be auditable audio.");
  }
  if (hasPlayableMpegFrame(audio)) return "mp3";
  if (hasPlayableWavStructure(audio)) return "wav";
  throw new SafeExitError("ElevenLabs preview response is not recognized MP3 or WAV audio.");
}

/**
 * Determines whether the buffer contains two consecutive playable MPEG frames.
 *
 * @param audio - The audio data to inspect
 * @returns `true` if two consecutive valid MPEG frames are present, `false` otherwise
 */
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

/**
 * Determines the byte length of a valid MPEG audio frame header.
 *
 * @param audio - The buffer containing the MPEG frame header
 * @param offset - The byte offset at which the frame header begins
 * @returns The calculated frame length in bytes, or `undefined` when the header is invalid
 */
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

/**
 * Determines the sample-rate divisor for an MPEG version.
 *
 * @param version - The MPEG version identifier
 * @returns `1` for MPEG-1, `2` for MPEG-2, or `4` for other versions
 */
function mpegSampleRateDivisor(version: number): number {
  if (version === 3) return 1;
  if (version === 2) return 2;
  return 4;
}

/**
 * Validates whether audio has a structurally valid, auditable PCM WAV format.
 *
 * @param audio - The audio data to inspect
 * @returns `true` if the data contains a valid PCM WAV structure with sufficient audio data, `false` otherwise.
 */
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
