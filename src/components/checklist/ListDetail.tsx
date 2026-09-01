"use client";

import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { ChecklistItem, ChecklistList } from "@/core/models";
import { listSummary, progressOf } from "@/core/checklist";
import { cn } from "@/lib/cn";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { TextInput } from "@/components/ui/Field";
import { BackIcon, DeleteIcon, MoreIcon, NextIcon, VisitedIcon } from "@/components/ui/icons";
import { ListIconGlyph } from "./listIcons";
import { DragHandle } from "./DragHandle";

/** Prefijo de los destinos "mover a otra lista" para distinguirlos al soltar. */
const MOVE_PREFIX = "move:";

/**
 * Una lista abierta.
 *
 * El orden lo manda el usuario y no se toca: los completados NO suben ni bajan
 * solos. Si alguien pone el pasaporte el tercero, se queda el tercero.
 */
export function ListDetail({
  list,
  lists,
  items,
  canEdit,
  onBack,
  onToggle,
  onAdd,
  onRename,
  onRemoveItem,
  onReorder,
  onMoveToList,
  onEditList,
}: {
  list: ChecklistList;
  /** Todas las listas del viaje: las demas son destino al arrastrar. */
  lists: ChecklistList[];
  items: ChecklistItem[];
  canEdit: boolean;
  onBack: () => void;
  onToggle: (item: ChecklistItem) => void;
  onAdd: (title: string) => Promise<void>;
  onRename: (item: ChecklistItem, title: string) => Promise<void>;
  onRemoveItem: (item: ChecklistItem) => void;
  onReorder: (fromId: string, toId: string) => void;
  onMoveToList: (itemId: string, listId: string) => void;
  onEditList: () => void;
}) {
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [dragging, setDragging] = useState<string | null>(null);

  const { done, total, complete } = progressOf(items);
  const others = useMemo(() => lists.filter((l) => l.id !== list.id), [lists, list.id]);

  const sensors = useSensors(
    // Un poco de recorrido antes de empezar a arrastrar: sin esto, un toque en
    // el asa se interpreta como arrastre y se come el clic.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  async function add() {
    if (title.trim().length < 2) return;
    setSaving(true);
    try {
      await onAdd(title.trim());
      setTitle("");
    } finally {
      setSaving(false);
    }
  }

  function handleStart(event: DragStartEvent) {
    setDragging(String(event.active.id));
  }

  function handleEnd(event: DragEndEvent) {
    setDragging(null);
    const { active, over } = event;
    if (!over) return;

    const overId = String(over.id);
    if (overId.startsWith(MOVE_PREFIX)) {
      onMoveToList(String(active.id), overId.slice(MOVE_PREFIX.length));
      return;
    }
    if (overId !== String(active.id)) onReorder(String(active.id), overId);
  }

  const active = dragging ? items.find((item) => item.id === dragging) : null;

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <button
          onClick={onBack}
          className="mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-sm font-medium ink-secondary transition-colors hover:surface-2"
        >
          <BackIcon size={14} weight="bold" aria-hidden />
          Otros
        </button>
      </div>

      <Card className="p-5">
        <div className="flex items-start gap-3">
          <span
            className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl surface-2",
              complete ? "text-emerald-600 dark:text-emerald-400" : "text-brand-600 dark:text-brand-300",
            )}
            aria-hidden
          >
            <ListIconGlyph icon={list.icon} size={22} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-bold ink-primary">{list.title}</h2>
            <p className="mt-0.5 flex items-center gap-1.5 text-sm ink-muted">
              {complete && (
                <VisitedIcon
                  size={14}
                  weight="fill"
                  className="shrink-0 text-emerald-600 dark:text-emerald-400"
                  aria-hidden
                />
              )}
              {listSummary(list.kind, items)}
            </p>
          </div>
          {canEdit && (
            <Button variant="ghost" size="sm" onClick={onEditList}>
              Editar
            </Button>
          )}
        </div>

        {list.kind === "checklist" && total > 0 && (
          <div className="mt-4 h-2 overflow-hidden rounded-full surface-2">
            <div
              className={cn(
                "h-full rounded-full transition-[width] duration-500",
                complete ? "bg-emerald-500" : "bg-brand-500",
              )}
              style={{ width: `${(done / total) * 100}%` }}
            />
          </div>
        )}

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleStart}
          onDragEnd={handleEnd}
          onDragCancel={() => setDragging(null)}
        >
          <SortableContext items={items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
            <ul className="mt-4 divide-y divide-[var(--border-subtle)]">
              {items.map((item) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  kind={list.kind}
                  canEdit={canEdit}
                  targets={others}
                  onToggle={() => onToggle(item)}
                  onRename={(next) => onRename(item, next)}
                  onRemove={() => onRemoveItem(item)}
                  onMoveTo={(listId) => onMoveToList(item.id, listId)}
                />
              ))}
            </ul>
          </SortableContext>

          {/* Solo aparece mientras se arrastra: el resto del tiempo estorbaria. */}
          {dragging && others.length > 0 && (
            <div className="sticky bottom-2 z-30 mt-4">
              <div className="rounded-2xl border border-subtle surface-1 p-3 shadow-xl">
                <p className="px-1 text-xs font-medium uppercase tracking-wide ink-muted">
                  Soltar en otra lista
                </p>
                <div className="app-scroll-x no-scrollbar mt-2 flex gap-2">
                  {others.map((target) => (
                    <MoveTarget key={target.id} list={target} />
                  ))}
                </div>
              </div>
            </div>
          )}

          <DragOverlay>
            {active && (
              <div className="rounded-xl border border-subtle surface-1 px-3 py-2.5 text-sm font-medium ink-primary shadow-xl">
                {active.title}
              </div>
            )}
          </DragOverlay>
        </DndContext>

        {items.length === 0 && (
          <p className="mt-4 text-sm ink-muted">
            Esta lista está vacía. Escribe abajo lo primero que quieras guardar.
          </p>
        )}

        {canEdit && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void add();
            }}
            className="mt-5 flex gap-2"
          >
            <TextInput
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Añadir elemento…"
              maxLength={80}
            />
            <Button type="submit" loading={saving} disabled={title.trim().length < 2}>
              Añadir
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}

