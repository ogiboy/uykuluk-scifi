import type { StudioLocale } from "@/i18n/locales";
import type { ProducerConfig } from "../../../../../src/config/schema";
import type { ProviderSmokeEvidence } from "../../../../../src/stages/providers/providerSmokeEvidence";

export type StudioSettingsRevisionSummary = Readonly<{
  changedPaths: readonly string[];
  createdAt: string;
  editor: string;
  note: string;
  restartRequired: boolean;
  revisionId: string;
}>;

export type SettingsWorkspaceProps = Readonly<{
  config: ProducerConfig;
  currentDigest: string;
  latestElevenLabsSmoke: (ProviderSmokeEvidence & { audioUrl: string | null }) | null;
  locale: StudioLocale;
  profileDigests: Readonly<Record<string, string>>;
  revisions: readonly StudioSettingsRevisionSummary[];
  secretStatus: Readonly<{ bfl: boolean; elevenLabs: boolean }>;
}>;

export type DraftUpdater = (updater: (current: ProducerConfig) => ProducerConfig) => void;
