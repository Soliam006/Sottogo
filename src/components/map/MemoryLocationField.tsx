"use client";

import { useMemo, useState } from "react";
import type { TripPlace } from "@/core/models";
import { describeLocation, type MemoryLocation } from "@/core/map/location";
import { formatDistance, nearest } from "@/core/map/geo";
import { useTrip } from "@/components/providers/TripProvider";
import { Button } from "@/components/ui/Button";
import { PlaceIcon } from "@/components/ui/icons";
import { MemoryLocationPicker } from "./MemoryLocationPicker";

/** Radio dentro del cual proponemos (nunca imponemos) un lugar del itinerario. */
const SUGGEST_RADIUS_M = 1_500;

/**
 * Campo "¿Dónde ocurrió?" reutilizable por los modales de foto y momento.
 *
 * Mantiene separados los dos conceptos que pide el modelo:
 *   - `value`      -> ubicacion EXACTA del recuerdo (coordenadas propias).
 *   - `tripPlace`  -> lugar general del itinerario (contexto), opcional.
 *
 * Si la ubicacion cae cerca de un lugar del viaje lo sugiere, pero guardar el
 * recuerdo nunca depende de aceptarlo.
 */
export function MemoryLocationField({
  value,
  onChange,
  tripPlace,
  onPickTripPlace,
  label = "¿Dónde ocurrió?",
  hint = "Opcional. Es lo que sitúa el recuerdo en el mapa.",
}: {
  value: MemoryLocation | null;
  onChange: (location: MemoryLocation | null) => void;
  tripPlace: TripPlace | null;
  /** Aceptar la sugerencia de asociarlo a un lugar del itinerario. */
  onPickTripPlace: (tripPlace: TripPlace) => void;
  label?: string;
  hint?: string;
}) {
  const { tripPlaces } = useTrip();
  const [picking, setPicking] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Sugerencia: solo si hay coordenadas y aun no se ha elegido lugar.
  const suggestion = useMemo(() => {
    if (!value || tripPlace) return null;
    const candidates = tripPlaces.map((tp) => ({
      tripPlace: tp,
      latitude: tp.place.latitude,
      longitude: tp.place.longitude,
    }));
    return nearest(value, candidates, SUGGEST_RADIUS_M);
  }, [value, tripPlace, tripPlaces]);

  return (
    <>
      <div className="space-y-1.5">
        <span className="flex items-center gap-1.5 text-sm font-medium ink-secondary">
          <PlaceIcon size={15} weight="fill" className="text-brand-500" aria-hidden />
          {label}
        </span>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPicking(true)}
            className="min-w-0 flex-1 truncate rounded-xl border border-subtle px-3.5 py-2.5 text-left text-sm ink-primary hover:surface-2"
          >
            {value ? describeLocation(value) : "Añadir ubicación exacta…"}
          </button>
          {value && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                onChange(null);
                setDismissed(false);
              }}
            >
              Quitar
            </Button>
          )}
        </div>

        <p className="text-xs ink-muted">{hint}</p>

        {suggestion && !dismissed && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-brand-500/40 bg-brand-50/60 px-3 py-2 dark:bg-brand-900/20">
            <p className="min-w-0 flex-1 text-xs ink-secondary">
              Estás a {formatDistance(suggestion.meters)} de{" "}
              <span className="font-semibold ink-primary">
                {suggestion.item.tripPlace.place.name}
              </span>
              . ¿Asociar este recuerdo a ese lugar?
            </p>
            <div className="flex shrink-0 gap-1.5">
              <Button size="sm" onClick={() => onPickTripPlace(suggestion.item.tripPlace)}>
                Asociar
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setDismissed(true)}>
                No
              </Button>
            </div>
          </div>
        )}
      </div>

      <MemoryLocationPicker
        open={picking}
        onClose={() => setPicking(false)}
        onSelect={(location) => {
          onChange(location);
          setDismissed(false);
        }}
      />
    </>
  );
}
