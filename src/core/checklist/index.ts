/**
 * Listas de preparacion ("Otros").
 *
 * Capa pura: sin React, sin Supabase, sin dnd-kit. Aqui vive todo lo que se
 * puede razonar sin una pantalla delante —progreso, resumenes y reordenacion—
 * para poder probarlo sin montar la interfaz.
 */

import type { ChecklistItem, ChecklistList, ChecklistListKind, UUID } from "@/core/models";

/** Cuantos elementos de un Card se ensenan antes del "+N". */
export const CARD_PREVIEW = 4;

export interface ListProgress {
  done: number;
  total: number;
  /** Hay elementos y todos estan completados. */
  complete: boolean;
}

/** Elementos de una lista, en el orden que decidio el usuario. */
export function itemsOfList(items: readonly ChecklistItem[], listId: UUID): ChecklistItem[] {
  return items
    .filter((item) => item.listId === listId)
    .sort((a, b) => a.position - b.position || a.createdAt.localeCompare(b.createdAt));
}

export function progressOf(items: readonly ChecklistItem[]): ListProgress {
  const total = items.length;
  const done = items.filter((item) => item.completed).length;
  return { done, total, complete: total > 0 && done === total };
}

/**
 * La linea que resume la lista en su Card.
 *
 * Una coleccion no se completa, asi que hablar de "0 de 8" ahi seria mentir:
 * cuenta lo que guarda y ya.
 */
export function listSummary(kind: ChecklistListKind, items: readonly ChecklistItem[]): string {
  if (kind === "collection") {
    return items.length === 1 ? "1 elemento guardado" : `${items.length} elementos guardados`;
  }
  const { done, total } = progressOf(items);
  if (total === 0) return "Sin elementos";
  return `${done} de ${total} completadas`;
}

/** Siguiente posicion libre al final de una lista. */
export function nextPosition(items: readonly ChecklistItem[]): number {
  return items.reduce((max, item) => Math.max(max, item.position + 1), 0);
}

export function nextListPosition(lists: readonly ChecklistList[]): number {
  return lists.reduce((max, list) => Math.max(max, list.position + 1), 0);
}

/** Mueve un elemento de `from` a `to` devolviendo un array nuevo. */
export function arrayMove<T>(items: readonly T[], from: number, to: number): T[] {
  const next = [...items];
  if (from < 0 || from >= next.length || to < 0 || to >= next.length) return next;
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

/** `{ id, position }` de cada elemento segun su indice. Lo que se persiste. */
export function positionsOf(entities: readonly { id: UUID }[]): { id: UUID; position: number }[] {
  return entities.map((entity, index) => ({ id: entity.id, position: index }));
}

export interface ItemMove {
  id: UUID;
  listId: UUID;
  position: number;
}

/**
 * Reordena dentro de una lista y devuelve SOLO lo que hay que guardar.
 *
 * Devolver el conjunto minimo importa: reescribir la lista entera en cada
 * arrastre multiplica las filas tocadas y los eventos de tiempo real que
 * reciben los demas participantes.
 */
export function reorderWithinList(
  items: readonly ChecklistItem[],
  listId: UUID,
  fromId: UUID,
  toId: UUID,
): ItemMove[] {
  const list = itemsOfList(items, listId);
  const from = list.findIndex((item) => item.id === fromId);
  const to = list.findIndex((item) => item.id === toId);
  if (from === -1 || to === -1 || from === to) return [];

  return positionsOf(arrayMove(list, from, to))
    .filter(({ id, position }) => list.find((item) => item.id === id)?.position !== position)
    .map(({ id, position }) => ({ id, listId, position }));
}

/**
 * Mueve un elemento a otra lista: entra al final de la de destino y la de
 * origen se recompacta para no dejar huecos en las posiciones.
 */
export function moveItemToList(
  items: readonly ChecklistItem[],
  itemId: UUID,
  targetListId: UUID,
): ItemMove[] {
  const item = items.find((candidate) => candidate.id === itemId);
  if (!item || item.listId === targetListId) return [];

  const target = itemsOfList(items, targetListId);
  const moves: ItemMove[] = [
    { id: itemId, listId: targetListId, position: nextPosition(target) },
  ];

  if (item.listId) {
    const rest = itemsOfList(items, item.listId).filter((candidate) => candidate.id !== itemId);
    for (const [index, candidate] of rest.entries()) {
      if (candidate.position !== index) {
        moves.push({ id: candidate.id, listId: item.listId, position: index });
      }
    }
  }

  return moves;
}

/** Reordenacion de los Cards del tablero. */
export function reorderLists(
  lists: readonly ChecklistList[],
  fromId: UUID,
  toId: UUID,
): { id: UUID; position: number }[] {
  const ordered = sortLists(lists);
  const from = ordered.findIndex((list) => list.id === fromId);
  const to = ordered.findIndex((list) => list.id === toId);
  if (from === -1 || to === -1 || from === to) return [];

  return positionsOf(arrayMove(ordered, from, to)).filter(
    ({ id, position }) => ordered.find((list) => list.id === id)?.position !== position,
  );
}

export function sortLists(lists: readonly ChecklistList[]): ChecklistList[] {
  return [...lists].sort((a, b) => a.position - b.position || a.createdAt.localeCompare(b.createdAt));
}

/** Elementos pendientes del viaje: solo cuentan las listas que se completan. */
export function pendingCount(
  lists: readonly ChecklistList[],
  items: readonly ChecklistItem[],
): number {
  const checklists = new Set(
    lists.filter((list) => list.kind === "checklist").map((list) => list.id),
  );
  return items.filter((item) => item.listId && checklists.has(item.listId) && !item.completed)
    .length;
}
