import type { StudioRunSummary } from "@/lib/runSummaries";
import { runReviewHrefFromSummary } from "@/lib/runReviewNavigation";
import {
  formatRunChannelHandoff,
  formatRunChannelHandoffDecision,
  formatRunFinalReviewBundle,
  formatRunRenderDecision,
  formatRunReviewCounts,
} from "@/lib/runSummaryCopy";
import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import type { Route } from "next";
import {
  operatorActionDetail,
  operatorActionForRun,
  operatorActionSearchText,
} from "./runSummaryOperatorAction";
import { RunSummaryRowActions } from "./RunSummaryRowActions";

type RunTableColumnMeta = Readonly<{
  label: string;
}>;

export function runSummaryColumns(): ColumnDef<StudioRunSummary>[] {
  return [
    {
      accessorKey: "runId",
      cell: ({ row }) => (
        <Link className='run-row-link' href={runReviewHrefFromSummary(row.original) as Route}>
          {row.original.runId}
        </Link>
      ),
      enableHiding: false,
      header: "Run",
      meta: { label: "Run" } satisfies RunTableColumnMeta,
    },
    {
      accessorKey: "state",
      cell: ({ row }) => (
        <span className='run-cell-stack'>
          <strong>{row.original.state}</strong>
          <small>{formatRunReviewCounts(row.original)}</small>
        </span>
      ),
      header: "State",
      meta: { label: "State" } satisfies RunTableColumnMeta,
    },
    {
      accessorKey: "readinessStatus",
      cell: ({ row }) => (
        <span className='run-cell-stack'>
          <strong>{row.original.readinessStatus}</strong>
          {row.original.readinessStatus === "passed" ? null : (
            <small>{row.original.readinessMessage}</small>
          )}
          {row.original.readinessNextAction ? (
            <small>{row.original.readinessNextAction}</small>
          ) : null}
        </span>
      ),
      header: "Readiness",
      meta: { label: "Readiness" } satisfies RunTableColumnMeta,
    },
    {
      accessorKey: "evidenceStatus",
      cell: ({ row }) => (
        <span className='run-cell-stack'>
          <strong>{row.original.evidenceStatus}</strong>
          {row.original.evidenceStatus === "available" ? null : (
            <small>{row.original.evidenceMessage}</small>
          )}
        </span>
      ),
      header: "Evidence",
      meta: { label: "Evidence" } satisfies RunTableColumnMeta,
    },
    {
      accessorFn: (run) => operatorActionSearchText(operatorActionForRun(run)),
      cell: ({ row }) => {
        const action = operatorActionForRun(row.original);
        return (
          <span className='run-cell-stack'>
            <strong>{action.label}</strong>
            <small>{operatorActionDetail(action)}</small>
            {action.routePath ? <small>{action.routePath}</small> : null}
          </span>
        );
      },
      header: "Operator action",
      id: "operatorAction",
      meta: { label: "Operator action" } satisfies RunTableColumnMeta,
    },
    {
      accessorFn: (run) =>
        `${formatRunRenderDecision(run)} ${formatRunChannelHandoffDecision(run)}`,
      cell: ({ row }) => (
        <span className='run-cell-stack'>
          <strong>Render: {formatRunRenderDecision(row.original)}</strong>
          {row.original.renderDecision.kind === "present" ? (
            <small>{row.original.renderDecision.message}</small>
          ) : null}
          {row.original.channelHandoff.kind === "present" ? (
            <small>Channel: {formatRunChannelHandoffDecision(row.original)}</small>
          ) : null}
        </span>
      ),
      header: "Decision",
      id: "renderDecision",
      meta: { label: "Render decision" } satisfies RunTableColumnMeta,
    },
    {
      accessorKey: "blockedActionCount",
      cell: ({ row }) => (
        <span className={row.original.blockedActionCount > 0 ? "blocked" : undefined}>
          {row.original.blockedActionCount}
        </span>
      ),
      header: "Blocks",
      id: "blockedActionCount",
      meta: { label: "Blocks" } satisfies RunTableColumnMeta,
    },
    {
      accessorKey: "updatedAt",
      cell: ({ row }) => formatRunDate(row.original.updatedAt),
      header: "Updated",
      meta: { label: "Updated" } satisfies RunTableColumnMeta,
    },
    {
      accessorFn: (run) => formatRunFinalReviewBundle(run),
      cell: ({ row }) => (
        <span className='run-cell-stack'>
          <strong>{formatRunFinalReviewBundle(row.original)}</strong>
          {row.original.finalReviewBundle.kind === "present" ? (
            <small>{row.original.finalReviewBundle.reviewPath}</small>
          ) : null}
        </span>
      ),
      header: "Final bundle",
      id: "finalBundle",
      meta: { label: "Final bundle" } satisfies RunTableColumnMeta,
    },
    {
      accessorFn: (run) => formatRunChannelHandoff(run),
      cell: ({ row }) => (
        <span className='run-cell-stack'>
          <strong>{formatRunChannelHandoff(row.original)}</strong>
          {row.original.channelHandoff.kind === "present" ? (
            <small>{row.original.channelHandoff.reviewPath}</small>
          ) : null}
          {row.original.channelHandoffDecision.kind === "present" ? (
            <small>{formatRunChannelHandoffDecision(row.original)}</small>
          ) : null}
        </span>
      ),
      header: "Channel handoff",
      id: "channelHandoff",
      meta: { label: "Channel handoff" } satisfies RunTableColumnMeta,
    },
    {
      accessorFn: (run) => run.nextRecommendedCommand ?? "Generate evidence from CLI",
      cell: ({ row }) => row.original.nextRecommendedCommand ?? "Generate evidence from CLI",
      header: "Next action",
      id: "nextAction",
      meta: { label: "Next action" } satisfies RunTableColumnMeta,
    },
    {
      cell: ({ row }) => <RunSummaryRowActions run={row.original} />,
      enableHiding: false,
      enableSorting: false,
      header: "Actions",
      id: "actions",
      meta: { label: "Actions" } satisfies RunTableColumnMeta,
    },
  ];
}

export function runColumnClassName(columnId: string): string {
  return `run-cell-${columnId}`;
}

export function runColumnLabel(meta: unknown): string {
  if (meta && typeof meta === "object" && "label" in meta && typeof meta.label === "string") {
    return meta.label;
  }
  return "Column";
}

function formatRunDate(value: string): string {
  if (!value) {
    return "unknown";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString("tr-TR", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
  });
}
