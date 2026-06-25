import { SafeExitError } from "../core/errors.js";

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
    throw new SafeExitError("Piper output is not a WAV RIFF file.");
  }
  const info = scanWavChunks(buffer);
  if (info.channels <= 0 || info.sampleRateHz <= 0 || info.byteRate <= 0 || info.dataBytes <= 0) {
    throw new SafeExitError("Piper output WAV metadata is incomplete.");
  }
  return {
    channels: info.channels,
    durationSeconds: info.dataBytes / info.byteRate,
    sampleRateHz: info.sampleRateHz,
  };
}

function hasRiffWaveHeader(buffer: Buffer): boolean {
  return (
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WAVE"
  );
}

function scanWavChunks(buffer: Buffer): {
  byteRate: number;
  channels: number;
  dataBytes: number;
  sampleRateHz: number;
} {
  const info = { byteRate: 0, channels: 0, dataBytes: 0, sampleRateHz: 0 };
  for (let offset = 12; offset + 8 <= buffer.length; ) {
    const chunkId = buffer.subarray(offset, offset + 4).toString("ascii");
    const chunkSize = buffer.readUInt32LE(offset + 4);
    const dataOffset = offset + 8;
    if (chunkId === "fmt ") {
      info.channels = buffer.readUInt16LE(dataOffset + 2);
      info.sampleRateHz = buffer.readUInt32LE(dataOffset + 4);
      info.byteRate = buffer.readUInt32LE(dataOffset + 8);
    } else if (chunkId === "data") {
      info.dataBytes = chunkSize;
    }
    offset = dataOffset + chunkSize + (chunkSize % 2);
  }
  return info;
}
