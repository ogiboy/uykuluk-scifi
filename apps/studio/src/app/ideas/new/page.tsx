import { EpisodeBriefComposer } from "@/components/episodes/EpisodeBriefComposer";
import { StudioPageHeader } from "@/components/studio/StudioPageHeader";
import { StudioShell } from "@/components/studio/StudioShell";
import { normalizeStudioLocale } from "@/i18n/locales";
import { projectRoot } from "@/lib/projectRoot";
import { getLocale } from "next-intl/server";
import { loadConfigAtProjectRoot } from "../../../../../../src/config/config";
import { promptProfileDigest } from "../../../../../../src/prompts/profiles/promptProfileStore";
import { configDigest } from "../../../../../../src/settings/settingsRevisionStore";

export const dynamic = "force-dynamic";

/** Renders the Studio-first entry point for a new episode idea operation. */
export default async function NewIdeaPage() {
  const [config, locale] = await Promise.all([loadConfigAtProjectRoot(projectRoot()), getLocale()]);
  const studioLocale = normalizeStudioLocale(locale);

  return (
    <StudioShell>
      <StudioPageHeader
        badge={studioLocale === "tr" ? "Bölüm başlangıcı" : "Episode start"}
        eyebrow={studioLocale === "tr" ? "Yeni üretim" : "New production"}
        title={studioLocale === "tr" ? "Fikir oluştur" : "Create ideas"}
      />
      <EpisodeBriefComposer
        currentSettingsDigest={configDigest(config)}
        locale={studioLocale}
        profileDigests={Object.fromEntries(
          config.editorial.profiles.map((profile) => [profile.id, promptProfileDigest(profile)]),
        )}
        profiles={config.editorial.profiles}
      />
    </StudioShell>
  );
}
