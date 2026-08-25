"use client";

import { cn } from "@/lib/cn";

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: "neutral" | "brand" | "success" | "warning";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
        tone === "neutral" && "surface-2 ink-secondary",
        tone === "brand" && "bg-brand-100 text-brand-700 dark:bg-brand-900/60 dark:text-brand-200",
        tone === "success" && "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-200",
        tone === "warning" && "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: string; count?: number }>;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={cn("inline-flex gap-1 rounded-xl surface-2 p-1", className)}
    >
      {options.map((option) => (
        <button
          key={option.value}
          role="tab"
          aria-selected={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
            value === option.value
              ? "surface-1 ink-primary shadow-sm"
              : "ink-muted hover:ink-secondary",
          )}
        >
          {option.label}
          {option.count !== undefined && (
            <span className="ml-1.5 tabular-nums opacity-60">{option.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}

export function ProgressBar({
  value,
  total,
  label,
}: {
  value: number;
  total: number;
  label?: string;
}) {
  const pct = total > 0 ? Math.min(100, (value / total) * 100) : 0;
  return (
    <div className="space-y-1.5">
      {label && (
        <div className="flex items-baseline justify-between text-sm">
          <span className="ink-secondary">{label}</span>
          <span className="font-semibold tabular-nums ink-primary">
            {value} / {total}
          </span>
        </div>
      )}
      <div
        className="h-2 overflow-hidden rounded-full surface-2"
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={total}
      >
        <div
          className="h-full rounded-full bg-brand-500 transition-[width] duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function Rating({
  value,
  onChange,
  readOnly = false,
}: {
  value: number | null;
  onChange?: (value: number) => void;
  readOnly?: boolean;
}) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readOnly}
          onClick={() => onChange?.(star)}
          aria-label={`${star} de 5`}
          className={cn(
            "text-lg leading-none transition-transform",
            !readOnly && "hover:scale-110",
            readOnly && "cursor-default",
          )}
        >
          <span className={star <= (value ?? 0) ? "opacity-100" : "opacity-25"}>⭐</span>
        </button>
      ))}
    </div>
  );
}
