import type { ProducerConfig } from "../../../../src/config/schema";

export type ConfiguredAssetDirectory = keyof ProducerConfig["assets"];
export type StudioAssetConfig = ProducerConfig["assets"];

export const DEFAULT_ASSET_CONFIG: StudioAssetConfig = {
  brandDir: "assets/brand",
  introDir: "assets/intro",
  outroDir: "assets/outro",
  overlayDir: "assets/overlays",
};

export type AssetCategoryDefinition = {
  description: string;
  directory: string | ConfiguredAssetDirectory;
  guardedWarningPattern?: RegExp;
  id: string;
  label: string;
  requiredFor: string;
};

export const ASSET_CATEGORY_DEFINITIONS = [
  {
    description: "Channel logo, watermark, banner, and corner logo bug.",
    directory: "brandDir",
    guardedWarningPattern: /brand|logo|watermark/i,
    id: "brand",
    label: "Brand",
    requiredFor: "Watermarking, channel identity, and render-plan provenance.",
  },
  {
    description: "Subtitle panels, lower-third banner, name panel, and popup card.",
    directory: "overlayDir",
    guardedWarningPattern: /overlay|subtitle|lower|third|panel/i,
    id: "overlays",
    label: "Overlays",
    requiredFor: "Subtitle, lower-third, popup, and information-card overlays.",
  },
  {
    description: "Episode title card and source frames for the opening bookend.",
    directory: "introDir",
    guardedWarningPattern: /intro/i,
    id: "intro",
    label: "Intro",
    requiredFor: "Draft-render opening bookend and episode title card.",
  },
  {
    description: "YouTube end screen and source frames for the closing bookend.",
    directory: "outroDir",
    guardedWarningPattern: /outro/i,
    id: "outro",
    label: "Outro",
    requiredFor: "Draft-render closing bookend and future private-upload review.",
  },
  {
    description: "Sci-fi background plates selected by render planning.",
    directory: "assets/backgrounds",
    id: "backgrounds",
    label: "Background Plates",
    requiredFor: "Scene-to-asset mapping in render plans.",
  },
  {
    description: "Popup icons for facts, warnings, planets, signals, and telescope notes.",
    directory: "assets/icons",
    id: "icons",
    label: "Popup Icons",
    requiredFor: "Future popup cards and contact-sheet refinements.",
  },
  {
    description: "Transparent glitch, no-signal, and scan transition overlays.",
    directory: "assets/transitions",
    id: "transitions",
    label: "Transitions",
    requiredFor: "Future visual polish for deterministic local renders.",
  },
  {
    description: "Transparent waveform panels for narration-driven render scenes.",
    directory: "assets/waveforms",
    id: "waveforms",
    label: "Waveforms",
    requiredFor: "Voiceover-driven render review overlays.",
  },
  {
    description: "Thumbnail templates and matching transparent text-safe overlays.",
    directory: "assets/thumbnails",
    id: "thumbnails",
    label: "Thumbnails",
    requiredFor: "Future YouTube package review and metadata workflows.",
  },
] as const satisfies readonly AssetCategoryDefinition[];

export type StudioAssetCategoryStatus = "empty" | "needs-action" | "ready";

export type StudioAssetCategory = {
  description: string;
  directory: string;
  files: string[];
  guarded: boolean;
  id: string;
  label: string;
  requiredFor: string;
  status: StudioAssetCategoryStatus;
  warnings: string[];
};

export type StudioAssetInventory = {
  categories: StudioAssetCategory[];
  checkedAt: string;
  configSource: string;
  configValid: boolean;
  passed: boolean;
  projectRoot: string;
  totalFiles: number;
  warnings: string[];
};