/** Chip de destino: se ilumina cuando el elemento esta justo encima. */
function MoveTarget({ list }: { list: ChecklistList }) {
  const { setNodeRef, isOver } = useDroppable({ id: `${MOVE_PREFIX}${list.id}` });

  return (
    <span
      ref={setNodeRef}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-2 text-sm transition-colors",
        isOver
          ? "border-brand-500 bg-brand-50 font-medium text-brand-700 dark:bg-brand-900/40 dark:text-brand-200"
          : "border-subtle ink-secondary",
      )}
    >
      <ListIconGlyph icon={list.icon} size={15} />
      <span className="max-w-[9rem] truncate">{list.title}</span>
    </span>
  );
}

function ItemRow({
  item,
  kind,
  canEdit,
  targets,
  onToggle,
  onRename,
  onRemove,
  onMoveTo,
}: {
  item: ChecklistItem;
  kind: ChecklistList["kind"];
  canEdit: boolean;
  /** Las demas listas del viaje, destino de "Mover a...". */
  targets: ChecklistList[];
  onToggle: () => void;
  onRename: (title: string) => Promise<void>;
  onRemove: () => void;
  onMoveTo: (listId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id, disabled: !canEdit });

  const [menuOpen, setMenuOpen] = useState(false);
  const [moving, setMoving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.title);

  function closeMenu() {
    setMenuOpen(false);
    setMoving(false);
  }

  async function commit() {
    const next = draft.trim();
    setEditing(false);
    if (next.length < 2 || next === item.title) return setDraft(item.title);
    await onRename(next);
  }

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "group flex items-center gap-2 py-2",
        isDragging && "relative z-10 rounded-xl opacity-60 surface-2",
      )}
    >
      {canEdit && (
        <DragHandle ref={setActivatorNodeRef} label={`Mover ${item.title}`} {...attributes} {...listeners} />
      )}

      {kind === "checklist" ? (
        <input
          type="checkbox"
          checked={item.completed}
          onChange={onToggle}
          disabled={!canEdit}
          className="h-5 w-5 shrink-0 accent-[var(--color-brand-600)]"
          aria-label={item.title}
        />
      ) : (
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--text-muted)]" aria-hidden />
      )}

      {editing ? (
        <TextInput
          value={draft}
          autoFocus
          maxLength={80}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => void commit()}
          onKeyDown={(e) => {
            if (e.key === "Enter") void commit();
            if (e.key === "Escape") {
              setDraft(item.title);
              setEditing(false);
            }
          }}
        />
      ) : (
        <button
          type="button"
          onClick={kind === "checklist" && canEdit ? onToggle : undefined}
          className={cn(
            "min-w-0 flex-1 truncate text-left text-sm",
            item.completed && kind === "checklist" ? "line-through ink-muted" : "ink-primary",
            kind !== "checklist" && "cursor-default",
          )}
        >
          {item.title}
        </button>
      )}

      {canEdit && !editing && (
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label={`Opciones de ${item.title}`}
            aria-expanded={menuOpen}
            className="rounded-lg p-1.5 ink-muted transition-colors hover:surface-2"
          >
            <MoreIcon size={18} weight="bold" aria-hidden />
          </button>

          {menuOpen && (
            <>
              <button
                className="fixed inset-0 z-10 cursor-default"
                aria-label="Cerrar menú"
                onClick={closeMenu}
              />
              <div className="absolute right-0 top-9 z-20 w-52 animate-rise overflow-hidden rounded-xl border border-subtle surface-1 shadow-xl">
                {moving ? (
                  /* Arrastrar no siempre es comodo (ni posible con teclado):
                     el mismo movimiento tambien vive aqui. */
                  <>
                    <button
                      onClick={() => setMoving(false)}
                      className="flex w-full items-center gap-1.5 border-b border-subtle px-3 py-2 text-left text-xs font-medium uppercase tracking-wide ink-muted transition-colors hover:surface-2"
                    >
                      <BackIcon size={12} weight="bold" aria-hidden />
                      Mover a
                    </button>
                    <div className="app-scroll-y max-h-52">
                      {targets.map((target) => (
                        <button
                          key={target.id}
                          onClick={() => {
                            closeMenu();
                            onMoveTo(target.id);
                          }}
                          className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm ink-primary transition-colors hover:surface-2"
                        >
                          <ListIconGlyph icon={target.icon} size={15} className="shrink-0 ink-muted" />
                          <span className="min-w-0 truncate">{target.title}</span>
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => {
                        closeMenu();
                        setDraft(item.title);
                        setEditing(true);
                      }}
                      className="flex w-full items-center px-3 py-2.5 text-left text-sm ink-primary transition-colors hover:surface-2"
                    >
                      Editar
                    </button>
                    {targets.length > 0 && (
                      <button
                        onClick={() => setMoving(true)}
                        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm ink-primary transition-colors hover:surface-2"
                      >
                        Mover a otra lista
                        <NextIcon size={14} weight="bold" className="shrink-0 ink-muted" aria-hidden />
                      </button>
                    )}
                    <button
                      onClick={() => {
                        closeMenu();
                        onRemove();
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-rose-600 transition-colors hover:surface-2 dark:text-rose-400"
                    >
                      <DeleteIcon size={15} aria-hidden />
                      Eliminar
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </li>
  );
}
