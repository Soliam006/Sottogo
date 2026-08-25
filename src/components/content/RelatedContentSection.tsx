"use client";

import { useEffect, useRef, useState } from "react";
import type { ExpenseCategory, TripPlace } from "@/core/models";
import { CURRENCIES } from "@/core/currency";
import { EXPENSE_CATEGORIES } from "@/core/expenses/categories";
import {
  syncDraftContext,
  type ExpenseDraft,
  type MomentDraft,
  type RelatedDraft,
  type RelatedTarget,
} from "@/core/content/related";
import { useTrip } from "@/components/providers/TripProvider";
import { Button } from "@/components/ui/Button";
import { CheckboxCard, Field, Select, TextArea, TextInput } from "@/components/ui/Field";
import { Rating } from "@/components/ui/Misc";
import { PlacePicker } from "@/components/places/PlacePicker";

/**
 * Bloque opcional "hacer algo mas con esta foto", compartido por los tres
 * modales de creacion. No sustituye a ningun formulario: se anade al final y,
 * mientras no se marque nada, el flujo original no cambia en absoluto.
 *
 * `offered` decide que casillas se muestran, para que cada modal ofrezca solo
 * lo que no es ya su contenido principal.
 */
export function RelatedContentSection({
  offered,
  draft,
  onChange,
  context,
  available,
  unavailableHint = "Selecciona una fotografía para poder relacionar contenido.",
  title = "¿Quieres hacer algo más con esta foto?",
}: {
  offered: readonly RelatedTarget[];
  draft: RelatedDraft;
  onChange: (draft: RelatedDraft) => void;
  /** Valores del formulario principal que se propagan mientras no se editen aquí. */
  context: { tripPlace?: TripPlace | null; date?: string; description?: string };
  /** Si hay una foto con la que trabajar. */
  available: boolean;
  unavailableHint?: string;
  title?: string;
}) {
  const { members } = useTrip();
  const [picking, setPicking] = useState<"moment" | "expense" | null>(null);

  // Lo que el usuario toca aquí deja de seguir al formulario principal.
  const touched = useRef({ moment: false, expense: false });
  const lastContext = useRef<string>("");

  const signature = `${context.tripPlace?.id ?? ""}|${context.date ?? ""}|${context.description ?? ""}`;

  useEffect(() => {
    if (lastContext.current === signature) return;
    lastContext.current = signature;
    onChange(syncDraftContext(draft, context, touched.current));
    // `draft`/`context` se leen a través de la firma: solo sincronizamos cuando cambia.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  // Sin foto no hay nada que relacionar: se apagan las casillas para no crear
  // en silencio un momento o un gasto que el usuario ya no ve en pantalla.
  useEffect(() => {
    if (available) return;
    if (!draft.enabled.gallery && !draft.enabled.moment && !draft.enabled.expense) return;
    onChange({ ...draft, enabled: { gallery: false, moment: false, expense: false } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [available]);

  function setEnabled(target: RelatedTarget, value: boolean) {
    onChange({ ...draft, enabled: { ...draft.enabled, [target]: value } });
  }

  function patchMoment(patch: Partial<MomentDraft>) {
    touched.current.moment = true;
    onChange({ ...draft, moment: { ...draft.moment, ...patch } });
  }

  function patchExpense(patch: Partial<ExpenseDraft>) {
    touched.current.expense = true;
    onChange({ ...draft, expense: { ...draft.expense, ...patch } });
  }

  return (
    <>
      <section className="space-y-3 rounded-2xl border border-dashed border-subtle p-3.5">
        <header>
          <h3 className="text-sm font-semibold ink-primary">📎 {title}</h3>
          <p className="mt-0.5 text-xs ink-muted">
            {available
              ? "Opcional. Se reutiliza la misma imagen: no se sube dos veces."
              : unavailableHint}
          </p>
        </header>

        {available && (
          <div className="space-y-2.5">
            {offered.includes("gallery") && (
              <CheckboxCard
                checked={draft.enabled.gallery}
                onChange={(v) => setEnabled("gallery", v)}
                icon="📸"
                label="Añadir también a la Galería"
                hint="La misma foto aparecerá en la galería del viaje."
              />
            )}

            {offered.includes("moment") && (
              <CheckboxCard
                checked={draft.enabled.moment}
                onChange={(v) => setEnabled("moment", v)}
                icon="✨"
                label="Crear un Momento con esta foto"
                hint="La foto queda asociada al nuevo momento."
              >
                <Field label="Título" required>
                  {(id) => (
                    <TextInput
                      id={id}
                      value={draft.moment.title}
                      onChange={(e) => patchMoment({ title: e.target.value })}
                      placeholder="Nuestro primer ramen"
                    />
                  )}
                </Field>

                <Field label="Historia">
                  {() => (
                    <TextArea
                      value={draft.moment.description}
                      onChange={(e) => patchMoment({ description: e.target.value })}
                      placeholder="Qué pasó, cómo os sentisteis…"
                    />
                  )}
                </Field>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Fecha">
                    {(id) => (
                      <TextInput
                        id={id}
                        type="date"
                        value={draft.moment.date}
                        onChange={(e) => patchMoment({ date: e.target.value })}
                      />
                    )}
                  </Field>
                  <div className="space-y-1.5">
                    <span className="block text-sm font-medium ink-secondary">Valoración</span>
                    <Rating
                      value={draft.moment.rating}
                      onChange={(rating) => patchMoment({ rating })}
                    />
                  </div>
                </div>

                <PlaceRow
                  tripPlace={draft.moment.tripPlace}
                  onPick={() => setPicking("moment")}
                  onClear={() => patchMoment({ tripPlace: null })}
                />
              </CheckboxCard>
            )}

            {offered.includes("expense") && (
              <CheckboxCard
                checked={draft.enabled.expense}
                onChange={(v) => setEnabled("expense", v)}
                icon="💰"
                label="Crear un Gasto con esta foto"
                hint="La foto queda como justificante del gasto."
              >
                <div className="grid grid-cols-[1fr_auto] gap-3">
                  <Field label="Importe" required>
                    {(id) => (
                      <TextInput
                        id={id}
                        value={draft.expense.amount}
                        onChange={(e) => patchExpense({ amount: e.target.value })}
                        inputMode="decimal"
                        placeholder="2400"
                      />
                    )}
                  </Field>
                  <Field label="Moneda">
                    {(id) => (
                      <Select
                        id={id}
                        value={draft.expense.currency}
                        onChange={(e) => patchExpense({ currency: e.target.value })}
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
                      value={draft.expense.description}
                      onChange={(e) => patchExpense({ description: e.target.value })}
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
                        onClick={() => patchExpense({ category: c.id as ExpenseCategory })}
                        aria-pressed={draft.expense.category === c.id}
                        className={
                          "rounded-full border px-3 py-1.5 text-sm transition-colors " +
                          (draft.expense.category === c.id
                            ? "border-brand-500 bg-brand-50 font-medium text-brand-700 dark:bg-brand-900/40 dark:text-brand-200"
                            : "border-subtle ink-secondary hover:surface-2")
                        }
                      >
                        <span aria-hidden>{c.emoji}</span> {c.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Pagado por">
                    {(id) => (
                      <Select
                        id={id}
                        value={draft.expense.paidBy}
                        onChange={(e) => patchExpense({ paidBy: e.target.value })}
                      >
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
                      <TextInput
                        id={id}
                        type="date"
                        value={draft.expense.date}
                        onChange={(e) => patchExpense({ date: e.target.value })}
                      />
                    )}
                  </Field>
                </div>

                <PlaceRow
                  tripPlace={draft.expense.tripPlace}
                  onPick={() => setPicking("expense")}
                  onClear={() => patchExpense({ tripPlace: null })}
                />
              </CheckboxCard>
            )}
          </div>
        )}
      </section>

      <PlacePicker
        open={picking !== null}
        onClose={() => setPicking(null)}
        onSelect={(tripPlace) => {
          if (picking === "moment") patchMoment({ tripPlace });
          if (picking === "expense") patchExpense({ tripPlace });
          setPicking(null);
        }}
        title={picking === "expense" ? "Lugar del gasto" : "Lugar del momento"}
      />
    </>
  );
}

function PlaceRow({
  tripPlace,
  onPick,
  onClear,
}: {
  tripPlace: TripPlace | null;
  onPick: () => void;
  onClear: () => void;
}) {
  return (
    <div className="space-y-1.5">
      <span className="block text-sm font-medium ink-secondary">Lugar</span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onPick}
          className="flex-1 truncate rounded-xl border border-subtle px-3.5 py-2.5 text-left text-sm ink-primary hover:surface-2"
        >
          {tripPlace ? `📍 ${tripPlace.place.name}` : "📍 Elegir lugar…"}
        </button>
        {tripPlace && (
          <Button variant="ghost" size="sm" onClick={onClear}>
            Quitar
          </Button>
        )}
      </div>
    </div>
  );
}
