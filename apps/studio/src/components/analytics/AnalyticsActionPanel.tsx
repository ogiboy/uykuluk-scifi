"use client";

import { StudioMutationResultPanel } from "@/components/studio/StudioMutationResultPanel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useStudioGuardedActionSubmit } from "@/lib/useStudioGuardedActionSubmit";
import type { ChangeEvent } from "react";
import { useState } from "react";
import { AnalyticsReportActionPanel } from "./AnalyticsReportActionPanel";

type AnalyticsFormat = "csv" | "json";

const csvTemplate =
  "run_id,video_id,title,published_at,impressions,views,ctr,avg_view_duration_seconds,avg_percentage_viewed,subscribers_gained,likes,comments,notes\n";

/**
 * Renders guarded local analytics import and report-refresh controls.
 */
export function AnalyticsActionPanel() {
  const [content, setContent] = useState(csvTemplate);
  const [format, setFormat] = useState<AnalyticsFormat>("csv");
  const [sourceFileName, setSourceFileName] = useState("performance.csv");
  const { state, submit } = useStudioGuardedActionSubmit(
    "Import operator-provided analytics CSV/JSON, or refresh the report from saved local data.",
  );

  async function loadSelectedFile(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    setSourceFileName(file.name);
    setFormat(file.name.toLowerCase().endsWith(".json") ? "json" : "csv");
    setContent(await file.text());
  }

  async function submitImport(event: { preventDefault(): void }): Promise<void> {
    event.preventDefault();
    await submit({
      actionId: "analytics.import",
      body: { content, format, sourceFileName },
      errorToastTitle: "Analytics import was blocked",
      fallbackError: "Analytics import could not complete.",
      routePath: "/actions/analytics-import",
      submittingMessage: "Importing manual analytics...",
      successMessage: "Analytics imported. Studio is refreshing the local analytics overview.",
      successToastTitle: "Analytics imported",
    });
  }

  const ready =
    content.trim().length > 0 && sourceFileName.trim().length > 0 && state.kind !== "submitting";

  return (
    <section aria-labelledby='analytics-import-heading'>
      <Card>
        <CardHeader>
          <p className='text-muted-foreground text-sm'>Local feedback loop</p>
          <CardTitle>
            <h2 id='analytics-import-heading'>Import Manual Analytics</h2>
          </CardTitle>
          <CardDescription>
            Paste or load an operator-provided CSV/JSON export. Studio writes only ignored local
            analytics artifacts through the producer CLI; it does not call YouTube APIs.
          </CardDescription>
        </CardHeader>
        <CardContent className='grid gap-4'>
          <form className='grid gap-3' onSubmit={submitImport}>
            <label className='text-muted-foreground grid gap-1.5 text-sm'>
              Source file name
              <Input
                maxLength={120}
                minLength={1}
                required
                value={sourceFileName}
                onChange={(event) => setSourceFileName(event.target.value)}
              />
            </label>
            <label className='text-muted-foreground grid gap-1.5 text-sm'>
              Format
              <Select value={format} onValueChange={(value) => setFormat(value as AnalyticsFormat)}>
                <SelectTrigger aria-label='Analytics import format'>
                  <SelectValue placeholder='Choose format' />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value='csv'>CSV</SelectItem>
                    <SelectItem value='json'>JSON</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </label>
            <label className='text-muted-foreground grid gap-1.5 text-sm'>
              Load local file into the browser
              <Input
                accept='.csv,.json,text/csv,application/json'
                type='file'
                onChange={loadSelectedFile}
              />
            </label>
            <label className='text-muted-foreground grid gap-1.5 text-sm'>
              Analytics content
              <Textarea
                className='resize-y'
                maxLength={1_000_000}
                minLength={1}
                required
                rows={10}
                value={content}
                onChange={(event) => setContent(event.target.value)}
              />
            </label>
            <div className='flex flex-wrap gap-2'>
              <Button disabled={!ready} type='submit'>
                {state.kind === "submitting" ? "Working..." : "Import analytics"}
              </Button>
              <AnalyticsReportActionPanel showResult={false} />
            </div>
          </form>
          {state.kind !== "idle" ? <StudioMutationResultPanel state={state} /> : null}
        </CardContent>
      </Card>
    </section>
  );
}
