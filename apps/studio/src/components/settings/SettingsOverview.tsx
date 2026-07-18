import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { StudioLocale } from "@/i18n/locales";
import type { StudioSettingsCopy } from "./settingsCopy";
import { Metadata, StatusLine } from "./settingsFormPrimitives";
import type { StudioSettingsRevisionSummary } from "./settingsTypes";

export function SettingsOverview({
  copy,
  locale,
  revisions,
  secretStatus,
  settingsRevision,
}: Readonly<{
  copy: StudioSettingsCopy;
  locale: StudioLocale;
  revisions: readonly StudioSettingsRevisionSummary[];
  secretStatus: Readonly<{ bfl: boolean; elevenLabs: boolean }>;
  settingsRevision: number;
}>) {
  const latestRevision = revisions.at(0);
  const lastSaved = latestRevision
    ? new Date(latestRevision.createdAt).toLocaleString(locale)
    : "—";
  const labels =
    locale === "tr"
      ? {
          lastSaved: "Son kayıt",
          ready: "Hazır",
          secretDescription: "Anahtarlar tarayıcıya veya ayar kaydına gönderilmez.",
          status: "Durum",
          version: "Sürüm",
        }
      : {
          lastSaved: "Last saved",
          ready: "Ready",
          secretDescription: "Keys never reach the browser or a settings revision.",
          status: "Status",
          version: "Version",
        };

  return (
    <section className='grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]'>
      <Card>
        <CardHeader>
          <CardTitle>{copy.currentRevision}</CardTitle>
          <CardDescription>{copy.applyNextOperation}</CardDescription>
        </CardHeader>
        <CardContent className='grid gap-3 text-sm sm:grid-cols-2'>
          <Metadata label={labels.version} value={`#${settingsRevision}`} />
          <Metadata label={labels.lastSaved} value={lastSaved} />
          {latestRevision ? <Metadata label={copy.editor} value={latestRevision.editor} /> : null}
          <Metadata label={labels.status} value={labels.ready} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{copy.secretStatus}</CardTitle>
          <CardDescription>{labels.secretDescription}</CardDescription>
        </CardHeader>
        <CardContent className='grid gap-2 text-sm'>
          <StatusLine label='ElevenLabs' configured={secretStatus.elevenLabs} copy={copy} />
          <StatusLine label='BFL' configured={secretStatus.bfl} copy={copy} />
        </CardContent>
      </Card>
    </section>
  );
}
