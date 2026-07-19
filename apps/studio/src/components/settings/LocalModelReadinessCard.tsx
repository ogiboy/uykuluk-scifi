"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { StudioLocale } from "@/i18n/locales";
import type { StudioLocalModelOverview } from "@/lib/localModels/localModelOverview";
import { useStudioGuardedActionSubmit } from "@/lib/mutations/useStudioGuardedActionSubmit";
import { HardDriveDownloadIcon, SparklesIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { localModelCopy } from "./localModelReadinessCopy";
import {
  formatLocalModelBytes,
  formatLocalModelElapsed,
  localModelReadinessGuidance,
  localModelReadinessLabel,
  nextLocalModelOperation,
} from "./localModelReadinessFormatting";
import {
  Fact,
  LocalModelActionStatus,
  LocalModelActivePanel,
  LocalModelPreparationPanel,
  ReadinessBadge,
} from "./localModelReadinessPresentation";

const mfluxPackageId = "mflux-flux2-klein-4b-q4";
type LocalModelReadinessCopy = ReturnType<typeof localModelCopy>;

type LocalModelReadinessCardProps = Readonly<{
  locale: StudioLocale;
  overview: StudioLocalModelOverview;
}>;

/**
 * Presents the explicit no-cost MFLUX preparation and approval flow in Settings.
 *
 * The card never downloads a package by itself: the first action persists a bounded preflight and
 * the second action confirms its exact digest for core-owned execution.
 */
export function LocalModelReadinessCard({ locale, overview }: LocalModelReadinessCardProps) {
  const copy = localModelCopy(locale);
  const router = useRouter();
  const [approvedBy, setApprovedBy] = useState(
    locale === "tr" ? "Studio operatörü" : "Studio operator",
  );
  const [confirmed, setConfirmed] = useState(false);
  const prepareAction = useStudioGuardedActionSubmit(copy.prepareIdle);
  const executeAction = useStudioGuardedActionSubmit(copy.executeIdle);
  const preparation = overview.preparation;
  const operation = nextLocalModelOperation(overview.readiness);
  const active = overview.readiness === "setup-pending" || overview.readiness === "setup-running";
  const canExecute = Boolean(preparation && confirmed && approvedBy.trim());
  const guidance = localModelReadinessGuidance(copy, overview.readiness);
  const elapsed = active
    ? formatLocalModelElapsed(
        overview.latestOperation?.startedAt ?? overview.latestOperation?.requestedAt,
        locale,
      )
    : undefined;

  useEffect(() => {
    if (!active) return;
    const refresh = setInterval(() => router.refresh(), 2_000);
    return () => clearInterval(refresh);
  }, [active, router]);

  return (
    <Card className='bg-muted/10 overflow-hidden border-(--line)'>
      <CardHeader className='bg-background/35 border-b border-(--line)'>
        <div className='flex flex-wrap items-start justify-between gap-3'>
          <div className='grid gap-1.5'>
            <CardTitle aria-level={2} className='flex items-center gap-2' role='heading'>
              <SparklesIcon aria-hidden='true' className='text-cyan-400' />
              {copy.title}
            </CardTitle>
            <CardDescription>{copy.description}</CardDescription>
          </div>
          <ReadinessBadge
            label={localModelReadinessLabel(copy, overview)}
            readiness={overview.readiness}
          />
        </div>
      </CardHeader>
      <CardContent className='grid gap-5 pt-6'>
        <Alert>
          <AlertTitle>{copy.requiredTitle}</AlertTitle>
          <AlertDescription>{copy.requiredDescription}</AlertDescription>
        </Alert>

        <LocalModelFacts copy={copy} overview={overview} />

        {active ? (
          <LocalModelActivePanel
            copy={copy}
            elapsed={elapsed}
            guidance={guidance}
            overview={overview}
            recovering={prepareAction.state.kind === "submitting"}
            onRecover={() => void prepare("setup")}
          />
        ) : null}

        {overview.readiness === "failed" || overview.readiness === "interrupted" ? (
          <Alert variant={overview.readiness === "failed" ? "destructive" : "default"}>
            <AlertTitle>{copy.recoveryRequired}</AlertTitle>
            <AlertDescription>{guidance}</AlertDescription>
          </Alert>
        ) : null}

        {preparation ? (
          <LocalModelPreparationPanel
            approvedBy={approvedBy}
            canExecute={canExecute}
            confirmed={confirmed}
            copy={copy}
            locale={locale}
            preparation={preparation}
            submitting={executeAction.state.kind === "submitting"}
            onApprovedByChange={setApprovedBy}
            onConfirmedChange={setConfirmed}
            onExecute={() =>
              void executeAction.submit({
                actionId: "localModels.execute",
                body: {
                  approvedBy: approvedBy.trim(),
                  bindingDigest: preparation.bindingDigest,
                  confirmExecution: true,
                  runId: preparation.runId,
                },
                errorToastTitle: copy.executionBlocked,
                fallbackError: copy.executionFailed,
                routePath: "/actions/local-models-execute",
                submittingMessage: copy.executing,
                successMessage: copy.executionQueued,
                successToastTitle: copy.executionQueued,
              })
            }
          />
        ) : (
          <div className='flex flex-wrap items-center gap-3'>
            <Button
              disabled={active || prepareAction.state.kind === "submitting"}
              onClick={() => void prepare(operation)}
            >
              <HardDriveDownloadIcon aria-hidden='true' />
              {operation === "verify" ? copy.verifyRuntime : copy.reviewInstall}
            </Button>
            {overview.readiness === "ready" ? (
              <Button
                disabled={prepareAction.state.kind === "submitting"}
                variant='secondary'
                onClick={() => void prepare("smoke")}
              >
                <SparklesIcon aria-hidden='true' />
                {copy.reviewSmoke}
              </Button>
            ) : null}
            <p className='text-muted-foreground text-sm'>{guidance}</p>
          </div>
        )}

        <LocalModelAdvancedDetails copy={copy} overview={overview} />

        {prepareAction.state.kind === "idle" ? null : (
          <LocalModelActionStatus copy={copy} state={prepareAction.state} />
        )}
        {executeAction.state.kind === "idle" ? null : (
          <LocalModelActionStatus copy={copy} state={executeAction.state} />
        )}
      </CardContent>
    </Card>
  );

  async function prepare(next: "setup" | "smoke" | "verify"): Promise<void> {
    await prepareAction.submit({
      actionId: "localModels.prepare",
      body: { operation: next, packageId: mfluxPackageId },
      errorToastTitle: copy.preflightBlocked,
      fallbackError: copy.preflightFailed,
      routePath: "/actions/local-models-prepare",
      submittingMessage: copy.preparing,
      successMessage: copy.preflightReady,
      successToastTitle: copy.preflightReady,
    });
  }
}

function LocalModelFacts({
  copy,
  overview,
}: Readonly<{ copy: LocalModelReadinessCopy; overview: StudioLocalModelOverview }>) {
  const diskEstimate = overview.preparation
    ? formatLocalModelBytes(overview.preparation.estimatedDiskBytes)
    : copy.diskEstimate;

  return (
    <div className='grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4'>
      <Fact label={copy.model} value='FLUX.2 Klein 4B · q4' />
      <Fact label={copy.runtime} value='MFLUX 0.18.0 · Python 3.12' />
      <Fact label={copy.disk} value={diskEstimate} />
      <Fact label={copy.progress} value={localModelReadinessLabel(copy, overview)} />
    </div>
  );
}

function LocalModelAdvancedDetails({
  copy,
  overview,
}: Readonly<{ copy: LocalModelReadinessCopy; overview: StudioLocalModelOverview }>) {
  return (
    <details className='text-muted-foreground text-xs'>
      <summary className='cursor-pointer font-medium'>{copy.advanced}</summary>
      <dl className='mt-3 grid gap-1 break-all'>
        <div>
          {copy.package}: {mfluxPackageId}
        </div>
        <div>
          {copy.runtimePath}: {overview.runtimePath}
        </div>
        {overview.latestOperation ? (
          <>
            <div>
              {copy.latestOperation}: {overview.latestOperation.operationId} ·{" "}
              {overview.latestOperation.status}
            </div>
            {overview.latestOperation.message ? (
              <div>
                {copy.latestDiagnostic}: {overview.latestOperation.message}
              </div>
            ) : null}
          </>
        ) : null}
        {overview.preparation ? (
          <div>
            {copy.binding}: {overview.preparation.bindingDigest}
          </div>
        ) : null}
      </dl>
    </details>
  );
}
