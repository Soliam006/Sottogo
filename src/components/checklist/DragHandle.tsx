"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/cn";

/**
 * Asa de arrastre.
 *
 * Existe para que arrastrar y marcar no compitan: el resto de la fila responde
 * al toque como siempre y solo esta zona inicia el arrastre. `touch-none`
 * unicamente aqui, para no robarle el scroll vertical a la pagina en movil.
 */
export const DragHandle = forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }
>(function DragHandle({ label, className, ...props }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      className={cn(
        "flex h-9 w-8 shrink-0 cursor-grab touch-none items-center justify-center rounded-lg",
        "ink-muted transition-colors hover:surface-2 active:cursor-grabbing",
        className,
      )}
      {...props}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
        <circle cx="6" cy="4" r="1.4" />
        <circle cx="10" cy="4" r="1.4" />
        <circle cx="6" cy="8" r="1.4" />
        <circle cx="10" cy="8" r="1.4" />
        <circle cx="6" cy="12" r="1.4" />
        <circle cx="10" cy="12" r="1.4" />
      </svg>
    </button>
  );
});
