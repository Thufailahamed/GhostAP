import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline" | "ghost" | "destructive";
  size?: "default" | "sm" | "lg";
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center text-sm font-bold uppercase tracking-widest transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-terminal-green disabled:opacity-50 disabled:pointer-events-none",
          "border border-transparent",
          {
            "bg-terminal-green text-black hover:bg-terminal-green/80":
              variant === "default",
            "border-terminal-green text-terminal-green bg-transparent hover:bg-terminal-green hover:text-black":
              variant === "outline",
            "hover:bg-terminal-green/10 text-terminal-green bg-transparent":
              variant === "ghost",
            "bg-terminal-red text-black hover:bg-terminal-red/80 border-terminal-red":
              variant === "destructive",
            "h-10 py-2 px-4": size === "default",
            "h-9 px-3": size === "sm",
            "h-11 px-8": size === "lg",
          },
          className,
        )}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button };
