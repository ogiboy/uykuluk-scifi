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
  {
    href: "/ideas" as Route,
    label: "Ideas",
    keywords: "history originality generated approved titles",
  },
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
        description: "Open the run detail page and reveal the CLI/core fallback manually.",
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type='button' variant='secondary'>
          <SearchIcon data-icon='inline-start' />
          Command palette
          <kbd className='rounded border bg-background px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground'>
            ⌘K
          </kbd>
        </Button>
      </DialogTrigger>
      <DialogContent className='overflow-hidden p-0 sm:max-w-2xl' showCloseButton={false}>
        <DialogHeader className='px-6 pt-6'>
          <DialogTitle>Operator command palette</DialogTitle>
          <DialogDescription>
            Navigate Studio surfaces or copy safe CLI/core fallback commands. This palette never
            mutates a run.
          </DialogDescription>
        </DialogHeader>
        <Command className='rounded-none'>
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
                  <span className='grid min-w-0 flex-1 gap-1'>
                    <strong className='truncate'>{run.runId}</strong>
                    <span className='truncate text-xs text-muted-foreground'>
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
                  <span className='grid min-w-0 flex-1 gap-1'>
                    <strong className='truncate'>{run.runId}</strong>
                    <code className='truncate font-mono text-xs text-muted-foreground'>
                      {getNextSafeCommand(run)}
                    </code>
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
