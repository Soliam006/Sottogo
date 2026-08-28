"use client";

import { useEffect, useRef, useState } from "react";
import { copyToClipboard } from "@/lib/clipboard";
import { cn } from "@/lib/cn";
import { CheckIcon, CopyIcon } from "./icons";

/**
 * Copia un texto al portapapeles y lo confirma en el propio boton.
 *
 * La confirmacion va aqui y no en un toast: el usuario esta mirando el dato que
 * acaba de copiar, y un aviso en la otra punta de la pantalla obliga a buscarlo.
 * Si la copia falla, el icono NO cambia y se avisa: nunca se dice "copiado" sin
 * haberlo comprobado.
 */
export function CopyButton({
  value,
  label,
  className,
  size = 14,
}: {
  value: string;
  /** Que se copia, para el lector de pantalla ("Copiar dirección"). */
  label: string;
  className?: string;
  size?: number;
}) {
  const [state, setState] = useState<"idle" | "done" | "failed">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  async function copy(event: React.MouseEvent) {
    // El boton puede vivir dentro de una tarjeta pulsable.
    event.preventDefault();
    event.stopPropagation();

    const done = await copyToClipboard(value);
    setState(done ? "done" : "failed");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), done ? 1600 : 2600);
  }

  return (
    <button
      type="button"
      onClick={(e) => void copy(e)}
      aria-label={state === "done" ? `${label}: copiado` : label}
      title={state === "failed" ? "No se ha podido copiar" : label}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-md p-1 transition-colors",
        state === "done"
          ? "text-emerald-600 dark:text-emerald-400"
          : state === "failed"
            ? "text-rose-600 dark:text-rose-400"
            : "ink-muted hover:ink-primary hover:surface-2",
        className,
      )}
    >
      {state === "done" ? (
        <CheckIcon size={size} weight="bold" aria-hidden />
      ) : (
        <CopyIcon size={size} weight={state === "failed" ? "bold" : "regular"} aria-hidden />
      )}
      {/* Solo para lectores de pantalla: el color y el icono ya lo dicen a la vista. */}
      <span className="sr-only" role="status">
        {state === "done" ? "Copiado" : state === "failed" ? "No se ha podido copiar" : ""}
      </span>
    </button>
  );
}
