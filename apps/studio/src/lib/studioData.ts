export const studioSections = [
  { id: "runs", label: "Runs", href: "/runs" },
  { id: "workflow", label: "Workflow" },
  { id: "doctor", label: "Doctor", href: "/doctor" },
  { id: "eval", label: "Model Eval", href: "/eval" },
  { id: "actions", label: "Actions" },
  { id: "assets", label: "Assets", href: "/assets" },
  { id: "analytics", label: "Analytics", href: "/analytics" },
  { id: "prompts", label: "Prompts", href: "/prompts" },
] as const satisfies ReadonlyArray<{
  href?: "/analytics" | "/assets" | "/doctor" | "/eval" | "/prompts" | "/runs";
  id: string;
  label: string;
}>;

export const statusCards = [
  {
    label: "Workflow Source",
    value: "CLI/Core",
    detail: "Studio must call typed service contracts instead of owning workflow state.",
  },
  {
    label: "Generation Mode",
    value: "Mock-first",
    detail: "Local tests and dry runs do not require paid APIs or live providers.",
  },
  {
    label: "Approvals",
    value: "Manual",
    detail: "Idea and script approvals are explicit ledger events.",
  },
  {
    label: "Publish Path",
    value: "Blocked",
    detail: "Upload and public/scheduled publish remain disabled by default.",
    tone: "blocked",
  },
];

export const commandGroups = [
  {
    title: "Start A Run",
    command: "pnpm producer ideas",
    description: "Generate reviewable episode ideas under a persisted run directory.",
  },
  {
    title: "Approve Script",
    command: "pnpm producer approve script --run <run_id>",
    description: "Move only the visible reviewed script into packaging.",
  },
  {
    title: "Evidence",
    command: "pnpm producer evidence --run <run_id>",
    description: "Write the operator-readable evidence bundle for QA and review.",
  },
];
