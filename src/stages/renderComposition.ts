import { AssetRef, RenderPlan } from "./renderPlanSchemas.js";

export type DraftRenderOverlay = {
  asset: AssetRef;
  placement: string;
  width: number;
  x: string;
  y: string;
};

export type DraftRenderComposition = {
  overlays: DraftRenderOverlay[];
  reviewChecklist: string[];
};

export function buildDraftRenderComposition(renderPlan: RenderPlan): DraftRenderComposition {
  const overlays = overlaySpecs.flatMap((spec) => {
    const asset = findFirstOverlayAsset(renderPlan, spec.role);
    return asset
      ? [
          {
            asset,
            placement: spec.placement,
            width: spec.width,
            x: spec.x,
            y: spec.y,
          },
        ]
      : [];
  });
  return {
    overlays,
    reviewChecklist: [
      ...bookendChecklist(renderPlan),
      "Confirm subtitles remain readable over lower-third and waveform overlays.",
      "Confirm popup-card placement does not hide critical visual details.",
      "Confirm watermark is visible without distracting from the scene.",
      "Confirm scene timing, overlays, and voiceover are acceptable before any private upload review.",
    ],
  };
}

function bookendChecklist(renderPlan: RenderPlan): string[] {
  if (!renderPlan.bookends) {
    return [];
  }
  return [
    "Confirm intro title card and outro end screen timing are acceptable in the local draft render.",
  ];
}

function findFirstOverlayAsset(renderPlan: RenderPlan, role: string): AssetRef | undefined {
  for (const scene of renderPlan.scenes) {
    const asset = scene.overlayAssets.find((overlay) => overlay.role === role);
    if (asset) {
      return asset;
    }
  }
  return undefined;
}

const overlaySpecs = [
  {
    role: "lower-third",
    placement: "bottom-lower-third",
    width: 1280,
    x: "0",
    y: "H-h",
  },
  {
    role: "waveform-overlay",
    placement: "bottom-waveform",
    width: 1280,
    x: "0",
    y: "H-h-250",
  },
  {
    role: "popup-card",
    placement: "right-info-card",
    width: 360,
    x: "W-w-48",
    y: "96",
  },
  {
    role: "watermark",
    placement: "top-right-watermark",
    width: 120,
    x: "W-w-24",
    y: "24",
  },
] as const;
