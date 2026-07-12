import { SafeExitError } from "../../core/errors.js";

export type WavPeakNormalizationEvidence = {
  applied: boolean;
  gainDb: number;
  sourcePeakDbfs: number;
  targetPeakDbfs: number;
};

export function wavFromPcm16(pcm: Buffer, sampleRateHz: number, channels: number): Buffer {
  const header = Buffer.alloc(44);
  const byteRate = sampleRateHz * channels * 2;
  header.write("RIFF", 0, "ascii");
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8, "ascii");
  header.write("fmt ", 12, "ascii");
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRateHz, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(channels * 2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36, "ascii");
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

export function readWavInfo(buffer: Buffer): {
  channels: number;
  durationSeconds: number;
  sampleRateHz: number;
} {
  if (!hasRiffWaveHeader(buffer)) {
    throw new SafeExitError("Voice output is not a WAV RIFF file.");
  }
  const info = scanWavChunks(buffer);
  if (
    info.channels <= 0 ||
    info.sampleRateHz <= 0 ||
    info.byteRate <= 0 ||
    info.blockAlign !== info.channels * 2 ||
    info.byteRate !== info.sampleRateHz * info.blockAlign ||
    info.dataBytes <= 0 ||
    info.dataOffset + info.dataBytes > buffer.length
  ) {
    throw new SafeExitError("Voice output WAV metadata is incomplete.");
  }
  return {
    channels: info.channels,
    durationSeconds: info.dataBytes / info.byteRate,
    sampleRateHz: info.sampleRateHz,
  };
}

/** Concatenates compatible PCM16 WAV payloads into one canonical WAV container. */
export function concatenatePcm16Wavs(buffers: readonly Buffer[]): Buffer {
  if (buffers.length === 0) {
    throw new SafeExitError("Voice WAV stitching requires at least one audio chunk.");
  }
  const chunks = buffers.map((buffer) => {
    if (!hasRiffWaveHeader(buffer)) {
      throw new SafeExitError("Voice output is not a WAV RIFF file.");
    }
    const info = scanWavChunks(buffer);
    if (
      info.audioFormat !== 1 ||
      info.bitsPerSample !== 16 ||
      info.blockAlign !== info.channels * 2 ||
      info.byteRate !== info.sampleRateHz * info.blockAlign ||
      info.dataBytes <= 0 ||
      info.dataOffset + info.dataBytes > buffer.length
    ) {
      throw new SafeExitError("Voice WAV stitching requires PCM 16-bit audio chunks.");
    }
    return { info, pcm: buffer.subarray(info.dataOffset, info.dataOffset + info.dataBytes) };
  });
  const first = chunks[0].info;
  for (const chunk of chunks.slice(1)) {
    if (
      chunk.info.channels !== first.channels ||
      chunk.info.sampleRateHz !== first.sampleRateHz ||
      chunk.info.bitsPerSample !== first.bitsPerSample
    ) {
      throw new SafeExitError("Voice WAV chunks use incompatible audio formats.");
    }
  }
  return wavFromPcm16(
    Buffer.concat(chunks.map((chunk) => chunk.pcm)),
    first.sampleRateHz,
    first.channels,
  );
}

export function normalizePcm16WavPeak(
  buffer: Buffer,
  targetPeakDbfs = -1,
): { buffer: Buffer; evidence: WavPeakNormalizationEvidence } {
  if (!hasRiffWaveHeader(buffer)) {
    throw new SafeExitError("Voice output is not a WAV RIFF file.");
  }
  const info = scanWavChunks(buffer);
  if (info.audioFormat !== 1 || info.bitsPerSample !== 16 || info.dataBytes <= 0) {
    throw new SafeExitError("Voice peak normalization requires PCM 16-bit WAV audio.");
  }

  const dataEnd = Math.min(buffer.length, info.dataOffset + info.dataBytes);
  let sourcePeak = 0;
  for (let offset = info.dataOffset; offset + 1 < dataEnd; offset += 2) {
    sourcePeak = Math.max(sourcePeak, Math.abs(buffer.readInt16LE(offset)));
  }
  const sourcePeakDbfs = sourcePeak > 0 ? amplitudeDbfs(sourcePeak) : -120;
  const targetPeak = Math.floor(32_767 * 10 ** (targetPeakDbfs / 20));
  if (sourcePeak <= targetPeak || sourcePeak === 0) {
    return {
      buffer,
      evidence: {
        applied: false,
        gainDb: 0,
        sourcePeakDbfs: roundDb(sourcePeakDbfs),
        targetPeakDbfs,
      },
    };
  }

  const gain = targetPeak / sourcePeak;
  const normalized = Buffer.from(buffer);
  for (let offset = info.dataOffset; offset + 1 < dataEnd; offset += 2) {
    normalized.writeInt16LE(Math.round(normalized.readInt16LE(offset) * gain), offset);
  }
  return {
    buffer: normalized,
    evidence: {
      applied: true,
      gainDb: roundDb(20 * Math.log10(gain)),
      sourcePeakDbfs: roundDb(sourcePeakDbfs),
      targetPeakDbfs,
    },
  };
}

function hasRiffWaveHeader(buffer: Buffer): boolean {
  return (
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WAVE"
  );
}

function scanWavChunks(buffer: Buffer): {
  audioFormat: number;
  bitsPerSample: number;
  blockAlign: number;
  byteRate: number;
  channels: number;
  dataBytes: number;
  dataOffset: number;
  sampleRateHz: number;
} {
  const info = {
    audioFormat: 0,
    bitsPerSample: 0,
    blockAlign: 0,
    byteRate: 0,
    channels: 0,
    dataBytes: 0,
    dataOffset: 0,
    sampleRateHz: 0,
  };
  for (let offset = 12; offset + 8 <= buffer.length;) {
    const chunkId = buffer.subarray(offset, offset + 4).toString("ascii");
    const chunkSize = buffer.readUInt32LE(offset + 4);
    const dataOffset = offset + 8;
    if (chunkId === "fmt ") {
      info.audioFormat = buffer.readUInt16LE(dataOffset);
      info.channels = buffer.readUInt16LE(dataOffset + 2);
      info.sampleRateHz = buffer.readUInt32LE(dataOffset + 4);
      info.byteRate = buffer.readUInt32LE(dataOffset + 8);
      info.blockAlign = buffer.readUInt16LE(dataOffset + 12);
      info.bitsPerSample = buffer.readUInt16LE(dataOffset + 14);
    } else if (chunkId === "data") {
      info.dataBytes = chunkSize;
      info.dataOffset = dataOffset;
    }
    offset = dataOffset + chunkSize + (chunkSize % 2);
  }
  return info;
}

function amplitudeDbfs(amplitude: number): number {
  return 20 * Math.log10(amplitude / 32_768);
}

function roundDb(value: number): number {
  const rounded = Math.round(value * 1000) / 1000;
  return Object.is(rounded, -0) ? 0 : rounded;
}
