"use client";

import { useEffect, useState } from "react";
import type { ChecklistList, ChecklistListKind } from "@/core/models";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field, TextInput } from "@/components/ui/Field";
import { cn } from "@/lib/cn";
import { LIST_ICONS } from "./listIcons";

/**
 * Alta y edicion de una lista.
 *
 * Tres decisiones y fuera: nombre, icono y como se lee. Nada mas, porque crear
 * una lista tiene que costar menos que apuntar lo primero que va dentro.
 */
export function ListFormModal({
  open,
  list,
  onClose,
  onSubmit,
}: {
  open: boolean;
  /** Nulo = crear. */
  list: ChecklistList | null;
  onClose: () => void;
  onSubmit: (values: { title: string; icon: string; kind: ChecklistListKind }) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [icon, setIcon] = useState("checklist");
  const [kind, setKind] = useState<ChecklistListKind>("checklist");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTitle(list?.title ?? "");
    setIcon(list?.icon ?? "checklist");
    setKind(list?.kind ?? "checklist");
    setError(null);
  }, [open, list]);

  async function save() {
    if (title.trim().length < 2) return setError("Ponle un nombre a la lista.");
    setSaving(true);
    try {
      await onSubmit({ title: title.trim(), icon, kind });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se ha podido guardar la lista.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={list ? "Editar lista" : "Nueva lista"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={() => void save()} loading={saving}>
            {list ? "Guardar" : "Crear lista"}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <Field label="Nombre" required>
          {(id) => (
            <TextInput
              id={id}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Antes del viaje"
              maxLength={40}
              autoFocus
            />
          )}
        </Field>

        <div className="space-y-1.5">
          <span className="block text-sm font-medium ink-secondary">Icono</span>
          <div className="flex flex-wrap gap-1.5">
            {LIST_ICONS.map((entry) => {
              const active = entry.key === icon;
              return (
                <button
                  key={entry.key}
                  type="button"
                  onClick={() => setIcon(entry.key)}
                  aria-pressed={active}
                  aria-label={entry.label}
                  title={entry.label}
                  className={cn(
                    "flex h-11 w-11 items-center justify-center rounded-xl border transition-colors",
                    active
                      ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200"
                      : "border-subtle ink-secondary hover:surface-2",
                  )}
                >
                  <entry.Icon size={20} weight={active ? "fill" : "regular"} aria-hidden />
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-1.5">
          <span className="block text-sm font-medium ink-secondary">Cómo se usa</span>
          <div className="grid gap-2 min-[380px]:grid-cols-2">
            <KindChoice
              active={kind === "checklist"}
              onClick={() => setKind("checklist")}
              title="Para completar"
              hint="Cada elemento se marca. La lista muestra progreso."
            />
            <KindChoice
              active={kind === "collection"}
              onClick={() => setKind("collection")}
              title="Para guardar"
              hint="Lugares, restaurantes, ideas. Sin casillas."
            />
          </div>
        </div>

        {error && (
          <p
            role="alert"
            className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
          >
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}

function KindChoice({
  active,
  onClick,
  title,
  hint,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-xl border px-3 py-2.5 text-left transition-colors",
        active
          ? "border-brand-500 bg-brand-50/60 dark:bg-brand-900/20"
          : "border-subtle hover:surface-2",
      )}
    >
      <span className="block text-sm font-medium ink-primary">{title}</span>
      <span className="mt-0.5 block text-xs ink-muted">{hint}</span>
    </button>
  );
}
