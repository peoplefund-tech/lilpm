import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-violet-500 text-white hover:bg-violet-400",
        secondary: "border-transparent bg-[#1a1a1f] text-slate-300 hover:bg-white/10",
        destructive: "border-transparent bg-red-500/80 text-white hover:bg-red-500",
        outline: "border-white/10 text-white bg-transparent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> { }

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
