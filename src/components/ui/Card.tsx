import { cn } from "@/lib/cn";

export function Card({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "surface-1 border border-subtle rounded-2xl shadow-[0_1px_2px_rgb(0_0_0/0.04)]",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
  className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-3 px-5 pt-5", className)}>
      <div className="min-w-0">
        <h2 className="text-base font-semibold ink-primary">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm ink-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
