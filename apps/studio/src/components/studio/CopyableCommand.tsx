"use client";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CopyIcon } from "lucide-react";
import { toast } from "sonner";

type CopyableCommandProps = Readonly<{ command: string; label?: string }>;

/**
 * Renders an operator CLI command with a one-click local clipboard copy action.
 *
 * @param command - The exact command text to display and copy.
 * @param label - Optional copy confirmation context.
 * @returns A copyable command display.
 */
export function CopyableCommand({ command, label = "Command" }: CopyableCommandProps) {
  async function copyCommand(): Promise<void> {
    try {
      await navigator.clipboard.writeText(command);
      toast.success(`${label} copied`, { description: command });
    } catch {
      toast.error(`${label} could not be copied`, {
        description: "Select the command text manually and copy it from Studio.",
      });
    }
  }

  return (
    <div className='bg-background/35 grid gap-2 rounded-lg p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center'>
      <code className='text-foreground min-w-0 font-mono text-xs break-all'>{command}</code>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            aria-label={`Copy ${label.toLowerCase()}`}
            type='button'
            variant='ghost'
            onClick={() => void copyCommand()}
          >
            <CopyIcon className='size-4' aria-hidden='true' />
            Copy
          </Button>
        </TooltipTrigger>
        <TooltipContent>Copy exact CLI command</TooltipContent>
      </Tooltip>
    </div>
  );
}
