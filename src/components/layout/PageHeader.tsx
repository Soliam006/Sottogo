import { cn } from "@/lib/cn";

export function PageHeader({
  title,
  subtitle,
  action,
  className,
}: {
  title: string;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-3", className)}>
      <div className="min-w-0">
        <h1 className="text-2xl font-bold ink-primary">{title}</h1>
        {subtitle && <p className="mt-1 text-sm ink-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
