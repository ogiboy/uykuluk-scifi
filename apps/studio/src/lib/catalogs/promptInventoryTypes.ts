import type { PromptKey } from "../../../../../src/prompts/definitions";

export type StudioPromptStatus =
  | "config-invalid"
  | "default-empty"
  | "default-missing"
  | "default-ready"
  | "override-empty"
  | "override-invalid"
  | "override-missing"
  | "override-ready";

export type StudioPromptEntry = {
  contractMarker: string;
  defaultHash: string | null;
  defaultPath: string;
  key: PromptKey;
  label: string;
  message: string;
  mode: "default" | "override" | "unknown";
  nextAction: string;
  overridePath: string | null;
  selectedHash: string | null;
  selectedPath: string | null;
  status: StudioPromptStatus;
};

export type StudioPromptInventory = {
  checkedAt: string;
  configSource: string;
  configValid: boolean;
  passed: boolean;
  prompts: StudioPromptEntry[];
  projectRoot: string;
  warnings: string[];
};
