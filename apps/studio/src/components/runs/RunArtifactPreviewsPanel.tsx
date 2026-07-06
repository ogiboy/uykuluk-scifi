"use client";

import type { StudioArtifactPreview } from "@/lib/artifactPreviews";
import {
  artifactPreviewEmptyState,
  artifactPreviewStatusFilters,
  countArtifactPreviewStatuses,
  filterArtifactPreviews,
  type ArtifactPreviewStatusFilter,
} from "@/lib/artifactPreviewFilters";
import { buildArtifactReviewHandoff } from "@/lib/artifactReviewHandoff";
import { artifactPreviewsIntro } from "@/lib/runEvidenceCopy";
import type { StudioRunDetail } from "@/lib/runSummaries";
import { applyEnumSelectValue } from "@/lib/utils";
import { useMemo, useState } from "react";
import { RunDetailCard } from "./RunDetailCard";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { RunArtifactPreviewGroups } from "./RunArtifactPreviewGroups";

type RunArtifactPreviewsPanelProps = Readonly<{
  artifacts: StudioRunDetail["artifacts"];
  evidenceStatus: StudioRunDetail["evidenceStatus"];
}>;

/**
 * Renders read-only artifact previews grouped by operator review phase.
 *
 * @param artifacts - The artifact preview metadata to display.
 * @param evidenceStatus - The current evidence status used for operator copy.
 */
export function RunArtifactPreviewsPanel({
  artifacts,
  evidenceStatus,
}: RunArtifactPreviewsPanelProps) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<ArtifactPreviewStatusFilter>("all");
  const counts = useMemo(() => countArtifactPreviewStatuses(artifacts), [artifacts]);
  const filteredArtifacts = useMemo(
    () => filterArtifactPreviews(artifacts, { query, status }),
    [artifacts, query, status],
  );
  const artifactGroups = groupedArtifactPreviews(filteredArtifacts);
  const emptyState = artifactPreviewEmptyState(artifacts.length, filteredArtifacts.length);
  const reviewHandoff = buildArtifactReviewHandoff(artifacts);
  const filtersAreCustomized = query.trim() !== "" || status !== "all";

  function resetPreviewFilters() {
    setQuery("");
    setStatus("all");
  }

  return (
    <RunDetailCard
      headingId='artifact-heading'
      title='Artifact Previews'
      description='Read-only excerpts grouped by operator review phase. Use Studio action rails when available, with CLI/core fallback for recovery.'
    >
      <p className='text-sm text-muted-foreground'>{artifactPreviewsIntro(evidenceStatus)}</p>
      <div
        className='grid gap-3 rounded-lg bg-muted/20 p-3 ring-1 ring-border/10 md:grid-cols-[minmax(0,1fr)_minmax(12rem,15rem)_auto] md:items-end'
        aria-label='Artifact preview filters'
      >
        <label className='grid min-w-0 gap-2 text-xs font-semibold text-muted-foreground'>
          Search artifacts
          <Input
            placeholder='path, label, phase, review action'
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <div className='grid min-w-0 gap-2'>
          <Label htmlFor='artifact-status-filter'>Availability</Label>
          <Select
            value={status}
            onValueChange={(value) =>
              applyEnumSelectValue(value, artifactPreviewStatusFilters, setStatus)
            }
          >
            <SelectTrigger id='artifact-status-filter' aria-label='Filter artifacts by status'>
              <SelectValue placeholder='Availability' />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {artifactPreviewStatusFilters.map((value) => (
                  <SelectItem key={value} value={value}>
                    {artifactStatusLabel(value)} ({counts[value]})
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <Button
          disabled={!filtersAreCustomized}
          onClick={resetPreviewFilters}
          type='button'
          variant='secondary'
        >
          Reset artifacts
        </Button>
        <output
          className='flex flex-wrap gap-2 md:col-span-3'
          aria-label='Artifact preview result summary'
        >
          <Badge variant='secondary'>{filteredArtifacts.length} shown</Badge>
          <Badge variant='outline'>{counts.available} available</Badge>
          {counts.missing > 0 ? <Badge variant='outline'>{counts.missing} missing</Badge> : null}
        </output>
      </div>
      <section
        className='grid gap-3 rounded-lg bg-muted/20 p-3 ring-1 ring-border/10'
        aria-label='Artifact review handoff milestones'
      >
        <div className='flex flex-wrap items-start justify-between gap-3'>
          <div>
            <h3 className='text-sm font-semibold'>Review handoff path</h3>
            <p className='mt-1 text-sm text-muted-foreground'>
              {reviewHandoff.availableCount}/{reviewHandoff.totalCount} review milestones are
              available as local artifacts.
            </p>
          </div>
          {reviewHandoff.nextFocus ? (
            <Badge variant='outline'>next: {reviewHandoff.nextFocus.label}</Badge>
          ) : (
            <Badge variant='secondary'>all review docs available</Badge>
          )}
        </div>
        <ol className='grid gap-2 md:grid-cols-2'>
          {reviewHandoff.milestones.map((milestone) => (
            <li
              className='grid gap-1 rounded-lg bg-background/70 p-3 ring-1 ring-border/10'
              key={milestone.path}
            >
              <Badge
                className='justify-self-start'
                variant={milestone.available ? "secondary" : "outline"}
              >
                {milestone.available ? "available" : "pending"}
              </Badge>
              <strong className='text-sm'>{milestone.label}</strong>
              <small className='break-all text-xs text-muted-foreground'>{milestone.path}</small>
            </li>
          ))}
        </ol>
      </section>
      {filteredArtifacts.length === 0 ? (
        <section
          className='rounded-lg bg-muted/20 p-4 ring-1 ring-border/10'
          aria-labelledby='artifact-preview-empty-heading'
        >
          <h3 id='artifact-preview-empty-heading' className='text-sm font-semibold'>
            {emptyState.heading}
          </h3>
          <p className='mt-1 text-sm text-muted-foreground'>{emptyState.message}</p>
        </section>
      ) : (
        <RunArtifactPreviewGroups artifactGroups={artifactGroups} />
      )}
    </RunDetailCard>
  );
}

/**
 * Groups artifact previews by group label.
 *
 * @param artifacts - The artifact previews to group.
 * @returns The grouped artifact previews, ordered by first occurrence of each group.
 */
function groupedArtifactPreviews(
  artifacts: StudioArtifactPreview[],
): Array<{ artifacts: StudioArtifactPreview[]; label: string }> {
  const groups = new Map<string, StudioArtifactPreview[]>();
  for (const artifact of artifacts) {
    groups.set(artifact.group, [...(groups.get(artifact.group) ?? []), artifact]);
  }
  return [...groups.entries()].map(([label, groupedArtifacts]) => ({
    artifacts: groupedArtifacts,
    label,
  }));
}

function artifactStatusLabel(status: ArtifactPreviewStatusFilter): string {
  switch (status) {
    case "all":
      return "All";
    case "available":
      return "Available";
    case "missing":
      return "Missing";
  }
}
