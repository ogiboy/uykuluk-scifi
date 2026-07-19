"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { StudioLocale } from "@/i18n/locales";
import type { StudioVisualSceneSummary } from "@/lib/runs/visualSummaries";
import { ChevronLeftIcon, ChevronRightIcon, Maximize2Icon } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { visualReviewCopy } from "./visualReviewCopy";
import {
  visualRevisionGalleryCopy,
  type VisualRevisionGalleryCopy,
} from "./visualRevisionGalleryCopy";

type VisualRevisionGalleryProps = Readonly<{
  busy: boolean;
  canActivate: boolean;
  locale: StudioLocale;
  scene: StudioVisualSceneSummary;
  onActivate: (sceneIndex: number, revision: number) => Promise<void>;
}>;

/**
 * Provides a review surface for comparing a scene's revisions without changing its canonical revision.
 *
 * Opening the gallery selects the scene's active revision. Selecting another revision only changes the
 * preview; canonical revision changes occur through the explicit activation action.
 *
 * @param busy - Disables revision activation while an activation is in progress.
 * @param canActivate - Determines whether non-canonical revisions can be activated.
 * @param locale - Controls localized labels and revision timestamps.
 * @param scene - Scene and revision history to display.
 * @param onActivate - Handles activation of the selected revision.
 */
