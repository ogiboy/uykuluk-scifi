import * as React from "react";

import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot='textarea'
      className={cn(
        "bg-muted placeholder:text-muted-foreground aria-invalid:border-destructive aria-invalid:ring-destructive flex field-sizing-content min-h-16 w-full rounded-md border border-(--line) px-3 py-2 text-base text-(--text) shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-(--accent) focus-visible:ring-2 focus-visible:ring-(--accent) disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
