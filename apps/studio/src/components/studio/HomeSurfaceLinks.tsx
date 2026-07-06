import Link from "next/link";
import type { Route } from "next";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import type { StudioActionServiceStatus } from "@/lib/actionServiceStatus";
import type { StudioAnalyticsOverview } from "@/lib/analyticsOverview";
import type { StudioAssetInventory } from "@/lib/assetInventory";
import type { StudioDoctorOverview } from "@/lib/doctorOverview";
import type { StudioModelEvalOverview } from "@/lib/modelEvalOverview";
import type { StudioPromptInventory } from "@/lib/promptInventory";
import type { StudioRunSummary } from "@/lib/runSummaries";

type HomeSurfaceLinksProps = Readonly<{
  actionStatus: StudioActionServiceStatus;
  analyticsOverview: StudioAnalyticsOverview;
  assetInventory: StudioAssetInventory;
  doctorOverview: StudioDoctorOverview;
  modelEvalOverview: StudioModelEvalOverview;
  promptInventory: StudioPromptInventory;
  runs: readonly StudioRunSummary[];
}>;

type HomeSurface = Readonly<{
  detail: string;
  href: Route;
  label: string;
  metric: string;
  status: string;
  tone: SurfaceTone;
}>;

type SurfaceTone = "blocked" | "neutral" | "passing" | "warning";
type BadgeVariant = "destructive" | "outline" | "secondary";

/**
 * Renders the compact route index for secondary Studio surfaces.
 *
 * @param props - Current Studio route summaries used to label each destination.
 * @returns A small operator route index that keeps the home page focused on current work.
 */
