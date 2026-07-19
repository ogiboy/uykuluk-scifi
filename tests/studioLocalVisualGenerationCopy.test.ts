import { describe, expect, it } from "vitest";
import {
  localVisualGenerationBlocker,
  localVisualGenerationCopy,
} from "../apps/studio/src/components/runs/visual-review/localVisualGenerationCopy";
import { visualReviewCopy } from "../apps/studio/src/components/runs/visual-review/visualReviewCopy";

describe("Studio local visual generation copy", () => {
  it("explains that local generation requires readiness and never installs or downloads a model", () => {
    expect(localVisualGenerationCopy("en").readyHint).toMatch(/ready MFLUX|never downloads|setup/i);
    expect(localVisualGenerationCopy("tr").readyHint).toMatch(/hazır MFLUX|indirme|kurulum/i);
  });

  it("gives the operator a localized Settings blocker when configuration or readiness is missing", () => {
    const unavailable = {
      enabled: false,
      message: "ignored",
      mode: "static-manual",
      readiness: "absent",
    };
    expect(localVisualGenerationBlocker("en", unavailable)).toMatch(/Settings|MFLUX/);
    expect(localVisualGenerationBlocker("tr", unavailable)).toMatch(/Ayarlar|MFLUX/);

    expect(
      localVisualGenerationBlocker("tr", { ...unavailable, mode: "unknown", readiness: "unknown" }),
    ).toMatch(/ayarları okunamadı/i);
    expect(
      localVisualGenerationBlocker("en", {
        ...unavailable,
        enabled: true,
        mode: "mflux-local",
        readiness: "unknown",
      }),
    ).toMatch(/readiness could not be read/i);
  });

  it("keeps the primary visual review and revision-impact copy localized", () => {
    expect(visualReviewCopy("tr")).toMatchObject({
      panelTitle: "Sahne Görsellerini İncele",
      summaryStatus: { invalid: "geçersiz", missing: "hazırlanmadı", ready: "hazır" },
    });
    expect(visualReviewCopy("tr").activateImpact).toMatch(/onayını temizler|render kanıtını/i);
    expect(visualReviewCopy("en").confirmHosted("model", 2, "1.00")).toMatch(/2 scene.*\$1\.00/i);
  });
});
