"use client";

import { useEffect, useRef } from "react";
import { Spinner } from "./Button";

/**
 * Final de una lista paginada: pide el lote siguiente al llegar hasta el.
 *
 * Sin `rootMargin` a proposito. Con margen se adelanta y trae cosas que aun no
 * se ven, que es trabajo y trafico que quiza nadie iba a mirar. Asi el lote
 * siguiente entra cuando de verdad se acaba lo que hay.
 *
 * Se ensena la rueda directamente y no un boton: llegar aqui ES lo que dispara
 * la carga, asi que entre que aparece y empieza no hay hueco que merezca otro
 * estado.
 */
export function LoadMore({
  hasMore,
  count,
  onLoadMore,
  label = "Cargando más…",
}: {
  hasMore: boolean;
  /**
   * Cuantos elementos hay cargados. Vuelve a montar el observador cuando la
   * lista crece: si la pantalla es mas alta que el contenido, el centinela
   * sigue visible despues de cargar y el observador no volveria a avisar,
   * porque solo notifica los CAMBIOS de visibilidad.
   */
  count: number;
  onLoadMore: () => void;
  label?: string;
}) {
  const sentinel = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = sentinel.current;
    if (!node || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => entries[0]?.isIntersecting && onLoadMore(),
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, onLoadMore, count]);

  if (!hasMore) return null;

  return (
    <div
      ref={sentinel}
      className="flex items-center justify-center gap-2 py-8 ink-muted"
      role="status"
      aria-live="polite"
    >
      <Spinner className="h-5 w-5" />
      <span className="text-sm">{label}</span>
    </div>
  );
}
