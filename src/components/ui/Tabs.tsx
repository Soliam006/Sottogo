"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";
import type { Icon } from "./icons";

export interface TabOption<T extends string> {
  value: T;
  label: string;
  Icon?: Icon;
  /** Contador opcional (nº de vuelos, de hoteles…). */
  count?: number;
  /**
   * Seguro de la pestana: `true` la retira de la barra.
   *
   * Sirve para no ensenar apartados que no aportan nada a quien mira. Un
   * visitante, por ejemplo, no gana nada con un dia vacio del itinerario: no
   * puede anadir actividades, asi que esa pestana solo le hace ruido.
   */
  hidden?: boolean;
}

/**
 * Pestanas de seccion.
 *
 * A diferencia de `SegmentedControl` (que es un filtro compacto), esto navega
 * entre apartados con contenido propio: pestanas mas grandes, con icono y
 * contador, y subrayado en la activa.
 *
 * En movil la barra hace scroll horizontal en vez de comprimir las pestanas:
 * con cuatro apartados a 320 px, encogerlas las dejaria ilegibles.
 */
export function Tabs<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  options: TabOption<T>[];
  className?: string;
}) {
  const barRef = useRef<HTMLDivElement | null>(null);
  const visible = options.filter((option) => !option.hidden);

  // Con la barra desplazada, la pestana activa puede quedar fuera de vista (al
  // volver a la seccion, o al cambiarla desde fuera). Se trae sola.
  useEffect(() => {
    const active = barRef.current?.querySelector<HTMLElement>('[aria-selected="true"]');
    active?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [value]);

  return (
    <div
      ref={barRef}
      role="tablist"
      aria-orientation="horizontal"
      className={cn(
        "app-scroll-x no-scrollbar -mx-1 flex gap-1 border-b border-subtle px-1",
        className,
      )}
    >
      {visible.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "relative flex shrink-0 items-center gap-2 whitespace-nowrap px-3 py-2.5 text-sm font-medium transition-colors",
              "after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded-full",
              active
                ? "ink-primary after:bg-brand-600 dark:after:bg-brand-400"
                : "ink-muted hover:ink-secondary after:bg-transparent",
            )}
          >
            {option.Icon && (
              <option.Icon
                size={18}
                weight={active ? "fill" : "regular"}
                className={active ? "text-brand-600 dark:text-brand-400" : undefined}
                aria-hidden
              />
            )}
            {option.label}
            {option.count !== undefined && option.count > 0 && (
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
                  active ? "bg-brand-100 text-brand-700 dark:bg-brand-900/60 dark:text-brand-200" : "surface-2",
                )}
              >
                {option.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
