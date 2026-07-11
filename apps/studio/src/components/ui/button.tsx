import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import type { ButtonHTMLAttributes } from "react";

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-[color,background-color,border-color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        ghost: "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
        link: "text-primary underline-offset-4 hover:underline",
        outline:
          "border border-input bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        icon: "size-9",
        "icon-lg": "size-10",
        "icon-sm": "size-8",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        sm: "h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
      },
    },
    defaultVariants: { size: "default", variant: "default" },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

/**
 * Renders the shared shadcn-style button contract with semantic theme variants.
 *
 * @param asChild - Whether to merge button styling into the single child element.
 * @param className - Optional additional utility classes.
 * @param size - Semantic button size.
 * @param type - Native button type; defaults to `button` for safe form behavior.
 * @param variant - Semantic visual variant.
 */
export function Button({
  asChild = false,
  className,
  size,
  type = "button",
  variant,
  ...props
}: Readonly<ButtonProps>) {
  const classes = cn(buttonVariants({ className, size, variant }));
  if (asChild) {
    return <Slot.Root className={classes} {...props} />;
  }
  return <button className={classes} type={type} {...props} />;
}

export { buttonVariants };
