"use client";

import { forwardRef } from "react";
import type {
  HTMLAttributes,
  InputHTMLAttributes,
  LabelHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { cn } from "./cn";

const fieldBase =
  "w-full rounded-lg border border-rc-night/15 bg-white px-3 py-2.5 text-sm text-rc-night placeholder:text-rc-night/40 transition-colors duration-150 " +
  "focus:border-rc-accent focus:outline-none focus:ring-2 focus:ring-rc-accent/40 disabled:opacity-50 " +
  "dark:border-rc-border-strong dark:bg-rc-night-light dark:text-white dark:placeholder:text-white/35 dark:hover:border-white/25";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(
  function Input({ className, invalid, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(fieldBase, invalid && "border-rc-danger focus:border-rc-danger focus:ring-rc-danger/30", className)}
        aria-invalid={invalid || undefined}
        {...props}
      />
    );
  },
);

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }>(
  function Textarea({ className, invalid, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        className={cn(fieldBase, "min-h-24", invalid && "border-rc-danger focus:border-rc-danger focus:ring-rc-danger/30", className)}
        aria-invalid={invalid || undefined}
        {...props}
      />
    );
  },
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }>(
  function Select({ className, invalid, children, ...props }, ref) {
    return (
      <select
        ref={ref}
        className={cn(fieldBase, "pr-8", invalid && "border-rc-danger focus:border-rc-danger focus:ring-rc-danger/30", className)}
        aria-invalid={invalid || undefined}
        {...props}
      >
        {children}
      </select>
    );
  },
);

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("mb-1 block text-sm font-medium text-rc-night dark:text-white/90", className)} {...props} />;
}

export function FieldError({ children }: { children?: string }) {
  if (!children) return null;
  return (
    <p role="alert" className="mt-1 text-xs font-medium text-rc-danger">
      {children}
    </p>
  );
}

export function FieldGroup({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mb-4", className)} {...props} />;
}
