import { describe, expect, it } from "vitest";

import { normalizeStudioLocale } from "../apps/studio/src/i18n/locales";

describe("Studio locale normalization", () => {
  it("uses Turkish when no supported locale is available", () => {
    expect(normalizeStudioLocale(undefined)).toBe("tr");
    expect(normalizeStudioLocale("de")).toBe("tr");
  });

  it("normalizes Turkish locale variants", () => {
    expect(normalizeStudioLocale("tr")).toBe("tr");
    expect(normalizeStudioLocale("tr-TR")).toBe("tr");
  });

  it("preserves explicit English locale variants", () => {
    expect(normalizeStudioLocale("en")).toBe("en");
    expect(normalizeStudioLocale("en-US")).toBe("en");
  });
});
