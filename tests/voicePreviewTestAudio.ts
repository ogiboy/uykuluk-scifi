/**
 * Creates a deterministic playable MP3 audio fixture.
 *
 * @returns An 834-byte `Buffer` containing MP3 audio data.
 */
export function playableMp3Bytes(): Buffer {
  const audio = Buffer.alloc(834);
  audio.set([0xff, 0xfb, 0x90, 0x64], 0);
  audio.set([0xff, 0xfb, 0x90, 0x64], 417);
  return audio;
}

/**
 * Creates a deterministic playable MP3 audio fixture.
 *
 * @returns The MP3 audio data as a `Uint8Array`
 */
export function playableMp3Body(): Uint8Array<ArrayBuffer> {
  const audio = new Uint8Array(834);
  audio.set([0xff, 0xfb, 0x90, 0x64], 0);
  audio.set([0xff, 0xfb, 0x90, 0x64], 417);
  return audio;
}

/**
 * Creates a deterministic PCM WAV audio fixture.
 *
 * @returns A `Buffer` containing a WAV file with 8,820 bytes of audio data.
 */
export function playableWavBytes(): Buffer {
  const dataBytes = 8_820;
  const audio = Buffer.alloc(44 + dataBytes);
  audio.write("RIFF", 0, "ascii");
  audio.writeUInt32LE(audio.byteLength - 8, 4);
  audio.write("WAVE", 8, "ascii");
  audio.write("fmt ", 12, "ascii");
  audio.writeUInt32LE(16, 16);
  audio.writeUInt16LE(1, 20);
  audio.writeUInt16LE(1, 22);
  audio.writeUInt32LE(44_100, 24);
  audio.writeUInt32LE(88_200, 28);
  audio.writeUInt16LE(2, 32);
  audio.writeUInt16LE(16, 34);
  audio.write("data", 36, "ascii");
  audio.writeUInt32LE(dataBytes, 40);
  return audio;
}

/**
 * Creates a WAV audio fixture with an intentionally short data section.
 *
 * @returns A WAV-format `Buffer` containing 84 bytes of audio data
 */
export function tooShortWavBytes(): Buffer {
  const dataBytes = 84;
  const audio = Buffer.alloc(44 + dataBytes);
  audio.write("RIFF", 0, "ascii");
  audio.writeUInt32LE(audio.byteLength - 8, 4);
  audio.write("WAVE", 8, "ascii");
  audio.write("fmt ", 12, "ascii");
  audio.writeUInt32LE(16, 16);
  audio.writeUInt16LE(1, 20);
  audio.writeUInt16LE(1, 22);
  audio.writeUInt32LE(44_100, 24);
  audio.writeUInt32LE(88_200, 28);
  audio.writeUInt16LE(2, 32);
  audio.writeUInt16LE(16, 34);
  audio.write("data", 36, "ascii");
  audio.writeUInt32LE(dataBytes, 40);
  return audio;
}
