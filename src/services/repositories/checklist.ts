import type { ChecklistItem, ChecklistList, ChecklistListKind, UUID } from "@/core/models";
import type { ItemMove } from "@/core/checklist";
import { asRow, asRows, type Db, unwrap, unwrapVoid } from "./base";
import { toChecklistItem, toChecklistList } from "@/services/mappers";

export interface ChecklistListInput {
  title: string;
  icon: string;
  kind: ChecklistListKind;
  position: number;
}

export const checklistRepo = {
  // --- LISTAS --------------------------------------------------------------
  async listsByTrip(db: Db, tripId: UUID): Promise<ChecklistList[]> {
    const result = await db
      .from("checklist_lists")
      .select("*")
      .eq("trip_id", tripId)
      .order("position", { ascending: true })
      .order("created_at", { ascending: true });

    return asRows(unwrap(result, "Listar listas")).map(toChecklistList);
  },

  async createList(
    db: Db,
    tripId: UUID,
    userId: UUID,
    input: ChecklistListInput,
  ): Promise<ChecklistList> {
    const result = await db
      .from("checklist_lists")
      .insert({
        trip_id: tripId,
        created_by: userId,
        title: input.title.trim(),
        icon: input.icon,
        kind: input.kind,
        position: input.position,
      })
      .select("*")
      .single();

    return toChecklistList(asRow(unwrap(result, "Crear lista")));
  },

  async updateList(
    db: Db,
    id: UUID,
    patch: Partial<Pick<ChecklistListInput, "title" | "icon" | "kind">>,
  ): Promise<ChecklistList> {
    const payload: Record<string, unknown> = {};
    if (patch.title !== undefined) payload.title = patch.title.trim();
    if (patch.icon !== undefined) payload.icon = patch.icon;
    if (patch.kind !== undefined) payload.kind = patch.kind;

    const result = await db
      .from("checklist_lists")
      .update(payload)
      .eq("id", id)
      .select("*")
      .single();

    return toChecklistList(asRow(unwrap(result, "Actualizar lista")));
  },

  /** Borra la lista. Sus elementos caen con ella (`on delete cascade`). */
  async removeList(db: Db, id: UUID): Promise<void> {
    unwrapVoid(await db.from("checklist_lists").delete().eq("id", id), "Eliminar lista");
  },

  /**
   * Guarda el orden de los Cards.
   *
   * Son actualizaciones sueltas y no un `upsert` en bloque a proposito: un
   * upsert tendria que enviar tambien las columnas obligatorias de cada fila
   * (titulo, viaje) y una equivocacion insertaria en lugar de actualizar. Las
   * llamadas son pocas porque el nucleo devuelve solo las filas que cambian.
   */
  async reorderLists(db: Db, moves: readonly { id: UUID; position: number }[]): Promise<void> {
    await Promise.all(
      moves.map(async (move) =>
        unwrapVoid(
          await db.from("checklist_lists").update({ position: move.position }).eq("id", move.id),
          "Reordenar listas",
        ),
      ),
    );
  },

  // --- ELEMENTOS -----------------------------------------------------------
  async listByTrip(db: Db, tripId: UUID): Promise<ChecklistItem[]> {
    const result = await db
      .from("checklist_items")
      .select("*")
      .eq("trip_id", tripId)
      .order("position", { ascending: true })
      .order("created_at", { ascending: true });

    return asRows(unwrap(result, "Listar checklist")).map(toChecklistItem);
  },

  async create(
    db: Db,
    tripId: UUID,
    userId: UUID,
    listId: UUID,
    title: string,
    position: number,
  ): Promise<ChecklistItem> {
    const result = await db
      .from("checklist_items")
      .insert({
        trip_id: tripId,
        list_id: listId,
        created_by: userId,
        title: title.trim(),
        position,
      })
      .select("*")
      .single();

    return toChecklistItem(asRow(unwrap(result, "Crear elemento")));
  },

  async rename(db: Db, id: UUID, title: string): Promise<void> {
    unwrapVoid(
      await db.from("checklist_items").update({ title: title.trim() }).eq("id", id),
      "Renombrar elemento",
    );
  },

  async setCompleted(db: Db, id: UUID, completed: boolean): Promise<void> {
    unwrapVoid(
      await db.from("checklist_items").update({ completed }).eq("id", id),
      "Actualizar checklist",
    );
  },

  /** Aplica reordenaciones y cambios de lista. Ver `reorderLists`. */
  async applyMoves(db: Db, moves: readonly ItemMove[]): Promise<void> {
    await Promise.all(
      moves.map(async (move) =>
        unwrapVoid(
          await db
            .from("checklist_items")
            .update({ list_id: move.listId, position: move.position })
            .eq("id", move.id),
          "Mover elemento",
        ),
      ),
    );
  },

  async remove(db: Db, id: UUID): Promise<void> {
    unwrapVoid(await db.from("checklist_items").delete().eq("id", id), "Eliminar elemento");
  },
};
