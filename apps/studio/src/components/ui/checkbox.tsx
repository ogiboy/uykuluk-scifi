"use client";

import * as React from "react";
import { CheckIcon } from "lucide-react";
import { Checkbox as CheckboxPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

function Checkbox({ className, ...props }: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot='checkbox'
      className={cn(
        "peer size-4 shrink-0 rounded-[4px] border border-[color:var(--line)] bg-[#0b0f14] text-[#071012] shadow-xs outline-none transition-shadow focus-visible:border-[color:var(--accent)] focus-visible:ring-2 focus-visible:ring-[color:var(--accent)] disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-[color:var(--danger)] aria-invalid:ring-[color:var(--danger)] data-[state=checked]:border-[color:var(--accent)] data-[state=checked]:bg-[color:var(--accent)]",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot='checkbox-indicator'
        className='grid place-content-center text-current transition-none'
      >
        <CheckIcon className='size-3.5' />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