export function HomeSurfaceLinks({
  actionStatus,
  analyticsOverview,
  assetInventory,
  doctorOverview,
  modelEvalOverview,
  promptInventory,
  runs,
}: HomeSurfaceLinksProps) {
  const surfaces = buildHomeSurfaces({
    actionStatus,
    analyticsOverview,
    assetInventory,
    doctorOverview,
    modelEvalOverview,
    promptInventory,
    runs,
  });

  return (
    <section
      aria-labelledby='studio-surfaces-heading'
      className='rounded-2xl bg-card/55 p-5 shadow-sm shadow-black/10'
    >
      <div className='grid gap-3 pb-4 sm:grid-cols-[1fr_auto] sm:items-end'>
        <div className='space-y-1'>
          <p className='text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground'>
            Detail routes
          </p>
          <h2 className='text-xl font-semibold tracking-tight' id='studio-surfaces-heading'>
            Open focused operator pages when you need deeper proof.
          </h2>
        </div>
        <Link className={buttonVariants({ variant: "secondary" })} href='/actions'>
          See guarded actions
        </Link>
      </div>

      <ul className='grid gap-3 md:grid-cols-2 xl:grid-cols-3' aria-label='Studio operator pages'>
        {surfaces.map((surface) => (
          <li className='min-w-0 rounded-xl bg-background/45 p-4' key={surface.href}>
            <div className='flex min-w-0 flex-wrap items-start justify-between gap-3'>
              <div className='min-w-0 space-y-1'>
                <h3 className='truncate text-sm font-semibold' title={surface.label}>
                  {surface.label}
                </h3>
                <p className='text-xs text-muted-foreground'>{surface.metric}</p>
              </div>
              <Badge variant={badgeVariant(surface.tone)}>{surface.status}</Badge>
            </div>
            <p className='mt-3 min-h-10 text-sm text-muted-foreground'>{surface.detail}</p>
            <Link
              className='mt-3 inline-flex text-sm font-medium text-foreground underline-offset-4 hover:underline'
              href={surface.href}
            >
              Open {surface.label.toLowerCase()}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function buildHomeSurfaces(props: HomeSurfaceLinksProps): HomeSurface[] {
  const overrideCount = props.promptInventory.prompts.filter(
    (prompt) => prompt.mode === "override",
  ).length;
  const latestRun = props.runs[0] ?? null;
  return [
    {
      detail: latestRun
        ? `Latest run is ${latestRun.state}. Use the run page for evidence, artifacts, and review tabs.`
        : "No persisted runs yet. Start from the control desk, then review generated artifacts here.",
      href: "/runs",
      label: "Runs",
      metric: `${props.runs.length} persisted`,
      status: latestRun?.state ?? "empty",
      tone: latestRun?.blockedActionCount ? "blocked" : "neutral",
    },
    {
      detail: `${props.doctorOverview.blockCount} blocks and ${props.doctorOverview.warnCount} warnings from the latest doctor artifact.`,
      href: "/doctor",
      label: "Doctor",
      metric: `${props.doctorOverview.passCount}/${props.doctorOverview.checkCount} checks pass`,
      status: props.doctorOverview.status,
      tone: doctorTone(props.doctorOverview.status),
    },
    {
      detail: modelEvalDetail(props.modelEvalOverview),
      href: "/eval",
      label: "Model eval",
      metric: modelEvalMetric(props.modelEvalOverview),
      status: props.modelEvalOverview.status,
      tone: proofTone(props.modelEvalOverview.status),
    },
    {
      detail: `${props.analyticsOverview.mappedRunCount} mapped runs; report artifact is ${props.analyticsOverview.reportStatus}.`,
      href: "/analytics",
      label: "Analytics",
      metric: `${props.analyticsOverview.recordCount} records`,
      status: props.analyticsOverview.status,
      tone: proofTone(props.analyticsOverview.status),
    },
    {
      detail: `${props.assetInventory.warnings.length} warnings across configured brand, overlay, intro, outro, and production assets.`,
      href: "/assets",
      label: "Assets",
      metric: `${props.assetInventory.totalFiles} files`,
      status: props.assetInventory.passed ? "ready" : "needs action",
      tone: props.assetInventory.passed ? "passing" : "warning",
    },
    {
      detail: `${overrideCount} local overrides are visible here; prompt runtime still belongs to CLI/core.`,
      href: "/prompts",
      label: "Prompts",
      metric: `${props.promptInventory.prompts.length} templates`,
      status: props.promptInventory.passed ? "ready" : "needs action",
      tone: props.promptInventory.passed ? "passing" : "warning",
    },
    {
      detail: `${props.actionStatus.riskyExternalCount} external upload/publish-style contracts remain disabled by default.`,
      href: "/actions",
      label: "Actions",
      metric: `${props.actionStatus.webReadyCount}/${props.actionStatus.readyForCliCount} web-ready`,
      status: props.actionStatus.findings.length > 0 ? "findings" : "guarded",
      tone: props.actionStatus.findings.length > 0 ? "blocked" : "neutral",
    },
  ];
}

function badgeVariant(tone: SurfaceTone): BadgeVariant {
  if (tone === "blocked") {
    return "destructive";
  }
  if (tone === "passing") {
    return "secondary";
  }
  return "outline";
}

function doctorTone(status: StudioDoctorOverview["status"]): SurfaceTone {
  if (status === "blocked" || status === "invalid") {
    return "blocked";
  }
  if (status === "warning" || status === "missing") {
    return "warning";
  }
  return "passing";
}

function proofTone(status: string): SurfaceTone {
  if (status === "blocked" || status === "invalid") {
    return "blocked";
  }
  if (status === "missing" || status === "recommended" || status === "ready") {
    return "warning";
  }
  return status === "passing" ? "passing" : "neutral";
}

function modelEvalMetric(overview: StudioModelEvalOverview): string {
  if (overview.candidateReport) {
    return `${overview.candidateReport.passingCandidateCount}/${overview.candidateReport.candidateCount} candidates pass`;
  }
  if (overview.singleReport) {
    return `${overview.singleReport.passCount}/${overview.singleReport.checkCount} checks pass`;
  }
  return "no persisted eval";
}

function modelEvalDetail(overview: StudioModelEvalOverview): string {
  if (overview.candidateReport?.recommendedCandidate) {
    return `Recommended candidate: ${overview.candidateReport.recommendedCandidate.configuredModel}.`;
  }
  if (overview.singleReport) {
    return `Latest single-model eval used ${overview.singleReport.configuredModel}.`;
  }
  return "Run local model evaluation before trusting provider-backed script generation.";
}
