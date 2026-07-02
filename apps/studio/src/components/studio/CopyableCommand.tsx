"use client";

import { CopyIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type CopyableCommandProps = Readonly<{
  command: string;
  label?: string;
}>;

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
    <div className='copyable-command'>
      <code className='command'>{command}</code>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            aria-label={`Copy ${label.toLowerCase()}`}
            className='copy-command-button'
            type='button'
            variant='ghost'
            onClick={() => void copyCommand()}
          >
            <CopyIcon data-icon='inline-start' />
            Copy
          </Button>
        </TooltipTrigger>
        <TooltipContent>Copy exact CLI command</TooltipContent>
      </Tooltip>
    </div>
  );
}
