import { describe, expect, it } from "vitest";
import { defaultConfig } from "../src/config/config";
import { producerConfigSchema } from "../src/config/schema";

describe("Studio settings config", () => {
  it("hydrates legacy configs with Turkish Studio defaults", () => {
    const {
      editorial: _editorial,
      schemaVersion: _schemaVersion,
      settingsRevision: _settingsRevision,
      studio: _studio,
      ...legacy
    } = defaultConfig;

    const parsed = producerConfigSchema.parse(legacy);

    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.settingsRevision).toBe(0);
    expect(parsed.studio).toEqual({ locale: "tr", port: 3_000, theme: "system" });
    expect(parsed.editorial.activeProfileId).toBe("sci-fi");
    expect(parsed.editorial.profiles).toHaveLength(5);
  });

  it("rejects listener ports that cannot be used by the local Studio launcher", () => {
    expect(() =>
      producerConfigSchema.parse({
        ...defaultConfig,
        studio: { ...defaultConfig.studio, port: 1_023 },
      }),
    ).toThrow();
  });
});
