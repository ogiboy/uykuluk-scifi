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
import { useMemo, useState } from "react";
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
    <section className='panel' aria-labelledby='artifact-heading'>
      <h2 id='artifact-heading'>Artifact Previews</h2>
      <p>
        Read-only excerpts grouped by operator review phase. Use CLI commands to change workflow
        state.
      </p>
      <p>{artifactPreviewsIntro(evidenceStatus)}</p>
      <div className='artifact-preview-toolbar' aria-label='Artifact preview filters'>
        <label className='artifact-preview-search'>
          Search artifacts
          <Input
            placeholder='path, label, phase, review action'
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <div className='artifact-preview-select'>
          <Label htmlFor='artifact-status-filter'>Availability</Label>
          <Select value={status} onValueChange={(value) => setSelectedStatus(value, setStatus)}>
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
        <output className='artifact-preview-counts' aria-label='Artifact preview result summary'>
          <Badge variant='secondary'>{filteredArtifacts.length} shown</Badge>
          <Badge variant='outline'>{counts.available} available</Badge>
          {counts.missing > 0 ? <Badge variant='outline'>{counts.missing} missing</Badge> : null}
        </output>
      </div>
      <section className='artifact-review-handoff' aria-label='Artifact review handoff milestones'>
        <div className='artifact-review-handoff-heading'>
          <div>
            <h3>Review handoff path</h3>
            <p>
              {reviewHandoff.availableCount}/{reviewHandoff.totalCount} review milestones are
              available as local artifacts.
            </p>
          </div>
          {reviewHandoff.nextFocus ? (
            <span className='status-pill small pending'>next: {reviewHandoff.nextFocus.label}</span>
          ) : (
            <span className='status-pill small done'>all review docs available</span>
          )}
        </div>
        <ol className='artifact-review-milestones'>
          {reviewHandoff.milestones.map((milestone) => (
            <li key={milestone.path}>
              <span
                className={
                  milestone.available ? "status-pill small done" : "status-pill small pending"
                }
              >
                {milestone.available ? "available" : "pending"}
              </span>
              <strong>{milestone.label}</strong>
              <small>{milestone.path}</small>
            </li>
          ))}
        </ol>
      </section>
      {filteredArtifacts.length === 0 ? (
        <section
          className='artifact-preview-empty'
          aria-labelledby='artifact-preview-empty-heading'
        >
          <h3 id='artifact-preview-empty-heading'>{emptyState.heading}</h3>
          <p>{emptyState.message}</p>
        </section>
      ) : (
        <RunArtifactPreviewGroups artifactGroups={artifactGroups} />
      )}
    </section>
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

/**
 * Applies a valid artifact availability filter selection.
 *
 * @param value - The selected filter value from the shadcn select control.
 * @param setStatus - Setter used to update the current artifact availability filter.
 */
function setSelectedStatus(
  value: string,
  setStatus: (status: ArtifactPreviewStatusFilter) => void,
): void {
  if (artifactPreviewStatusFilters.includes(value as ArtifactPreviewStatusFilter)) {
    setStatus(value as ArtifactPreviewStatusFilter);
  }
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
