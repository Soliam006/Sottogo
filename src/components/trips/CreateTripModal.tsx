"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PlaceSearchResult } from "@/core/places/types";
import { CURRENCIES } from "@/core/currency";
import { flagEmoji, todayISO } from "@/lib/format";
import { errorMessage } from "@/lib/errors";
import { getSupabaseBrowserClient } from "@/services/supabase/client";
import { tripsRepo, placesRepo } from "@/services/repositories";
import { useSession } from "@/components/providers/SessionProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field, Select, TextInput } from "@/components/ui/Field";
import { PlaceSearchInput } from "@/components/places/PlaceSearchInput";

export function CreateTripModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated?: (tripId: string) => void;
}) {
  const { session } = useSession();
  const { toast } = useToast();
  const router = useRouter();

  const [name, setName] = useState("");
  const [destination, setDestination] = useState<PlaceSearchResult | null>(null);
  const [startDate, setStartDate] = useState(todayISO());
  const [endDate, setEndDate] = useState(todayISO());
  const [currency, setCurrency] = useState("EUR");
  const [coverImage, setCoverImage] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setName("");
    setDestination(null);
    setStartDate(todayISO());
    setEndDate(todayISO());
    setCurrency("EUR");
    setCoverImage("");
    setError(null);
  }

  async function submit() {
    setError(null);

    if (name.trim().length < 2) return setError("Ponle un nombre al viaje.");
    if (!destination) return setError("Elige el destino principal buscándolo en el mapa.");
    if (endDate < startDate) return setError("La fecha de fin no puede ser anterior a la de inicio.");

    if (!session?.user) return;

    setSaving(true);
    try {
      const db = getSupabaseBrowserClient();
      const trip = await tripsRepo.create(db, session.user.id, {
        name,
        destination: destination.city ?? destination.name,
        countryCode: destination.countryCode?.toUpperCase() ?? null,
        startDate,
        endDate,
        baseCurrency: currency,
        coverImage: coverImage.trim() || null,
      });

      // El destino queda tambien como primer lugar del viaje: el mapa nace con contexto.
      await placesRepo.addToTrip(db, trip.id, session.user.id, destination, { status: "wishlist" });

      toast(`Viaje “${trip.name}” creado`);
      reset();
      onClose();
      onCreated?.(trip.id);
      router.push(`/trips/${trip.id}`);
    } catch (err) {
      setError(errorMessage(err, "No se ha podido crear el viaje."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nuevo viaje"
      description="El viaje es lo que conecta gastos, lugares, fotos y recuerdos."
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => void submit()} loading={saving}>
            Crear viaje
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <Field label="Nombre" required hint="Por ejemplo: Japón 2026">
          {(id) => (
            <TextInput
              id={id}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Japón 2026"
              maxLength={80}
            />
          )}
        </Field>

        <div className="space-y-1.5">
          <span className="block text-sm font-medium ink-secondary">
            Destino principal<span className="ml-0.5 text-rose-500">*</span>
          </span>
          {destination ? (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-subtle px-3.5 py-3">
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium ink-primary">
                  {flagEmoji(destination.countryCode?.toUpperCase() ?? null)} {destination.name}
                </span>
                {destination.address && (
                  <span className="block truncate text-xs ink-muted">{destination.address}</span>
                )}
              </span>
              <Button variant="ghost" size="sm" onClick={() => setDestination(null)}>
                Cambiar
              </Button>
            </div>
          ) : (
            <PlaceSearchInput
              onSelect={setDestination}
              placeholder="Busca un país o una ciudad…  (Japan, Tokyo, Kyoto)"
            />
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Fecha de inicio" required>
            {(id) => (
              <TextInput
                id={id}
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  if (endDate < e.target.value) setEndDate(e.target.value);
                }}
              />
            )}
          </Field>
          <Field label="Fecha de fin" required>
            {(id) => (
              <TextInput
                id={id}
                type="date"
                min={startDate}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            )}
          </Field>
        </div>

        <Field label="Moneda principal" hint="Los totales del viaje se muestran en esta moneda.">
          {(id) => (
            <Select id={id} value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} · {c.label}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <Field label="Imagen de portada (opcional)" hint="URL de una imagen para la tarjeta del viaje.">
          {(id) => (
            <TextInput
              id={id}
              value={coverImage}
              onChange={(e) => setCoverImage(e.target.value)}
              placeholder="https://…"
              inputMode="url"
            />
          )}
        </Field>

        {error && (
          <p role="alert" className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
