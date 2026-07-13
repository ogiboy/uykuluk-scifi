import { describe, expect, it } from "vitest";
import { downloadElevenLabsPreview } from "../src/stages/voice/providers/elevenLabsPreviewDownload";
import {
  playableMp3Body,
  playableMp3Bytes,
  playableWavBytes,
  tooShortWavBytes,
} from "./voicePreviewTestAudio";

const publicPreview =
  "https://storage.googleapis.com/eleven-public-prod/test-preview.mp3?token=not-persisted";

describe("ElevenLabs preview download boundary", () => {
  it("accepts MP3 magic bytes even when provider content type is text/plain", async () => {
    const result = await downloadElevenLabsPreview(
      publicPreview,
      "eleven-public-prod",
      fetchResponse(
        new Response(playableMp3Body(), {
          headers: { "content-type": "text/plain", "request-id": "raw-request-id" },
        }),
      ),
    );

    expect(result).toMatchObject({ format: "mp3", requestId: "raw-request-id" });
    expect(result.audio).toEqual(playableMp3Bytes());
  });

  it("accepts complete WAV structure and rejects truncated MP3 or inaudibly short WAV data", async () => {
    await expect(
      downloadElevenLabsPreview(
        publicPreview,
        "eleven-public-prod",
        fetchResponse(new Response(new Uint8Array(playableWavBytes()))),
      ),
    ).resolves.toMatchObject({ format: "wav" });

    const truncatedMp3 = playableMp3Bytes().subarray(0, 500);
    await expect(
      downloadElevenLabsPreview(
        publicPreview,
        "eleven-public-prod",
        fetchResponse(new Response(new Uint8Array(truncatedMp3))),
      ),
    ).rejects.toThrow("not recognized MP3 or WAV");

    await expect(
      downloadElevenLabsPreview(
        publicPreview,
        "eleven-public-prod",
        fetchResponse(new Response(new Uint8Array(tooShortWavBytes()))),
      ),
    ).rejects.toThrow("not recognized MP3 or WAV");
  });

  it("rejects redirects, host-class mismatches, oversized bodies, and invalid magic", async () => {
    await expect(
      downloadElevenLabsPreview(
        publicPreview,
        "eleven-public-prod",
        fetchResponse(
          new Response(null, { status: 302, headers: { location: "https://evil.test" } }),
        ),
      ),
    ).rejects.toThrow("redirects are not allowed");

    await expect(
      downloadElevenLabsPreview(
        "https://example.com/not-allowed.mp3",
        "eleven-public-prod",
        fetchResponse(new Response(playableMp3Body())),
      ),
    ).rejects.toThrow("host does not match");

    await expect(
      downloadElevenLabsPreview(
        publicPreview,
        "eleven-public-prod",
        fetchResponse(
          new Response(playableMp3Body(), {
            headers: { "content-length": String(5 * 1024 * 1024 + 1) },
          }),
        ),
      ),
    ).rejects.toThrow("maximum allowed size");

    await expect(
      downloadElevenLabsPreview(
        publicPreview,
        "eleven-public-prod",
        fetchResponse(new Response(new Uint8Array(256))),
      ),
    ).rejects.toThrow("not recognized MP3 or WAV");

    await expect(
      downloadElevenLabsPreview(
        publicPreview,
        "eleven-public-prod",
        fetchResponse(new Response(new Uint8Array([0xff, 0xfb, 0x90, 0x64]))),
      ),
    ).rejects.toThrow("too short");
  });

  it("enforces the streamed byte limit when content-length is absent", async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(3 * 1024 * 1024));
        controller.enqueue(new Uint8Array(3 * 1024 * 1024));
        controller.close();
      },
    });

    await expect(
      downloadElevenLabsPreview(
        publicPreview,
        "eleven-public-prod",
        fetchResponse(new Response(body)),
      ),
    ).rejects.toThrow("maximum allowed size");
  });
});

function fetchResponse(response: Response): typeof fetch {
  return (async () => response) as typeof fetch;
}
