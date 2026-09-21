import type { ReactNode } from "react";
import { cn } from "./cn";

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed border-rc-night/15 px-6 py-12 text-center dark:border-white/15",
        className,
      )}
    >
      {icon && (
        <div className="mb-3 text-4xl" aria-hidden="true">
          {icon}
        </div>
      )}
      <p className="text-base font-semibold text-rc-night dark:text-white">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-rc-night/60 dark:text-white/60">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({
  title = "Une erreur est survenue",
  description,
  action,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-rc-danger/30 bg-rc-danger/5 px-6 py-10 text-center">
      <div className="mb-2 text-3xl" aria-hidden="true">
        ⚠️
      </div>
      <p className="text-base font-semibold text-rc-danger">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-rc-night/70 dark:text-white/70">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
