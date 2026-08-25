"use client";

import { useState } from "react";
import type { ChecklistItem } from "@/core/models";
import { errorMessage } from "@/lib/errors";
import { getSupabaseBrowserClient } from "@/services/supabase/client";
import { checklistRepo } from "@/services/repositories";
import { useTrip } from "@/components/providers/TripProvider";
import { useSession } from "@/components/providers/SessionProvider";
import { useChecklist } from "@/hooks/useTripCollections";
import { useToast } from "@/components/providers/ToastProvider";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { TextInput } from "@/components/ui/Field";
import { ProgressBar } from "@/components/ui/Misc";
import { ErrorState, LoadingState } from "@/components/ui/States";

const SUGGESTIONS = [
  "Pasaporte", "Vuelos", "Alojamiento", "Seguro de viaje", "eSIM",
  "Adaptador de enchufe", "Maleta", "Efectivo en moneda local",
];

export function ChecklistView() {
  const { trip } = useTrip();
  const tripId = trip?.id ?? "";
  const { session } = useSession();
  const { toast } = useToast();

  const { data, loading, error, refresh } = useChecklist(tripId);
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);

  const items = data ?? [];
  const done = items.filter((i) => i.completed).length;

  async function add(text: string) {
    if (text.trim().length < 2 || !trip || !session?.user) return;
    setSaving(true);
    try {
      await checklistRepo.create(
        getSupabaseBrowserClient(),
        trip.id,
        session.user.id,
        text,
        items.length,
      );
      setTitle("");
      await refresh();
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setSaving(false);
    }
  }

  async function toggle(item: ChecklistItem) {
    try {
      await checklistRepo.setCompleted(getSupabaseBrowserClient(), item.id, !item.completed);
      await refresh();
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  }

  async function remove(item: ChecklistItem) {
    try {
      await checklistRepo.remove(getSupabaseBrowserClient(), item.id);
      await refresh();
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  }

  if (loading && !data) return <LoadingState label="Cargando checklist…" />;

  const missing = SUGGESTIONS.filter(
    (s) => !items.some((i) => i.title.toLowerCase() === s.toLowerCase()),
  );

  return (
    <div className="app-page max-w-2xl space-y-6">
      <PageHeader title="Preparación" subtitle="Lo que no puedes olvidar antes de salir." />

      {error && <ErrorState message={error} onRetry={() => void refresh()} />}

      <Card className="p-5">
        <ProgressBar value={done} total={items.length} label="Completado" />

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void add(title);
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

        {items.length > 0 && (
          <ul className="mt-5 divide-y divide-[var(--border-subtle)]">
            {items.map((item) => (
              <li key={item.id} className="group flex items-center gap-3 py-2.5">
                <input
                  type="checkbox"
                  checked={item.completed}
                  onChange={() => void toggle(item)}
                  className="h-5 w-5 shrink-0 accent-[var(--color-brand-600)]"
                  aria-label={item.title}
                />
                <span
                  className={
                    "flex-1 text-sm " +
                    (item.completed ? "line-through ink-muted" : "ink-primary")
                  }
                >
                  {item.title}
                </span>
                <button
                  onClick={() => void remove(item)}
                  aria-label={`Eliminar ${item.title}`}
                  className="rounded-lg p-1 ink-muted transition-opacity hover:text-rose-600 focus-visible:opacity-100 lg:opacity-0 lg:group-hover:opacity-100"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}

        {missing.length > 0 && (
          <div className="mt-6">
            <p className="text-xs font-medium uppercase tracking-wide ink-muted">Sugerencias</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {missing.map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => void add(suggestion)}
                  className="rounded-full border border-subtle px-3 py-1.5 text-sm ink-secondary transition-colors hover:surface-2"
                >
                  + {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}
      </Card>

      <p className="text-xs ink-muted">
        Esta lista es solo de preparación. Voyago no almacena pasaportes, documentos de identidad,
        tarjetas bancarias ni otros documentos personales.
      </p>
    </div>
  );
}
