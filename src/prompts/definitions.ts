export type PromptKey = "ideas" | "script" | "production-package";

export type PromptOverrideConfigKey = "ideas" | "script" | "productionPackage";

export type PromptTemplateDefinition = {
  contractMarker: string;
  defaultPath: string;
  defaultUrl: URL;
  label: string;
  overrideConfigKey: PromptOverrideConfigKey;
};

export const PROMPT_TEMPLATE_DEFINITIONS = {
  ideas: {
    contractMarker: "IDEAS_JSON",
    defaultPath: "prompts/defaults/planner-task.md",
    defaultUrl: new URL("../../prompts/defaults/planner-task.md", import.meta.url),
    label: "Ideas",
    overrideConfigKey: "ideas",
  },
  script: {
    contractMarker: "SCRIPT_MARKDOWN",
    defaultPath: "prompts/defaults/scriptwriter-task.md",
    defaultUrl: new URL("../../prompts/defaults/scriptwriter-task.md", import.meta.url),
    label: "Script",
    overrideConfigKey: "script",
  },
  "production-package": {
    contractMarker: "PRODUCTION_PACKAGE_JSON",
    defaultPath: "prompts/defaults/production-package-task.md",
    defaultUrl: new URL("../../prompts/defaults/production-package-task.md", import.meta.url),
    label: "Production package",
    overrideConfigKey: "productionPackage",
  },
} as const satisfies Record<PromptKey, PromptTemplateDefinition>;

export const PROMPT_KEYS = Object.keys(PROMPT_TEMPLATE_DEFINITIONS) as PromptKey[];
