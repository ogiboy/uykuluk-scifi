import { runQueueCopy } from "@/components/runs/runQueueCopy";
import { RunQueueExplorer } from "@/components/runs/RunQueueExplorer";
import { StudioCommandPalette } from "@/components/studio/StudioCommandPalette";
import { StudioPageHeader } from "@/components/studio/StudioPageHeader";
import { StudioShell } from "@/components/studio/StudioShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { normalizeStudioLocale } from "@/i18n/locales";
import { listStudioRuns } from "@/lib/runSummaries";
import { getLocale } from "next-intl/server";
import Link from "next/link";

export default async function RunsPage() {
  const [runs, locale] = await Promise.all([listStudioRuns(), getLocale()]);
  const studioLocale = normalizeStudioLocale(locale);
  const copy = runQueueCopy(studioLocale);

  return (
    <StudioShell>
      <StudioPageHeader
        actions={
          <>
            <Button asChild>
              <Link href='/ideas/new'>{copy.createEpisode}</Link>
            </Button>
            <StudioCommandPalette runs={runs} />
            <Badge variant='secondary'>{copy.localCoreVerified}</Badge>
          </>
        }
        eyebrow={studioLocale === "tr" ? "Üretim bölümleri" : "Production episodes"}
        title={copy.title}
      />
      <RunQueueExplorer locale={studioLocale} runs={runs} />
    </StudioShell>
  );
}
