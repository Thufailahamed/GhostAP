import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full border border-terminal-green/50 bg-transparent px-3 py-2 text-sm text-terminal-green file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-terminal-green/30 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-terminal-amber focus-visible:border-terminal-amber disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
