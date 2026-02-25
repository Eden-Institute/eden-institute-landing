import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium ring-offset-background transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 font-body",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90 rounded-sm",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-sm",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground rounded-sm",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded-sm",
        ghost: "hover:bg-accent hover:text-accent-foreground rounded-sm",
        link: "text-primary underline-offset-4 hover:underline",
        eden: "bg-eden-forest text-eden-parchment hover:bg-eden-forest-light border border-eden-gold/20 rounded-sm tracking-wider uppercase text-xs font-serif",
        "eden-outline": "bg-transparent text-eden-forest border-2 border-eden-forest hover:bg-eden-forest hover:text-eden-parchment rounded-sm tracking-wider uppercase text-xs font-serif",
        "eden-gold": "bg-eden-gold text-eden-bark hover:bg-eden-gold-light rounded-sm tracking-wider uppercase text-xs font-serif",
        "eden-light": "bg-eden-parchment text-eden-forest border border-eden-gold/30 hover:bg-eden-parchment-dark rounded-sm tracking-wider uppercase text-xs font-serif"
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-sm px-3",
        lg: "h-12 rounded-sm px-10 py-3",
        xl: "h-14 rounded-sm px-12 py-4 text-sm",
        icon: "h-10 w-10"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
);

export interface ButtonProps extends
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn("", buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };