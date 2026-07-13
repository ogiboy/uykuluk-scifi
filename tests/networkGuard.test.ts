import net from "node:net";
import { describe, expect, it } from "vitest";

describe("test network guard", () => {
  it("blocks external fetch and socket connections before they leave the process", async () => {
    await expect(fetch("https://api.elevenlabs.io/v1/voices")).rejects.toThrow(
      /outbound network is disabled/i,
    );
    expect(() => new net.Socket().connect({ host: "api.elevenlabs.io", port: 443 })).toThrow(
      /outbound network is disabled/i,
    );
  });
});
