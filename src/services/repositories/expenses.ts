import type { Expense, ExpenseCategory, UUID } from "@/core/models";
import { asRow, asRows, type Db, unwrap, unwrapVoid } from "./base";
import { toExpense } from "@/services/mappers";

const EXPENSE_SELECT = "*, trip_place:trip_places(*, place:places(*))";

export interface ExpenseInput {
  amount: number;
  currency: string;
  convertedAmount: number | null;
  exchangeRate: number | null;
  description: string;
  category: ExpenseCategory;
  paidBy: UUID;
  tripPlaceId: UUID | null;
  photoId: UUID | null;
  date: string;
}

export const expensesRepo = {
  async listByTrip(db: Db, tripId: UUID): Promise<Expense[]> {
    const result = await db
      .from("expenses")
      .select(EXPENSE_SELECT)
      .eq("trip_id", tripId)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });

    return asRows(unwrap(result, "Listar gastos")).map(toExpense);
  },

  async create(db: Db, tripId: UUID, userId: UUID, input: ExpenseInput): Promise<Expense> {
    const result = await db
      .from("expenses")
      .insert({
        trip_id: tripId,
        created_by: userId,
        paid_by: input.paidBy,
        amount: input.amount,
        currency: input.currency,
        converted_amount: input.convertedAmount,
        exchange_rate: input.exchangeRate,
        description: input.description.trim(),
        category: input.category,
        trip_place_id: input.tripPlaceId,
        photo_id: input.photoId,
        date: input.date,
      })
      .select(EXPENSE_SELECT)
      .single();

    return toExpense(asRow(unwrap(result, "Crear gasto")));
  },

  async update(db: Db, expenseId: UUID, input: Partial<ExpenseInput>): Promise<Expense> {
    const payload: Record<string, unknown> = {};
    if (input.amount !== undefined) payload.amount = input.amount;
    if (input.currency !== undefined) payload.currency = input.currency;
    if (input.convertedAmount !== undefined) payload.converted_amount = input.convertedAmount;
    if (input.exchangeRate !== undefined) payload.exchange_rate = input.exchangeRate;
    if (input.description !== undefined) payload.description = input.description.trim();
    if (input.category !== undefined) payload.category = input.category;
    if (input.paidBy !== undefined) payload.paid_by = input.paidBy;
    if (input.tripPlaceId !== undefined) payload.trip_place_id = input.tripPlaceId;
    if (input.photoId !== undefined) payload.photo_id = input.photoId;
    if (input.date !== undefined) payload.date = input.date;

    const result = await db
      .from("expenses")
      .update(payload)
      .eq("id", expenseId)
      .select(EXPENSE_SELECT)
      .single();

    return toExpense(asRow(unwrap(result, "Actualizar gasto")));
  },

  async remove(db: Db, expenseId: UUID): Promise<void> {
    unwrapVoid(await db.from("expenses").delete().eq("id", expenseId), "Eliminar gasto");
  },
};
