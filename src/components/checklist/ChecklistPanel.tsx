"use client";

import { useMemo, useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import type { ChecklistItem, ChecklistList, ChecklistListKind } from "@/core/models";
import {
  itemsOfList,
  moveItemToList,
  nextListPosition,
  nextPosition,
  reorderLists,
  reorderWithinList,
  sortLists,
} from "@/core/checklist";
import { errorMessage } from "@/lib/errors";
import { getSupabaseBrowserClient } from "@/services/supabase/client";
import { checklistRepo } from "@/services/repositories";
import type { AsyncState } from "@/hooks/useAsyncData";
import { useTrip } from "@/components/providers/TripProvider";
import { useSession } from "@/components/providers/SessionProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { Button } from "@/components/ui/Button";
import { AddIcon, ChecklistIcon } from "@/components/ui/icons";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { ListCard } from "./ListCard";
import { ListDetail } from "./ListDetail";
import { ListFormModal } from "./ListFormModal";

/**
 * Apartado "Otros" de Preparacion.
 *
 * Antes era UNA checklist plana. Ahora es un tablero de listas: cada Card es
 * una lista y dentro estan sus elementos. Los elementos que ya existian no se
 * pierden: la migracion del esquema los adopta en una lista inicial.
 *
 * El estado llega por props porque `PreparationView` ya lo necesita para el
 * contador de la pestana; suscribirse dos veces duplicaria peticion y realtime.
 */
export function ChecklistPanel({
  items: itemsState,
  lists: listsState,
}: {
  items: AsyncState<ChecklistItem[]>;
  lists: AsyncState<ChecklistList[]>;
}) {
  const { trip, canEdit } = useTrip();
  const { session } = useSession();
  const { toast } = useToast();
  const [confirm, confirmDialog] = useConfirm();

  const [openId, setOpenId] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ list: ChecklistList | null } | null>(null);

  const lists = useMemo(() => sortLists(listsState.data ?? []), [listsState.data]);
  const items = useMemo(() => itemsState.data ?? [], [itemsState.data]);
  const open = lists.find((list) => list.id === openId) ?? null;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const db = () => getSupabaseBrowserClient();
  const fail = (err: unknown) => {
    toast(errorMessage(err), "error");
    void listsState.refresh();
    void itemsState.refresh();
  };

  // --- listas ---------------------------------------------------------------
  async function saveList(values: { title: string; icon: string; kind: ChecklistListKind }) {
    if (!trip || !session?.user) return;
    const target = editing?.list;

    if (target) {
      await checklistRepo.updateList(db(), target.id, values);
    } else {
      const created = await checklistRepo.createList(db(), trip.id, session.user.id, {
        ...values,
        position: nextListPosition(lists),
      });
      setOpenId(created.id);
    }
    await listsState.refresh();
  }

  async function removeList(list: ChecklistList) {
    const count = itemsOfList(items, list.id).length;
    const ok = await confirm({
      title: `Eliminar “${list.title}”`,
      body: count
        ? `Se eliminarán también sus ${count} elemento${count === 1 ? "" : "s"}. Esta acción no se puede deshacer.`
        : "Esta acción no se puede deshacer.",
    });
    if (!ok) return;

    try {
      await checklistRepo.removeList(db(), list.id);
      if (openId === list.id) setOpenId(null);
      toast("Lista eliminada", "info");
      await Promise.all([listsState.refresh(), itemsState.refresh()]);
    } catch (err) {
      fail(err);
    }
  }

  async function handleListDrag(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const moves = reorderLists(lists, String(active.id), String(over.id));
    if (!moves.length) return;

    // Optimista: el Card se queda donde lo has soltado y no da un salto
    // mientras la base de datos confirma.
    const byId = new Map(moves.map((move) => [move.id, move.position]));
    listsState.setData((prev) =>
      sortLists((prev ?? []).map((l) => (byId.has(l.id) ? { ...l, position: byId.get(l.id)! } : l))),
    );

    try {
      await checklistRepo.reorderLists(db(), moves);
    } catch (err) {
      fail(err);
    }
  }

  // --- elementos ------------------------------------------------------------
  async function addItem(listId: string, title: string) {
    if (!trip || !session?.user) return;
    try {
      await checklistRepo.create(
        db(),
        trip.id,
        session.user.id,
        listId,
        title,
        nextPosition(itemsOfList(items, listId)),
      );
      await itemsState.refresh();
    } catch (err) {
      fail(err);
    }
  }

  async function toggleItem(item: ChecklistItem) {
    itemsState.setData((prev) =>
      (prev ?? []).map((i) => (i.id === item.id ? { ...i, completed: !i.completed } : i)),
    );
    try {
      await checklistRepo.setCompleted(db(), item.id, !item.completed);
    } catch (err) {
      fail(err);
    }
  }

  async function renameItem(item: ChecklistItem, title: string) {
    itemsState.setData((prev) => (prev ?? []).map((i) => (i.id === item.id ? { ...i, title } : i)));
    try {
      await checklistRepo.rename(db(), item.id, title);
    } catch (err) {
      fail(err);
    }
  }

  async function removeItem(item: ChecklistItem) {
    itemsState.setData((prev) => (prev ?? []).filter((i) => i.id !== item.id));
    try {
      await checklistRepo.remove(db(), item.id);
    } catch (err) {
      fail(err);
    }
  }

  async function applyMoves(moves: ReturnType<typeof reorderWithinList>) {
    if (!moves.length) return;
    const byId = new Map(moves.map((move) => [move.id, move]));
    itemsState.setData((prev) =>
      (prev ?? []).map((item) => {
        const move = byId.get(item.id);
        return move ? { ...item, listId: move.listId, position: move.position } : item;
      }),
    );
    try {
      await checklistRepo.applyMoves(db(), moves);
    } catch (err) {
      fail(err);
    }
  }

  // --- render ---------------------------------------------------------------
  if ((listsState.loading && !listsState.data) || (itemsState.loading && !itemsState.data)) {
    return <LoadingState label="Cargando listas…" />;
  }

  const error = listsState.error ?? itemsState.error;

  if (open) {
    return (
      <>
        <ListDetail
          list={open}
          lists={lists}
          items={itemsOfList(items, open.id)}
          canEdit={canEdit}
          onBack={() => setOpenId(null)}
          onToggle={(item) => void toggleItem(item)}
          onAdd={(title) => addItem(open.id, title)}
          onRename={(item, title) => renameItem(item, title)}
          onRemoveItem={(item) => void removeItem(item)}
          onReorder={(fromId, toId) =>
            void applyMoves(reorderWithinList(items, open.id, fromId, toId))
          }
          onMoveToList={(itemId, listId) => void applyMoves(moveItemToList(items, itemId, listId))}
          onEditList={() => setEditing({ list: open })}
        />
        {editing && (
          <ListFormModal
            open
            list={editing.list}
            onClose={() => setEditing(null)}
            onSubmit={saveList}
          />
        )}
        {confirmDialog}
      </>
    );
  }

  return (
    <div className="space-y-4">
      {error && <ErrorState message={error} onRetry={() => void listsState.refresh()} />}

      {lists.length === 0 ? (
        <EmptyState
          icon={ChecklistIcon}
          title="Todavía no hay listas"
          description="Crea listas para lo que tengas que preparar, los sitios que quieras ver o lo que se te vaya ocurriendo."
          action={
            canEdit ? (
              <Button onClick={() => setEditing({ list: null })}>
                <AddIcon size={16} weight="bold" aria-hidden />
                Nueva lista
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={(event) => void handleListDrag(event)}
          >
            <SortableContext items={lists.map((l) => l.id)} strategy={verticalListSortingStrategy}>
              <ul className="grid gap-3 sm:grid-cols-2">
                {lists.map((list) => (
                  <li key={list.id}>
                    <ListCard
                      list={list}
                      items={itemsOfList(items, list.id)}
                      canEdit={canEdit}
                      onOpen={() => setOpenId(list.id)}
                      onEdit={() => setEditing({ list })}
                      onDelete={() => void removeList(list)}
                    />
                  </li>
                ))}
              </ul>
            </SortableContext>
          </DndContext>

          {canEdit && (
            <button
              type="button"
              onClick={() => setEditing({ list: null })}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-subtle px-4 py-3.5 text-sm font-medium ink-secondary transition-colors hover:surface-2 hover:ink-primary"
            >
              <AddIcon size={16} weight="bold" aria-hidden />
              Nueva lista
            </button>
          )}
        </>
      )}

      {editing && (
        <ListFormModal open list={editing.list} onClose={() => setEditing(null)} onSubmit={saveList} />
      )}
      {confirmDialog}
    </div>
  );
}
