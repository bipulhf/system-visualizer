import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "~/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap border-2 border-[var(--border)] text-sm font-semibold transition-transform duration-150 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border)]",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--main)] text-[var(--foreground)] shadow-[var(--shadow)] hover:-translate-x-[var(--box-shadow-x)] hover:-translate-y-[var(--box-shadow-y)] hover:shadow-none",
        ghost: "bg-transparent text-[var(--foreground)] hover:bg-black/5",
      },
      size: {
        default: "h-10 px-4",
        sm: "h-9 px-3 text-xs",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  };

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: ButtonProps) {
  const Component = asChild ? Slot : "button";

  return (
    <Component
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { Button, buttonVariants };
