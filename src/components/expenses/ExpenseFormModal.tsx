"use client";

import { useEffect, useState } from "react";
import type { Expense, Photo, TripPlace } from "@/core/models";
import { CURRENCIES } from "@/core/currency";
import { EXPENSE_CATEGORIES } from "@/core/expenses/categories";
import type { ExpenseCategory } from "@/core/models";
import { todayISO } from "@/lib/format";
import { errorMessage } from "@/lib/errors";
import { getSupabaseBrowserClient } from "@/services/supabase/client";
import { expensesRepo } from "@/services/repositories";
import {
  convertToBase,
  createRelatedContent,
  ensureSharedPhoto,
  photoMeta,
  type RelatedContext,
} from "@/services/content/relatedContent";
import {
  emptyRelatedDraft,
  validateRelatedDraft,
  type RelatedDraft,
  type RelatedTarget,
} from "@/core/content/related";
import { useTrip } from "@/components/providers/TripProvider";
import { useSession } from "@/components/providers/SessionProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { Modal } from "@/components/ui/Modal";
import { PlaceIcon } from "@/components/ui/icons";
import { Button } from "@/components/ui/Button";
import { Field, Select, TextInput } from "@/components/ui/Field";
import { CategoryIcon } from "@/components/ui/iconFor";
import { PlacePicker } from "@/components/places/PlacePicker";
import { RelatedContentSection } from "@/components/content/RelatedContentSection";

/** Lo que este modal puede crear ademas del propio gasto. */
const EXPENSE_RELATED: readonly RelatedTarget[] = ["gallery", "moment"];

/**
 * Alta de gasto. El importe se guarda en su moneda original y ademas se
 * congela su equivalente en la moneda base del viaje (con la tasa aplicada),
 * para que los balances no dependan de una API externa a posteriori.
 */
