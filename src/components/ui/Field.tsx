"use client";

import { useId } from "react";
import { cn } from "@/lib/cn";
import type { Icon } from "./icons";

export const inputClass =
  "w-full h-11 rounded-xl border border-subtle surface-1 px-3.5 text-sm ink-primary " +
  "placeholder:text-[var(--text-muted)] transition-colors focus:border-brand-500 " +
  "disabled:opacity-60";

export function Field({
  label,
  hint,
  error,
  required,
  children,
  className,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  required?: boolean;
  children: (id: string) => React.ReactNode;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={id} className="block text-sm font-medium ink-secondary">
        {label}
        {required && <span className="ml-0.5 text-rose-500">*</span>}
      </label>
      {children(id)}
      {error ? (
        <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>
      ) : hint ? (
        <p className="text-xs ink-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(inputClass, props.className)} />;
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(inputClass, "h-auto min-h-24 py-2.5 leading-relaxed", props.className)}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn(inputClass, "pr-8", props.className)} />;
}

/**
 * Casilla en formato tarjeta. Se usa en los bloques de "contenido relacionado":
 * ocupa poco cuando esta apagada y deja sitio a un subformulario cuando se activa.
 */
export function CheckboxCard({
  checked,
  onChange,
  icon: Glyph,
  label,
  hint,
  children,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  icon?: Icon;
  label: string;
  hint?: string;
  children?: React.ReactNode;
}) {
  const id = useId();
  return (
    <div
      className={cn(
        "rounded-xl border transition-colors",
        checked ? "border-brand-500 bg-brand-50/50 dark:bg-brand-900/20" : "border-subtle",
      )}
    >
      <label htmlFor={id} className="flex cursor-pointer items-start gap-3 px-3.5 py-3">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--brand-600,#4f46e5)]"
        />
        <span className="min-w-0">
          <span className="flex items-center gap-1.5 text-sm font-medium ink-primary">
            {Glyph && (
              <Glyph size={16} weight="fill" className="shrink-0 text-brand-500" aria-hidden />
            )}
            {label}
          </span>
          {hint && <span className="mt-0.5 block text-xs ink-muted">{hint}</span>}
        </span>
      </label>
      {checked && children && (
        <div className="space-y-4 border-t border-subtle px-3.5 py-4">{children}</div>
      )}
    </div>
  );
}
