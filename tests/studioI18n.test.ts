import { describe, expect, it } from "vitest";

import { normalizeStudioLocale } from "../apps/studio/src/i18n/locales";

describe("Studio locale normalization", () => {
  it("uses English when no supported locale is available", () => {
    expect(normalizeStudioLocale(undefined)).toBe("en");
    expect(normalizeStudioLocale("de")).toBe("en");
  });

  it("normalizes Turkish locale variants", () => {
    expect(normalizeStudioLocale("tr")).toBe("tr");
    expect(normalizeStudioLocale("tr-TR")).toBe("tr");
  });
});
