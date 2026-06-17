export const studioSections = [
  { id: "runs", label: "Runs" },
  { id: "workflow", label: "Workflow" },
  { id: "assets", label: "Assets" },
  { id: "prompts", label: "Prompts" },
];

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

export const assetGroups = [
  {
    label: "Brand And Overlay",
    count: "9 files",
    description: "Logo, watermark, banner, lower-third, popup, title card, and end screen.",
  },
  {
    label: "Thumbnails",
    count: "6 files",
    description: "Three 1280x720 templates with matching transparent text-safe overlays.",
  },
  {
    label: "Render Plates",
    count: "30 files",
    description: "Backgrounds, transitions, icons, waveforms, and intro/outro source frames.",
  },
];
