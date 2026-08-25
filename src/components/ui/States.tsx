import { cn } from "@/lib/cn";
import { Spinner } from "./Button";

export function LoadingState({ label = "Cargando…", className }: { label?: string; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 py-16 ink-muted", className)}>
      <Spinner className="h-6 w-6" />
      <p className="text-sm">{label}</p>
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
  className,
}: {
  message: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-6 py-10 text-center",
        "dark:border-rose-900/50 dark:bg-rose-950/30",
        className,
      )}
    >
      <span className="text-2xl" aria-hidden>⚠️</span>
      <p className="text-sm text-rose-700 dark:text-rose-300">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="text-sm font-medium text-rose-700 underline underline-offset-4 dark:text-rose-300"
        >
          Reintentar
        </button>
      )}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-2xl border border-dashed border-subtle px-6 py-14 text-center",
        className,
      )}
    >
      <span className="text-4xl" aria-hidden>{icon}</span>
      <div>
        <p className="font-semibold ink-primary">{title}</p>
        {description && <p className="mt-1 max-w-sm text-sm ink-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-xl surface-2", className)} />;
}
