import type { StudioLocale } from "@/i18n/locales";

type StudioSectionHref =
  | "/"
  | "/actions"
  | "/analytics"
  | "/assets"
  | "/doctor"
  | "/eval"
  | "/prompts"
  | "/runs"
  | "/settings";

export type StudioSection = Readonly<{ href: StudioSectionHref; id: string; label: string }>;

const primarySectionDefinitions = [
  { id: "dashboard", href: "/", en: "Dashboard", tr: "Kontrol Paneli" },
  { id: "episodes", href: "/runs", en: "Episodes", tr: "Bölümler" },
  { id: "library", href: "/assets", en: "Library", tr: "Kütüphane" },
  { id: "analytics", href: "/analytics", en: "Analytics", tr: "Analitik" },
  { id: "settings", href: "/settings", en: "Settings", tr: "Ayarlar" },
] as const;

const advancedSectionDefinitions = [
  { id: "doctor", href: "/doctor", en: "Doctor", tr: "Sistem Kontrolü" },
  { id: "eval", href: "/eval", en: "Model Lab", tr: "Model Laboratuvarı" },
  { id: "actions", href: "/actions", en: "Actions", tr: "İşlemler" },
  { id: "prompts", href: "/prompts", en: "Prompt Inventory", tr: "Prompt Envanteri" },
] as const;

export const studioSections = sectionsForLocale(primarySectionDefinitions, "en");
export const advancedStudioSections = sectionsForLocale(advancedSectionDefinitions, "en");

export function studioSectionsForLocale(locale: StudioLocale): readonly StudioSection[] {
  return sectionsForLocale(primarySectionDefinitions, locale);
}

export function advancedStudioSectionsForLocale(locale: StudioLocale): readonly StudioSection[] {
  return sectionsForLocale(advancedSectionDefinitions, locale);
}

function sectionsForLocale<
  T extends readonly Readonly<{ en: string; href: StudioSectionHref; id: string; tr: string }>[],
>(definitions: T, locale: StudioLocale): readonly StudioSection[] {
  return definitions.map((section) => ({
    href: section.href,
    id: section.id,
    label: section[locale],
  }));
}

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
