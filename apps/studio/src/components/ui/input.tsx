import * as React from "react";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot='input'
      className={cn(
        "bg-muted placeholder:text-muted-foreground h-9 w-full min-w-0 rounded-md border border-(--line) px-3 py-1 text-base text-(--text) shadow-xs transition-[color,box-shadow] outline-none selection:bg-(--accent) selection:text-[#071012] file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-(--text) disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "focus-visible:border-(--accent) focus-visible:ring-2 focus-visible:ring-(--accent)",
        "aria-invalid:border-destructive aria-invalid:ring-destructive",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