export function VisualRevisionGallery({
  busy,
  canActivate,
  locale,
  scene,
  onActivate,
}: VisualRevisionGalleryProps) {
  const copy = visualRevisionGalleryCopy(locale);
  const reviewCopy = visualReviewCopy(locale);
  const [open, setOpen] = useState(false);
  const [currentRevision, setCurrentRevision] = useState(scene.activeRevision);
  const currentIndex = Math.max(
    0,
    scene.revisions.findIndex((candidate) => candidate.revision === currentRevision),
  );
  const current = scene.revisions[currentIndex] ?? scene.revisions[0]!;

  const setGalleryOpen = (nextOpen: boolean) => {
    if (nextOpen) setCurrentRevision(scene.activeRevision);
    setOpen(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={setGalleryOpen}>
      <DialogTrigger asChild>
        <Button size='sm' variant='secondary'>
          <Maximize2Icon aria-hidden='true' />
          {copy.reviewRevisions(scene.revisionCount)}
        </Button>
      </DialogTrigger>
      <DialogContent
        className='max-h-[calc(100dvh-2rem)] max-w-6xl overflow-y-auto p-4 sm:p-6'
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft") {
            event.preventDefault();
            setCurrentRevision(revisionAt(scene, currentIndex + 1));
          } else if (event.key === "ArrowRight") {
            event.preventDefault();
            setCurrentRevision(revisionAt(scene, currentIndex - 1));
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>{copy.title(scene.sceneIndex)}</DialogTitle>
          <DialogDescription>{copy.compareDescription}</DialogDescription>
        </DialogHeader>

        <div className='grid gap-4 lg:grid-cols-[minmax(0,1fr)_13rem]'>
          <div className='bg-background/70 ring-border/10 relative min-h-0 overflow-hidden rounded-xl ring-1'>
            <div className='relative aspect-video'>
              <Image
                fill
                priority
                unoptimized
                alt={`${copy.title(scene.sceneIndex)}: ${copy.revision(current.revision)}. ${scene.prompt}`}
                className='object-contain'
                sizes='(min-width: 1024px) 70vw, 100vw'
                src={current.mediaUrl}
              />
            </div>
            <div className='bg-background/90 absolute right-3 bottom-3 left-3 flex flex-wrap items-center justify-between gap-3 rounded-lg px-3 py-2 text-xs shadow-sm backdrop-blur-sm'>
              <div className='flex flex-wrap items-center gap-2'>
                <Badge variant='outline'>{providerLabel(copy, current.providerId)}</Badge>
                <Badge
                  variant={current.revision === scene.activeRevision ? "secondary" : "outline"}
                >
                  {current.revision === scene.activeRevision
                    ? copy.canonical
                    : copy.revision(current.revision)}
                </Badge>
                <span className='text-muted-foreground'>{formatMedia(copy, current.media)}</span>
              </div>
              {canActivate && current.revision !== scene.activeRevision ? (
                <div className='grid justify-items-end gap-1.5'>
                  <Button
                    disabled={busy}
                    size='sm'
                    onClick={() => void onActivate(scene.sceneIndex, current.revision)}
                  >
                    {copy.useRevision}
                  </Button>
                  <p className='text-muted-foreground max-w-xs text-right text-[0.7rem] leading-snug'>
                    {reviewCopy.activateImpact}
                  </p>
                </div>
              ) : null}
            </div>
          </div>

          <div className='grid max-h-[56dvh] content-start gap-2 overflow-auto pr-1 lg:max-h-136'>
            {scene.revisions.map((revision) => {
              const canonical = revision.revision === scene.activeRevision;
              const selected = revision.revision === current.revision;
              return (
                <button
                  className={`focus-visible:ring-ring grid grid-cols-[4.5rem_minmax(0,1fr)] gap-2 rounded-lg p-2 text-left transition-colors outline-none focus-visible:ring-2 ${
                    selected ? "bg-accent/70" : "hover:bg-muted/60"
                  }`}
                  key={revision.revision}
                  type='button'
                  aria-current={selected ? "true" : undefined}
                  onClick={() => setCurrentRevision(revision.revision)}
                >
                  <span className='bg-muted/50 relative aspect-video overflow-hidden rounded-md'>
                    <Image
                      fill
                      unoptimized
                      alt=''
                      className='object-cover'
                      sizes='72px'
                      src={revision.mediaUrl}
                    />
                  </span>
                  <span className='grid content-center gap-1 text-xs'>
                    <span className='flex items-center gap-1.5 font-medium'>
                      {copy.revision(revision.revision)}
                      {canonical ? <Badge variant='secondary'>{copy.canonical}</Badge> : null}
                    </span>
                    <span className='text-muted-foreground'>
                      {providerLabel(copy, revision.providerId)}
                    </span>
                    <span className='text-muted-foreground'>
                      {formatCreatedAt(locale, copy, revision.createdAt)}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {scene.revisions.length > 1 ? (
          <div className='flex items-center justify-between gap-3'>
            <Button
              aria-label={copy.previousRevision}
              disabled={currentIndex >= scene.revisions.length - 1}
              size='icon-sm'
              variant='secondary'
              onClick={() => setCurrentRevision(revisionAt(scene, currentIndex + 1))}
            >
              <ChevronLeftIcon aria-hidden='true' />
            </Button>
            <p className='text-muted-foreground text-center text-xs'>{copy.compareHint}</p>
            <Button
              aria-label={copy.nextRevision}
              disabled={currentIndex <= 0}
              size='icon-sm'
              variant='secondary'
              onClick={() => setCurrentRevision(revisionAt(scene, currentIndex - 1))}
            >
              <ChevronRightIcon aria-hidden='true' />
            </Button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Resolves a requested revision index to a valid revision number.
 *
 * @param scene - The scene containing the available revisions and active revision.
 * @param index - The requested position in the revision list.
 * @returns The revision number at the bounded index, or the scene's active revision when no revision is available.
 */
function revisionAt(scene: StudioVisualSceneSummary, index: number): number {
  const boundedIndex = Math.max(0, Math.min(index, scene.revisions.length - 1));
  return scene.revisions[boundedIndex]?.revision ?? scene.activeRevision;
}

function providerLabel(copy: VisualRevisionGalleryCopy, providerId: string): string {
  if (providerId === "static") return copy.staticFallback;
  if (providerId === "manual-import") return copy.manualImport;
  if (providerId === "black-forest-labs") return "Black Forest Labs";
  if (providerId === "mflux-local") return copy.mfluxLocal;
  return providerId;
}

function formatMedia(
  copy: VisualRevisionGalleryCopy,
  media: Readonly<{ height?: number; width?: number }>,
): string {
  return media.width && media.height
    ? `${media.width}×${media.height}`
    : copy.dimensionsUnavailable;
}

function formatCreatedAt(
  locale: StudioLocale,
  copy: VisualRevisionGalleryCopy,
  value: string,
): string {
  const parsed = new Date(value);
  const localeTag = locale === "tr" ? "tr-TR" : "en-US";
  return Number.isNaN(parsed.valueOf()) ? copy.recordedRevision : parsed.toLocaleString(localeTag);
}
