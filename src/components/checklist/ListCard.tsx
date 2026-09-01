"use client";

import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { ChecklistItem, ChecklistList } from "@/core/models";
import { CARD_PREVIEW, listSummary, progressOf } from "@/core/checklist";
import { cn } from "@/lib/cn";
import { Card } from "@/components/ui/Card";
import { DeleteIcon, MoreIcon, NextIcon, VisitedIcon } from "@/components/ui/icons";
import { ListIconGlyph } from "./listIcons";
import { DragHandle } from "./DragHandle";

/**
 * Una lista, resumida.
 *
 * El Card cuenta lo justo para reconocerla de un vistazo: como va, y cuatro de
 * sus elementos. No es la lista, es su portada; lo demas esta dentro.
 */
export function ListCard({
  list,
  items,
  canEdit,
  onOpen,
  onEdit,
  onDelete,
}: {
  list: ChecklistList;
  /** Elementos de ESTA lista, ya ordenados. */
  items: ChecklistItem[];
  canEdit: boolean;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: list.id, disabled: !canEdit });

  const [menuOpen, setMenuOpen] = useState(false);
  const { done, total, complete } = progressOf(items);
  const preview = items.slice(0, CARD_PREVIEW);
  const rest = items.length - preview.length;

  return (
    // El ref y la transformacion van en un envoltorio y no en `Card`: `Card` es
    // un componente compartido y no hacia falta tocarlo para esto.
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("relative", isDragging && "z-20")}
    >
    <Card
      className={cn(
        "relative overflow-hidden",
        isDragging && "opacity-90 shadow-xl",
        complete && "border-emerald-300/70 dark:border-emerald-800/70",
      )}
    >
      {/* Toda la tarjeta abre la lista. Va debajo del contenido para no anidar
          botones dentro de un boton, que no es HTML valido. */}
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Abrir ${list.title}`}
        className="absolute inset-0 z-0 cursor-pointer"
      />

      <div className="pointer-events-none relative z-10 p-4 pr-8">
        <div className="flex items-start gap-3">
          <span
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl surface-2",
              complete ? "text-emerald-600 dark:text-emerald-400" : "text-brand-600 dark:text-brand-300",
            )}
            aria-hidden
          >
            <ListIconGlyph icon={list.icon} size={20} />
          </span>

          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold ink-primary">{list.title}</p>
            <p className="mt-0.5 flex items-center gap-1.5 text-sm ink-muted">
              {complete && (
                <VisitedIcon
                  size={14}
                  weight="fill"
                  className="shrink-0 text-emerald-600 dark:text-emerald-400"
                  aria-hidden
                />
              )}
              <span className="truncate">{listSummary(list.kind, items)}</span>
            </p>
          </div>

          {canEdit && (
            <div className="pointer-events-auto flex shrink-0 items-center gap-0.5">
              <DragHandle
                ref={setActivatorNodeRef}
                label={`Reordenar ${list.title}`}
                {...attributes}
                {...listeners}
              />
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setMenuOpen((open) => !open)}
                  aria-label={`Opciones de ${list.title}`}
                  aria-expanded={menuOpen}
                  className="rounded-lg p-1.5 ink-muted transition-colors hover:surface-2"
                >
                  <MoreIcon size={20} weight="bold" aria-hidden />
                </button>

                {menuOpen && (
                  <>
                    <button
                      className="fixed inset-0 z-10 cursor-default"
                      aria-label="Cerrar menú"
                      onClick={() => setMenuOpen(false)}
                    />
                    <div className="absolute right-0 top-9 z-20 w-44 animate-rise overflow-hidden rounded-xl border border-subtle surface-1 shadow-xl">
                      <button
                        onClick={() => {
                          setMenuOpen(false);
                          onEdit();
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm ink-primary transition-colors hover:surface-2"
                      >
                        Editar lista
                      </button>
                      <button
                        onClick={() => {
                          setMenuOpen(false);
                          onDelete();
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-rose-600 transition-colors hover:surface-2 dark:text-rose-400"
                      >
                        <DeleteIcon size={16} aria-hidden />
                        Eliminar lista
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {list.kind === "checklist" && total > 0 && (
          <div className="mt-3 h-1.5 overflow-hidden rounded-full surface-2">
            <div
              className={cn(
                "h-full rounded-full transition-[width] duration-500",
                complete ? "bg-emerald-500" : "bg-brand-500",
              )}
              style={{ width: `${(done / total) * 100}%` }}
            />
          </div>
        )}

        {preview.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {preview.map((item) => (
              <span
                key={item.id}
                className={cn(
                  "inline-flex max-w-full items-center gap-1.5 rounded-full border border-subtle px-2.5 py-1 text-xs",
                  item.completed && list.kind === "checklist"
                    ? "ink-muted line-through"
                    : "ink-secondary",
                )}
              >
                {list.kind === "checklist" ? (
                  item.completed ? (
                    <VisitedIcon
                      size={13}
                      weight="fill"
                      className="shrink-0 text-emerald-600 dark:text-emerald-400"
                      aria-hidden
                    />
                  ) : (
                    <span
                      className="h-3 w-3 shrink-0 rounded-full border border-[var(--text-muted)]"
                      aria-hidden
                    />
                  )
                ) : (
                  <ListIconGlyph icon={list.icon} size={12} className="shrink-0 ink-muted" />
                )}
                <span className="truncate">{item.title}</span>
              </span>
            ))}
            {rest > 0 && (
              <span className="rounded-full px-1.5 py-1 text-xs font-medium ink-muted tabular-nums">
                +{rest}
              </span>
            )}
          </div>
        )}

        {items.length === 0 && (
          <p className="mt-3 text-xs ink-muted">Todavía vacía. Ábrela para añadir lo primero.</p>
        )}
      </div>

      {/* Centrado en el alto de la tarjeta, no abajo: pegado al pie parecia
          parte de la fila de chips. El `pr-8` de arriba le reserva el hueco. */}
      <NextIcon
        size={18}
        weight="bold"
        className="pointer-events-none absolute right-3.5 top-1/2 z-10 -translate-y-1/2 ink-muted"
        aria-hidden
      />
    </Card>
    </div>
  );
}
