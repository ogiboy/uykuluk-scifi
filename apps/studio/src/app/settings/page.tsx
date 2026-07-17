import {
  SettingsWorkspace,
  type StudioSettingsRevisionSummary,
} from "@/components/settings/SettingsWorkspace";
import { StudioPageHeader } from "@/components/studio/StudioPageHeader";
import { StudioShell } from "@/components/studio/StudioShell";
import { normalizeStudioLocale } from "@/i18n/locales";
import { projectRoot } from "@/lib/projectRoot";
import {
  elevenLabsSmokeAudioUrl,
  readLatestElevenLabsSmoke,
} from "@/lib/providers/elevenLabsSmokeSummary";
import { getLocale } from "next-intl/server";
import { loadConfigAtProjectRoot } from "../../../../../src/config/config";
import { promptProfileDigest } from "../../../../../src/prompts/profiles/promptProfileStore";
import {
  configDigest,
  listSettingsRevisions,
} from "../../../../../src/settings/settingsRevisionStore";

export const dynamic = "force-dynamic";

/** Renders persistent Studio settings and prompt profile controls. */
export default async function SettingsPage() {
  const root = projectRoot();
  const [config, locale, revisions, latestElevenLabsSmoke] = await Promise.all([
    loadConfigAtProjectRoot(root),
    getLocale(),
    listSettingsRevisions(root),
    readLatestElevenLabsSmoke(root),
  ]);
  const studioLocale = normalizeStudioLocale(locale);
  const revisionSummaries: StudioSettingsRevisionSummary[] = revisions
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, 5)
    .map(({ changedPaths, createdAt, editor, note, restartRequired, revisionId }) => ({
      changedPaths,
      createdAt,
      editor,
      note,
      restartRequired,
      revisionId,
    }));

  return (
    <StudioShell>
      <StudioPageHeader
        badge={studioLocale === "tr" ? "Sonraki işlem için" : "For the next operation"}
        eyebrow={studioLocale === "tr" ? "Yapılandırma" : "Configuration"}
        title={
          studioLocale === "tr"
            ? "Ayarlar ve bölüm yönlendirmesi"
            : "Settings and episode direction"
        }
      />
      <SettingsWorkspace
        config={config}
        currentDigest={configDigest(config)}
        locale={studioLocale}
        latestElevenLabsSmoke={
          latestElevenLabsSmoke
            ? {
                ...latestElevenLabsSmoke,
                audioUrl:
                  latestElevenLabsSmoke.status === "succeeded"
                    ? elevenLabsSmokeAudioUrl(latestElevenLabsSmoke.operationId)
                    : null,
              }
            : null
        }
        profileDigests={Object.fromEntries(
          config.editorial.profiles.map((profile) => [profile.id, promptProfileDigest(profile)]),
        )}
        revisions={revisionSummaries}
        secretStatus={{
          bfl: Boolean(process.env.BFL_API_KEY?.trim()),
          elevenLabs: Boolean(process.env.ELEVENLABS_API_KEY?.trim()),
        }}
      />
    </StudioShell>
  );
}
