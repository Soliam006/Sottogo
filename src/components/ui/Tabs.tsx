"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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

/** Ancho del degradado de los bordes. Tambien separa la pestana activa de el. */
const FADE = "1.5rem";

/**
 * Pestanas de seccion.
 *
 * A diferencia de `SegmentedControl` (que es un filtro compacto), esto navega
 * entre apartados con contenido propio: pestanas mas grandes, con icono y
 * contador, y subrayado en la activa.
 *
 * La barra hace scroll horizontal en vez de comprimir las pestanas: con
 * veintiun dias de viaje, encogerlas las dejaria ilegibles. Eso obliga a
 * resolver dos cosas que el scroll horizontal no trae de serie:
 *
 *   1. Con raton no se podia mover. El dedo arrastra y el trackpad desliza en
 *      horizontal, pero una rueda solo gira en vertical: en un PC la barra se
 *      quedaba quieta salvo con las flechas del teclado. Aqui la rueda mueve
 *      la barra.
 *   2. No se veia que hubiera mas. Cortada a hueso contra el borde, la barra
 *      parece terminar ahi, y un viaje de veintiun dias aparenta tener cuatro.
 *      Los degradados de los extremos dicen que la lista sigue.
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

  // Que extremos tienen pestanas fuera de vista. Solo se difumina ese lado:
  // un degradado en el borde por el que ya no hay nada mas seria mentira.
  const [overflow, setOverflow] = useState({ start: false, end: false });

  const measure = useCallback(() => {
    const bar = barRef.current;
    if (!bar) return;
    const max = bar.scrollWidth - bar.clientWidth;
    // El margen de 1px cubre el redondeo del zoom del navegador, que deja
    // scrollLeft en 0.4 o en max - 0.6 y encenderia el degradado sin motivo.
    setOverflow({ start: bar.scrollLeft > 1, end: bar.scrollLeft < max - 1 });
  }, []);

  useEffect(() => {
    const bar = barRef.current;
    if (!bar) return;
    measure();
    bar.addEventListener("scroll", measure, { passive: true });
    // La barra cambia de ancho sin que cambie ninguna prop: al girar el movil,
    // al abrir el sidebar en escritorio, al redimensionar la ventana.
    const observer = new ResizeObserver(measure);
    observer.observe(bar);
    return () => {
      bar.removeEventListener("scroll", measure);
      observer.disconnect();
    };
  }, [measure, visible.length]);

  // Rueda vertical -> desplazamiento horizontal.
  //
  // A mano y no con `onWheel`: React engancha `wheel` en la raiz y en modo
  // pasivo, asi que dentro del manejador de React `preventDefault` no hace
  // nada y la pagina se movia igual.
  useEffect(() => {
    const bar = barRef.current;
    if (!bar) return;

    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey) return; // zoom del navegador
      // Un trackpad ya manda deltaX cuando el gesto es horizontal: ahi el
      // navegador lo hace mejor solo.
      if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;

      const max = bar.scrollWidth - bar.clientWidth;
      if (max <= 0) return;

      // Firefox mide en lineas, no en pixeles: sin esto la barra apenas se
      // movia un pelo por muesca de rueda.
      const step = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY;

      // En el extremo, la rueda vuelve a ser de la pagina. Sin esto, el
      // puntero sobre la barra dejaba la pantalla clavada.
      //
      // El margen de 1px no es cosmetico: con la barra al final, `scrollLeft`
      // se queda en 1155 contra un maximo de 1156 por el subpixel, y sin el
      // margen la comparacion nunca daba por alcanzado el extremo.
      if (step < 0 && bar.scrollLeft <= 1) return;
      if (step > 0 && bar.scrollLeft >= max - 1) return;

      event.preventDefault();
      bar.scrollLeft += step;
    };

    bar.addEventListener("wheel", onWheel, { passive: false });
    return () => bar.removeEventListener("wheel", onWheel);
  }, []);

  // Con la barra desplazada, la pestana activa puede quedar fuera de vista (al
  // volver a la seccion, o al cambiarla desde fuera). Se trae sola; el
  // `scroll-padding` de la barra la deja fuera del degradado.
  useEffect(() => {
    const active = barRef.current?.querySelector<HTMLElement>('[aria-selected="true"]');
    active?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [value]);

  const mask =
    `linear-gradient(to right, ${overflow.start ? "transparent" : "#000"} 0,` +
    ` #000 ${FADE}, #000 calc(100% - ${FADE}),` +
    ` ${overflow.end ? "transparent" : "#000"} 100%)`;

  return (
    <div
      ref={barRef}
      role="tablist"
      aria-orientation="horizontal"
      className={cn(
        "app-scroll-x no-scrollbar -mx-1 flex gap-1 border-b border-subtle px-1",
        className,
      )}
      style={{ scrollPaddingInline: FADE, maskImage: mask, WebkitMaskImage: mask }}
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
