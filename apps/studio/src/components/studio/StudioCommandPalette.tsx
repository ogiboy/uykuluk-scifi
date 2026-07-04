"use client";

import { useEffect, useMemo, useState } from "react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { CopyIcon, ExternalLinkIcon, SearchIcon, TerminalIcon } from "lucide-react";
import { toast } from "sonner";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { runReviewHrefFromSummary } from "@/lib/runReviewNavigation";
import { getNextSafeCommand } from "@/lib/runSummaryCopy";
import type { StudioRunSummary } from "@/lib/runSummaries";

type StudioCommandPaletteProps = Readonly<{
  runs: readonly StudioRunSummary[];
}>;

const navigationTargets = [
  { href: "/", label: "Studio home", keywords: "control desk current production queue" },
  { href: "/runs", label: "Runs", keywords: "queue review evidence readiness" },
  { href: "/doctor", label: "Doctor", keywords: "diagnostics config setup" },
  { href: "/eval", label: "Model eval", keywords: "local model llama ollama qwen" },
  { href: "/assets", label: "Assets", keywords: "brand render visuals inventory" },
  { href: "/analytics", label: "Analytics", keywords: "manual feedback import report" },
  { href: "/prompts", label: "Prompts", keywords: "runtime prompt inventory overrides" },
] as const satisfies readonly { href: Route; keywords: string; label: string }[];

/**
 * Renders a modal command palette for local Studio navigation and safe command copying.
 *
 * @param runs - Persisted local run summaries, newest first.
 * @returns A keyboard-accessible operator action launcher.
 */
export function StudioCommandPalette({ runs }: StudioCommandPaletteProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const visibleRuns = useMemo(() => runs, [runs]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((current) => !current);
      }
    }
    const browserWindow = globalThis.window;
    browserWindow.addEventListener("keydown", onKeyDown);
    return () => browserWindow.removeEventListener("keydown", onKeyDown);
  }, []);

  function navigateTo(href: Route): void {
    setOpen(false);
    router.push(href);
  }

  async function copyCommand(run: StudioRunSummary): Promise<void> {
    const command = getNextSafeCommand(run);
    try {
      await navigator.clipboard.writeText(command);
      setOpen(false);
      toast.success("Next safe command copied", { description: run.runId });
    } catch {
      toast.error("Command could not be copied", {
        description: "Use the run detail page to copy the CLI command manually.",
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type='button' variant='secondary'>
          <SearchIcon data-icon='inline-start' />
          Command palette
          <kbd className='keyboard-shortcut'>⌘K</kbd>
        </Button>
      </DialogTrigger>
      <DialogContent className='command-palette-dialog' showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Operator command palette</DialogTitle>
          <DialogDescription>
            Navigate Studio surfaces or copy safe CLI commands. This palette never mutates a run.
          </DialogDescription>
        </DialogHeader>
        <Command>
          <CommandInput placeholder='Search pages, runs, states, or safe commands...' />
          <CommandList>
            <CommandEmpty>No matching local Studio action.</CommandEmpty>
            <CommandGroup heading='Studio pages'>
              {navigationTargets.map((item) => (
                <CommandItem
                  key={item.href}
                  value={`${item.label} ${item.href} ${item.keywords}`}
                  onSelect={() => navigateTo(item.href)}
                >
                  <ExternalLinkIcon />
                  <span>{item.label}</span>
                  <CommandShortcut>{item.href}</CommandShortcut>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading='Recent runs'>
              {visibleRuns.map((run) => (
                <CommandItem
                  key={`open-${run.runId}`}
                  value={`${run.runId} ${run.state} ${run.readinessStatus} ${run.evidenceStatus}`}
                  onSelect={() => navigateTo(runReviewHrefFromSummary(run) as Route)}
                >
                  <TerminalIcon />
                  <span className='command-item-body'>
                    <strong>{run.runId}</strong>
                    <span>
                      {run.state} · readiness {run.readinessStatus} · evidence {run.evidenceStatus}
                    </span>
                  </span>
                  <CommandShortcut>open</CommandShortcut>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading='Copy next safe command'>
              {visibleRuns.map((run) => (
                <CommandItem
                  key={`copy-${run.runId}`}
                  value={`${run.runId} copy next command ${run.nextRecommendedCommand ?? ""}`}
                  onSelect={() => void copyCommand(run)}
                >
                  <CopyIcon />
                  <span className='command-item-body'>
                    <strong>{run.runId}</strong>
                    <code>{getNextSafeCommand(run)}</code>
                  </span>
                  <CommandShortcut>copy</CommandShortcut>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
