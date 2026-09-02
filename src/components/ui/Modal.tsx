"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";

/**
 * Dialogo responsive: hoja inferior en movil, modal centrado en desktop.
 *
 * Se pinta en un PORTAL a `document.body` a proposito. `position: fixed` no se
 * resuelve contra la pantalla si algun ancestro tiene `transform`, `filter` o
 * `backdrop-filter`: ese ancestro pasa a ser el bloque contenedor. Las barras
 * de la app usan `backdrop-blur`, asi que un modal lanzado desde la campana de
 * notificaciones quedaba encajado dentro de la cabecera y se salia de la
 * pantalla. Sacandolo del arbol, ningun ancestro puede volver a capturarlo.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "md" | "lg";
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  // El portal solo existe en el cliente: en el render del servidor no hay body.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!open || !mounted) return null;

  return createPortal(
    /*
     * Escalera de capas (todas portadas a <body>, asi que mandan estos numeros):
     *   40   cabecera y navegacion inferior
     *   300  PhotoLightbox
     *   400  Modal  <- aqui
     *   999  avisos (ToastProvider)
     *
     * El modal va POR ENCIMA del visor y no al reves: tanto la confirmacion de
     * borrado como "Hacer algo mas" se abren DESDE el visor, con la foto aun
     * abierta. Con z-[200] quedaban detras y parecia que no pasaba nada.
     */
    <div className="fixed inset-0 z-[400] flex items-end justify-center sm:items-center sm:p-4">
      <div
        className="absolute inset-0 animate-fade bg-black/45 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          // `dvh` y no `vh`: en movil la barra de URL cambia el alto y con `vh`
          // el pie del modal quedaba fuera de la pantalla.
          "relative flex max-h-[92dvh] w-full animate-rise flex-col overflow-hidden surface-1",
          "rounded-t-3xl border border-subtle shadow-2xl sm:rounded-3xl",
          size === "lg" ? "sm:max-w-2xl" : "sm:max-w-lg",
        )}
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-subtle px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold ink-primary">{title}</h2>
            {description && <p className="mt-0.5 text-sm ink-muted">{description}</p>}
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="-mr-1 rounded-lg p-1.5 ink-muted transition-colors hover:surface-2"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Unico scroll del modal. `overscroll-contain` evita que al llegar al
            final arrastre tambien la pagina de detras. */}
        <div className="app-scroll-y min-h-0 flex-1 px-5 py-5">{children}</div>

        {footer && (
          <div className="safe-bottom flex shrink-0 flex-wrap justify-end gap-2 border-t border-subtle px-5 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
