import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "~/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-semibold transition-all duration-150 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--main)]",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--main)] text-white shadow-sm hover:brightness-110 active:scale-[0.97]",
        secondary:
          "border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] shadow-xs hover:bg-[var(--surface-2)] active:scale-[0.97]",
        ghost:
          "text-[var(--foreground)] hover:bg-[var(--surface-2)] active:scale-[0.97]",
        destructive:
          "bg-red-500 text-white shadow-sm hover:bg-red-600 active:scale-[0.97]",
      },
      size: {
        default: "h-9 px-4",
        sm: "h-7 px-3 text-xs",
        lg: "h-11 px-6",
        icon: "h-9 w-9",
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
