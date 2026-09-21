import type { HTMLAttributes } from "react";
import { cn } from "./cn";

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg bg-rc-night/10 dark:bg-white/[0.06]",
        "before:absolute before:inset-0 before:-translate-x-full before:animate-shimmer",
        "before:bg-gradient-to-r before:from-transparent before:via-white/[0.07] before:to-transparent",
        className,
      )}
      aria-hidden="true"
      {...props}
    />
  );
}

export function SkeletonGrid({ count = 8, className }: { count?: number; className?: string }) {
  return (
    <div
      className={cn("grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4", className)}
      role="status"
      aria-label="Chargement en cours"
    >
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="aspect-[3/4] w-full rounded-2xl" />
      ))}
    </div>
  );
}
