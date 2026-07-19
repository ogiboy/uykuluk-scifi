"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import type { StudioLocale } from "@/i18n/locales";
import type { StudioVisualSceneSummary } from "@/lib/runs/visualSummaries";
import Image from "next/image";
import { useRef } from "react";
import { VisualRevisionGallery } from "./VisualRevisionGallery";
import { visualReviewCopy } from "./visualReviewCopy";
import { visualProviderLabel } from "./visualRevisionGalleryCopy";

type RunVisualSceneCardProps = Readonly<{
  busy: boolean;
  importAvailable: boolean;
  locale: StudioLocale;
  revisionActivationAvailable: boolean;
  scene: StudioVisualSceneSummary;
  selected: boolean;
  onImport: (sceneIndex: number, file: File) => Promise<boolean>;
  onActivateRevision: (sceneIndex: number, revision: number) => Promise<void>;
  onSelect: (sceneIndex: number, selected: boolean) => void;
}>;

/** Renders one current scene-visual revision with selection and manual replacement controls. */
export function RunVisualSceneCard({
  busy,
  importAvailable,
  locale,
  revisionActivationAvailable,
  scene,
  selected,
  onImport,
  onActivateRevision,
  onSelect,
}: RunVisualSceneCardProps) {
  const copy = visualReviewCopy(locale);
  const fileInput = useRef<HTMLInputElement>(null);
  return (
    <article className='bg-muted/10 ring-border/10 grid min-w-0 gap-3 overflow-hidden rounded-xl ring-1'>
      <div className='bg-background/60 relative aspect-video overflow-hidden'>
        <Image
          fill
          unoptimized
          alt={`${copy.beat(scene.sceneIndex)}: ${scene.prompt}`}
          className='object-cover'
          sizes='(min-width: 1280px) 30vw, (min-width: 720px) 45vw, 100vw'
          src={scene.mediaUrl}
        />
        <label className='bg-background/85 absolute top-3 left-3 flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-xs shadow-sm'>
          <Checkbox
            aria-label={copy.selectBeat(scene.sceneIndex)}
            checked={selected}
            disabled={busy}
            onCheckedChange={(checked) => onSelect(scene.sceneIndex, checked === true)}
          />
          {copy.beat(scene.sceneIndex)}
        </label>
        <Badge className='absolute top-3 right-3' variant={decisionVariant(scene.decision)}>
          {copy.status[scene.decision]}
        </Badge>
      </div>

      <div className='grid gap-3 p-4 pt-1'>
        <div className='flex flex-wrap items-center gap-2 text-xs'>
          <Badge variant='outline'>{visualProviderLabel(locale, scene.providerId)}</Badge>
          <Badge variant='outline'>{copy.revision(scene.activeRevision)}</Badge>
          <Badge variant='outline'>{scene.motion}</Badge>
          <span className='text-muted-foreground'>
            {copy.scenes} {formatSceneRange(scene.productionSceneIndexes)}
          </span>
        </div>
        <p className='line-clamp-3 text-sm leading-relaxed'>{scene.prompt}</p>
        {scene.decisionNotes ? (
          <p className='bg-background/55 text-muted-foreground rounded-md p-2 text-xs'>
            {scene.reviewedBy}: {scene.decisionNotes}
          </p>
        ) : null}

        <Input
          ref={fileInput}
          accept='image/png,image/jpeg,.png,.jpg,.jpeg'
          aria-label={copy.replacementImage(scene.sceneIndex)}
          disabled={busy || !importAvailable}
          type='file'
        />
        <Button
          disabled={busy || !importAvailable}
          size='sm'
          variant={scene.decision === "rejected" ? "default" : "secondary"}
          onClick={async () => {
            const file = fileInput.current?.files?.[0];
            if (file && (await onImport(scene.sceneIndex, file)) && fileInput.current) {
              fileInput.current.value = "";
            }
          }}
        >
          {copy.importNewRevision}
        </Button>
        <VisualRevisionGallery
          busy={busy}
          canActivate={revisionActivationAvailable}
          locale={locale}
          scene={scene}
          onActivate={onActivateRevision}
        />

        <details className='text-muted-foreground text-xs'>
          <summary className='cursor-pointer font-medium'>{copy.advancedEvidence}</summary>
          <div className='mt-2 grid gap-1 break-all'>
            <div>
              {copy.asset}: {scene.assetPath}
            </div>
            <div>
              {copy.revisionHistory}: {scene.revisionCount}
            </div>
            {scene.media.width && scene.media.height ? (
              <div>
                {copy.dimensions}: {scene.media.width}×{scene.media.height}
              </div>
            ) : null}
          </div>
        </details>
      </div>
    </article>
  );
}

function decisionVariant(
  decision: StudioVisualSceneSummary["decision"],
): "destructive" | "outline" | "secondary" {
  if (decision === "rejected") return "destructive";
  if (decision === "approved") return "secondary";
  return "outline";
}

function formatSceneRange(indexes: readonly number[]): string {
  if (indexes.length === 1) return String(indexes[0]);
  return `${indexes[0]}-${indexes.at(-1)}`;
}
