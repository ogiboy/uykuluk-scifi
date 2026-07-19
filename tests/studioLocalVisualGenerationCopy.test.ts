import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  localVisualGenerationBlocker,
  localVisualGenerationCopy,
} from "../apps/studio/src/components/runs/visual-review/localVisualGenerationCopy";
import { visualReviewCopy } from "../apps/studio/src/components/runs/visual-review/visualReviewCopy";
import { visualProviderLabel } from "../apps/studio/src/components/runs/visual-review/visualRevisionGalleryCopy";
import { unavailableStudioLocalModelOverview } from "../apps/studio/src/lib/localModels/localModelOverview";

describe("Studio local visual generation copy", () => {
  it("keeps Settings usable with an explicit failed overview when readiness records are invalid", () => {
    const root = path.join("tmp", "uykulukscifi");

    expect(unavailableStudioLocalModelOverview(root)).toMatchObject({
      readiness: "failed",
      recoveryAvailable: false,
      readError: expect.stringMatching(/could not be read safely/i),
      runtimePath: path.resolve(root, ".local-models", "mflux"),
      modelPath: path.resolve(root, "models", "visual", "mflux", "flux2-klein-4b-q4"),
    });
  });

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
    expect(visualReviewCopy("tr").latestActionTitle).toBe("Son görsel eylemi");
    expect(visualReviewCopy("tr").hostedStatusLabel("pending")).toBe("bekliyor");
    expect(visualReviewCopy("tr").hostedStatusLabel("future-status")).toBe("future-status");
    expect(visualReviewCopy("tr").hostedPurposeLabel("regenerate-rejected", "fallback")).toMatch(
      /reddedilenleri/i,
    );
    expect(visualReviewCopy("tr").visualActionStatusLabel("success")).toBe("başarılı");
  });

  it("uses one localized provider label mapping across visual review surfaces", () => {
    expect(visualProviderLabel("tr", "static")).toBe("Statik yedek");
    expect(visualProviderLabel("tr", "manual-import")).toBe("Manuel içe aktarma");
    expect(visualProviderLabel("tr", "mflux-local")).toBe("Yerel MFLUX");
    expect(visualProviderLabel("en", "black-forest-labs")).toBe("Black Forest Labs");
    expect(visualProviderLabel("en", "custom-provider")).toBe("custom-provider");
  });
});
