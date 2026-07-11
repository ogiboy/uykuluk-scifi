import { describe, expect, it } from "vitest";
import { localProviderBaseUrlSchema } from "../src/config/schema";

describe("local provider base URL configuration", () => {
  it.each([
    "https://provider.example/v1",
    "http://192.168.1.20:11434",
    "http://user:password@localhost:11434",
    "http://localhost:11434/private",
    "http://localhost:11434?token=fixture",
  ])("rejects non-loopback or non-origin provider URL %s", (value) => {
    expect(localProviderBaseUrlSchema.safeParse(value).success).toBe(false);
  });

  it.each([
    ["http://localhost:11434/", "http://localhost:11434"],
    ["http://127.0.0.1:8080", "http://127.0.0.1:8080"],
    ["http://[::1]:8080", "http://[::1]:8080"],
  ])("accepts and normalizes local provider origin %s", (value, expected) => {
    expect(localProviderBaseUrlSchema.parse(value)).toBe(expected);
  });
});