export function ExpenseFormModal({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: (expense: Expense) => void;
}) {
  const { trip, members } = useTrip();
  const { session } = useSession();
  const { toast } = useToast();

  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState(trip?.baseCurrency ?? "EUR");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<ExpenseCategory>("food");
  const [paidBy, setPaidBy] = useState(session?.user?.id ?? "");
  const [date, setDate] = useState(todayISO());
  const [tripPlace, setTripPlace] = useState<TripPlace | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [pickingPlace, setPickingPlace] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [related, setRelated] = useState<RelatedDraft>(() =>
    emptyRelatedDraft({
      date: todayISO(),
      currency: trip?.baseCurrency ?? "EUR",
      paidBy: session?.user?.id ?? "",
    }),
  );

  useEffect(() => {
    if (!open) return;
    setCurrency(trip?.baseCurrency ?? "EUR");
    setPaidBy(session?.user?.id ?? "");
    setDate(trip && todayISO() < trip.startDate ? trip.startDate : todayISO());
  }, [open, trip, session?.user?.id]);

  // Solo al abrir: `trip` cambia con cada refresco en tiempo real y no debe
  // borrar el subformulario del momento relacionado a medio rellenar.
  useEffect(() => {
    if (!open) return;
    setRelated(
      emptyRelatedDraft({
        date: todayISO(),
        currency: trip?.baseCurrency ?? "EUR",
        paidBy: session?.user?.id ?? "",
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function reset() {
    setAmount("");
    setDescription("");
    setCategory("food");
    setTripPlace(null);
    setFile(null);
    setError(null);
  }

  async function submit() {
    setError(null);

    const value = Number(amount.replace(",", "."));
    if (!Number.isFinite(value) || value <= 0) return setError("Introduce un importe válido.");
    if (description.trim().length < 2) return setError("Añade una descripción.");
    if (!trip || !session?.user) return;

    const relatedProblem = file ? validateRelatedDraft(related, EXPENSE_RELATED) : null;
    if (relatedProblem) return setError(relatedProblem);

    setSaving(true);
    try {
      const db = getSupabaseBrowserClient();
      const ctx: RelatedContext = {
        tripId: trip.id,
        userId: session.user.id,
        baseCurrency: trip.baseCurrency,
      };

      // 1. Conversion a la moneda base (si procede).
      let convertedAmount: number | null = null;
      let exchangeRate: number | null = null;
      try {
        const amounts = await convertToBase(value, currency, trip.baseCurrency);
        convertedAmount = amounts.convertedAmount;
        exchangeRate = amounts.exchangeRate;
      } catch (err) {
        setSaving(false);
        setError(errorMessage(err, "No se ha podido obtener el tipo de cambio."));
        return;
      }

      // 2. Ticket / foto del gasto (opcional). Una sola subida: la misma Photo
      //    alimenta despues la galeria y/o el momento relacionados.
      let photo: Photo | null = null;
      if (file) {
        photo = await ensureSharedPhoto(
          db,
          ctx,
          { kind: "file", file },
          photoMeta({
            description: description.trim(),
            tripPlace,
            inGallery: related.enabled.gallery,
          }),
        );
      }

      // 3. Gasto.
      const expense = await expensesRepo.create(db, trip.id, session.user.id, {
        amount: value,
        currency,
        convertedAmount,
        exchangeRate,
        description,
        category,
        paidBy: paidBy || session.user.id,
        tripPlaceId: tripPlace?.id ?? null,
        photoId: photo?.id ?? null,
        date,
      });

      // 4. Momento relacionado sobre esa MISMA foto (si se ha marcado).
      const extra = photo
        ? await createRelatedContent(db, ctx, [photo], related, EXPENSE_RELATED)
        : { moment: null };

      const parts = ["Gasto guardado"];
      if (photo && related.enabled.gallery) parts.push("Foto en la galería");
      if (extra.moment) parts.push("Momento creado");
      toast(parts.join(" · "));

      reset();
      onSaved(expense);
      onClose();
    } catch (err) {
      setError(errorMessage(err, "No se ha podido guardar el gasto."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title="Nuevo gasto"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={() => void submit()} loading={saving}>
              Guardar gasto
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <div className="grid grid-cols-[1fr_auto] gap-3">
            <Field label="Importe" required>
              {(id) => (
                <TextInput
                  id={id}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  inputMode="decimal"
                  placeholder="2400"
                  autoFocus
                />
              )}
            </Field>
            <Field label="Moneda">
              {(id) => (
                <Select
                  id={id}
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-28"
                >
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>

          <Field label="Descripción" required>
            {(id) => (
              <TextInput
                id={id}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ichiran Ramen"
                maxLength={120}
              />
            )}
          </Field>

          <div className="space-y-1.5">
            <span className="block text-sm font-medium ink-secondary">Categoría</span>
            <div className="flex flex-wrap gap-1.5">
              {EXPENSE_CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategory(c.id)}
                  aria-pressed={category === c.id}
                  className={
                    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors " +
                    (category === c.id
                      ? "border-brand-500 bg-brand-50 font-medium text-brand-700 dark:bg-brand-900/40 dark:text-brand-200"
                      : "border-subtle ink-secondary hover:surface-2")
                  }
                >
                  <CategoryIcon category={c.id} size={16} className="shrink-0" />
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Pagado por">
              {(id) => (
                <Select id={id} value={paidBy} onChange={(e) => setPaidBy(e.target.value)}>
                  {members.map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {m.profile.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Fecha">
              {(id) => (
                <TextInput id={id} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              )}
            </Field>
          </div>

          <div className="space-y-1.5">
            <span className="block text-sm font-medium ink-secondary">Lugar (opcional)</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPickingPlace(true)}
                className="flex-1 truncate rounded-xl border border-subtle px-3.5 py-2.5 text-left text-sm ink-primary hover:surface-2"
              >
                <span className="inline-flex min-w-0 items-center gap-2">
                <PlaceIcon size={16} weight="fill" className="shrink-0 text-brand-500" aria-hidden />
                <span className="truncate">
                  {tripPlace ? tripPlace.place.name : "Elegir lugar…"}
                </span>
              </span>
              </button>
              {tripPlace && (
                <Button variant="ghost" size="sm" onClick={() => setTripPlace(null)}>
                  Quitar
                </Button>
              )}
            </div>
          </div>

          <Field label="Foto o ticket (opcional)">
            {(id) => (
              <input
                id={id}
                type="file"
                accept="image/*"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="block w-full text-sm ink-secondary file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand-700 dark:file:bg-brand-900/40 dark:file:text-brand-200"
              />
            )}
          </Field>

          <RelatedContentSection
            offered={EXPENSE_RELATED}
            draft={related}
            onChange={setRelated}
            context={{ tripPlace, date, description }}
            available={Boolean(file)}
            unavailableHint="Adjunta una foto o ticket para poder relacionar contenido."
          />

          {error && (
            <p role="alert" className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
              {error}
            </p>
          )}
        </div>
      </Modal>

      <PlacePicker
        open={pickingPlace}
        onClose={() => setPickingPlace(false)}
        onSelect={setTripPlace}
        title="Lugar del gasto"
      />
    </>
  );
}
