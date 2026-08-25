import type { ChecklistItem, UUID } from "@/core/models";
import { asRow, asRows, type Db, unwrap, unwrapVoid } from "./base";
import { toChecklistItem } from "@/services/mappers";

export const checklistRepo = {
  async listByTrip(db: Db, tripId: UUID): Promise<ChecklistItem[]> {
    const result = await db
      .from("checklist_items")
      .select("*")
      .eq("trip_id", tripId)
      .order("position", { ascending: true })
      .order("created_at", { ascending: true });

    return asRows(unwrap(result, "Listar checklist")).map(toChecklistItem);
  },

  async create(db: Db, tripId: UUID, userId: UUID, title: string, position: number): Promise<ChecklistItem> {
    const result = await db
      .from("checklist_items")
      .insert({ trip_id: tripId, created_by: userId, title: title.trim(), position })
      .select("*")
      .single();

    return toChecklistItem(asRow(unwrap(result, "Crear elemento")));
  },

  async setCompleted(db: Db, id: UUID, completed: boolean): Promise<void> {
    unwrapVoid(
      await db.from("checklist_items").update({ completed }).eq("id", id),
      "Actualizar checklist",
    );
  },

  async remove(db: Db, id: UUID): Promise<void> {
    unwrapVoid(await db.from("checklist_items").delete().eq("id", id), "Eliminar elemento");
  },
};
