"use client";

import { useMemo, useState } from "react";
import type { ItineraryItem } from "@/core/models";
import { countWithoutLocation, stopsForDay } from "@/core/itinerary/location";
import { formatDate, formatTime } from "@/lib/format";
import { MapCanvas, type MapMarkerData } from "@/components/map/MapCanvas";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { CloseIcon, ItineraryIcon, PlaceIcon } from "@/components/ui/icons";
import { ItineraryItemIcon } from "@/components/ui/iconFor";
import { EmptyState } from "@/components/ui/States";

/**
 * Mapa del itinerario.
 *
 * Dibuja EXCLUSIVAMENTE las actividades del dia seleccionado. Nunca lee
 * `tripPlaces`, ni fotos, ni gastos: ese es el mapa general y es otro contexto.
 *
 * Los marcadores van numerados por su turno del dia y una linea discontinua los
 * une en orden. Es una ayuda visual del recorrido, no una ruta calculada.
 */
export function ItineraryMap({
  items,
  date,
  onEdit,
}: {
  /** Actividades del dia, ya en orden cronologico. */
  items: ItineraryItem[];
  date: string;
  onEdit: (item: ItineraryItem) => void;
}) {
  const stops = useMemo(() => stopsForDay(items), [items]);
  const missing = countWithoutLocation(items);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const markers = useMemo<MapMarkerData[]>(
    () =>
      stops.map((stop) => ({
        id: stop.item.id,
        latitude: stop.location.latitude,
        longitude: stop.location.longitude,
        label: stop.item.title,
        order: stop.order,
        variant: "step",
        active: stop.item.id === selectedId,
      })),
    [stops, selectedId],
  );

  const route = useMemo(
    () => stops.map((stop) => ({ latitude: stop.location.latitude, longitude: stop.location.longitude })),
    [stops],
  );

  const selected = stops.find((stop) => stop.item.id === selectedId) ?? null;

  if (stops.length === 0) {
    return (
      <Card className="p-5">
        <EmptyState
          icon={PlaceIcon}
          title="Sin ubicaciones este día"
          description={
            items.length === 0
              ? "Añade actividades y dales una ubicación para verlas aquí."
              : "Las actividades de este día todavía no tienen ubicación. Edítalas para añadirla."
          }
          className="border-0"
        />
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <Card className="overflow-hidden p-0">
        <div className="h-[min(28rem,60dvh)] w-full">
          <MapCanvas
            // Cambiar de dia reinicia el encuadre.
            key={`itinerary:${date}`}
            markers={markers}
            route={route.length > 1 ? route : null}
            selectedId={selectedId}
            onMarkerClick={setSelectedId}
            onMapClick={() => setSelectedId(null)}
            autoFit={!selectedId}
            autoFitKey={`${date}:${stops.length}`}
            fitMaxZoom={15}
            fitPadding={64}
          />
        </div>
      </Card>

      {missing > 0 && (
        <p className="text-xs ink-muted">
          {missing} actividad{missing === 1 ? "" : "es"} de este día sin ubicación: no{" "}
          {missing === 1 ? "aparece" : "aparecen"} en el mapa.
        </p>
      )}

      {selected && (
        <Card className="p-4">
          <div className="flex items-start gap-3">
            <span
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-bold tabular-nums text-white"
              aria-hidden
            >
              {selected.order}
            </span>

            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 font-semibold ink-primary">
                <ItineraryItemIcon
                  icon={selected.item.icon}
                  size={15}
                  className="shrink-0 text-brand-500"
                />
                <span className="min-w-0 truncate">{selected.item.title}</span>
              </p>

              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs ink-muted">
                <span className="inline-flex items-center gap-1">
                  <ItineraryIcon size={12} weight="fill" aria-hidden />
                  {formatDate(selected.item.date, "long")}
                </span>
                {selected.item.startTime && (
                  <span className="tabular-nums">
                    {formatTime(selected.item.startTime)}
                    {selected.item.endTime ? ` – ${formatTime(selected.item.endTime)}` : ""}
                  </span>
                )}
              </p>

              {selected.location.name && (
                <p className="mt-1 flex items-center gap-1 text-xs ink-secondary">
                  <PlaceIcon size={12} weight="fill" className="shrink-0 text-brand-500" aria-hidden />
                  <span className="min-w-0 truncate">{selected.location.name}</span>
                </p>
              )}

              {selected.item.description && (
                <p className="mt-2 whitespace-pre-line text-sm ink-secondary">
                  {selected.item.description}
                </p>
              )}

              <div className="mt-3">
                <Button variant="secondary" size="sm" onClick={() => onEdit(selected.item)}>
                  Editar actividad
                </Button>
              </div>
            </div>

            <button
              onClick={() => setSelectedId(null)}
              aria-label="Cerrar"
              className="shrink-0 rounded-lg p-1 ink-muted hover:surface-2"
            >
              <CloseIcon size={16} weight="bold" aria-hidden />
            </button>
          </div>
        </Card>
      )}
    </div>
  );
}
