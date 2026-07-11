"use client";

import { CopyableCommand } from "@/components/studio/CopyableCommand";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";

type CliFallbackCommandProps = Readonly<{
  align?: "center" | "end" | "start";
  command: string;
  description?: string;
  label?: string;
  title?: string;
  triggerLabel?: string;
}>;

/**
 * Renders an explicit CLI/core fallback without making command-copy the primary Studio action.
 *
 * @param align - Popover alignment relative to the trigger.
 * @param command - Exact CLI/core command to reveal and copy.
 * @param description - Operator-facing explanation shown above the command.
 * @param label - Copy confirmation label passed to the command widget.
 * @param title - Popover title.
 * @param triggerLabel - Visible button copy.
 */
export function CliFallbackCommand({
  align = "end",
  command,
  description = "Use this only when you need to audit or recover through the CLI/core path.",
  label = "CLI fallback command",
  title = "CLI/core fallback",
  triggerLabel = "Show CLI fallback",
}: CliFallbackCommandProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type='button' variant='secondary'>
          {triggerLabel}
        </Button>
      </PopoverTrigger>
      <PopoverContent align={align} className='w-[min(460px,calc(100vw-2rem))]'>
        <PopoverHeader>
          <PopoverTitle>{title}</PopoverTitle>
          <PopoverDescription>{description}</PopoverDescription>
        </PopoverHeader>
        <div className='mt-4'>
          <CopyableCommand command={command} label={label} />
        </div>
      </PopoverContent>
    </Popover>
  );
}
