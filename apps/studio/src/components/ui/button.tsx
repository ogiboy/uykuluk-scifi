import type { ButtonHTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex h-9 items-center justify-center gap-2 rounded-md border px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "border-[color:var(--accent)] bg-[color:var(--accent)] text-[#071012] hover:bg-[#63e1d4]",
        secondary:
          "border-[color:var(--line)] bg-[color:var(--panel)] text-[color:var(--text)] hover:bg-[color:var(--panel-strong)]",
        ghost:
          "border-transparent text-[color:var(--muted)] hover:bg-[color:var(--panel)] hover:text-[color:var(--text)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, ...props }: ButtonProps) {
  return <button className={cn(buttonVariants({ variant }), className)} {...props} />;
}
